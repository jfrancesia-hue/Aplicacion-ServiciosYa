-- Presupuestos protegidos, comisión dentro de la app y reclamos de trabajos confirmados.

create table if not exists public.service_job_incidents (
  id uuid primary key default gen_random_uuid(),
  case_number text not null unique,
  payment_record_id uuid not null unique
    references public.service_confirmation_payments(id) on delete restrict,
  chat_id uuid not null references public.chats(id) on delete restrict,
  reporter_id uuid not null references auth.users(id) on delete restrict,
  provider_id uuid not null references auth.users(id) on delete restrict,
  category text not null check (category in ('provider_no_show', 'work_not_completed', 'other')),
  details text,
  mica_summary text,
  status text not null default 'escalated'
    check (status in ('mica_intake', 'escalated', 'reviewing', 'resolved', 'dismissed')),
  assigned_to uuid references auth.users(id) on delete set null,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists service_job_incidents_queue_idx
  on public.service_job_incidents (status, created_at desc);
alter table public.service_job_incidents enable row level security;
drop policy if exists service_job_incidents_participants_read
  on public.service_job_incidents;
create policy service_job_incidents_participants_read
  on public.service_job_incidents for select to authenticated
  using (
    auth.uid() in (reporter_id, provider_id)
    or public.is_operational_admin()
  );
drop policy if exists service_job_incidents_service_role_all
  on public.service_job_incidents;
create policy service_job_incidents_service_role_all
  on public.service_job_incidents for all to service_role
  using (true) with check (true);
grant select on public.service_job_incidents to authenticated;
grant all on public.service_job_incidents to service_role;
create or replace function public.report_service_job_incident(
  p_payment_record_id uuid,
  p_category text,
  p_details text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.service_confirmation_payments%rowtype;
  v_incident public.service_job_incidents%rowtype;
  v_case_number text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_category is null or p_category not in ('provider_no_show', 'work_not_completed', 'other') then
    raise exception 'INVALID_INCIDENT_CATEGORY';
  end if;

  select * into v_payment
  from public.service_confirmation_payments
  where id = p_payment_record_id
  for update;

  if not found then raise exception 'PAYMENT_NOT_FOUND'; end if;
  if v_payment.payer_id <> auth.uid() then raise exception 'ONLY_PAYER_CAN_REPORT'; end if;
  if v_payment.status <> 'approved' then raise exception 'JOB_NOT_CONFIRMED'; end if;
  if v_payment.job_status = 'completed' then raise exception 'JOB_ALREADY_COMPLETED'; end if;

  select * into v_incident
  from public.service_job_incidents
  where payment_record_id = v_payment.id;

  if found then
    return jsonb_build_object(
      'ok', true,
      'incident_id', v_incident.id,
      'case_number', v_incident.case_number,
      'status', v_incident.status,
      'already_open', true
    );
  end if;

  v_case_number := 'SY-' || to_char(now(), 'YYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.service_job_incidents (
    case_number, payment_record_id, chat_id, reporter_id, provider_id,
    category, details, mica_summary, status
  ) values (
    v_case_number, v_payment.id, v_payment.chat_id, auth.uid(),
    v_payment.provider_id, p_category,
    left(nullif(trim(coalesce(p_details, '')), ''), 2000),
    case p_category
      when 'provider_no_show' then 'MICA: el cliente informa que el prestador no se presentó.'
      when 'work_not_completed' then 'MICA: el cliente informa que el trabajo acordado no se realizó.'
      else 'MICA: el cliente solicita revisión humana del servicio.'
    end,
    'escalated'
  ) returning * into v_incident;

  update public.service_confirmation_payments
  set job_status = 'disputed'
  where id = v_payment.id;

  return jsonb_build_object(
    'ok', true,
    'incident_id', v_incident.id,
    'case_number', v_incident.case_number,
    'status', v_incident.status,
    'already_open', false
  );
end;
$$;
revoke all on function public.report_service_job_incident(uuid, text, text) from public;
grant execute on function public.report_service_job_incident(uuid, text, text) to authenticated;
grant execute on function public.report_service_job_incident(uuid, text, text) to service_role;
create or replace function public.get_chat_job_status(p_chat_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_result jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;

  select jsonb_build_object(
    'payment_record_id', payment.id,
    'status', payment.status,
    'job_status', payment.job_status,
    'amount_total', payment.amount_total,
    'currency', payment.currency,
    'provider_id', payment.provider_id,
    'payer_id', payment.payer_id,
    'is_payer', payment.payer_id = auth.uid(),
    'can_review', payment.payer_id = auth.uid() and payment.status = 'approved'
      and payment.job_status = 'confirmed' and review.id is null,
    'completed_at', payment.completed_at,
    'rating', review.rating,
    'reviewed_at', review.created_at,
    'incident_id', incident.id,
    'incident_case_number', incident.case_number,
    'incident_status', incident.status,
    'incident_category', incident.category
  ) into v_result
  from public.service_confirmation_payments payment
  left join public.service_job_reviews review on review.payment_record_id = payment.id
  left join public.service_job_incidents incident on incident.payment_record_id = payment.id
  where payment.chat_id = p_chat_id
    and payment.status = 'approved'
    and auth.uid() in (payment.payer_id, payment.provider_id)
  order by payment.approved_at desc nulls last, payment.created_at desc
  limit 1;

  return coalesce(v_result, '{}'::jsonb);
end;
$$;
revoke all on function public.get_chat_job_status(uuid) from public;
grant execute on function public.get_chat_job_status(uuid) to authenticated;
grant execute on function public.get_chat_job_status(uuid) to service_role;
create or replace function public.enforce_protected_chat_content()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_content text := coalesce(new.contenido, '');
  v_check text := coalesce(new.contenido, '');
  v_payload jsonb;
  v_paid boolean := false;
  v_is_quote boolean := false;
  v_is_audio boolean := false;
  v_is_provider boolean := false;
begin
  if auth.role() = 'service_role' then return new; end if;
  if auth.uid() is null or new.remitente_id <> auth.uid() then
    raise exception 'CHAT_SENDER_INVALID';
  end if;

  if not exists (
    select 1 from public.chats c
    where c.id = new.chat_id
      and auth.uid() in (c.participant_a, c.participant_b, c.usuario_1, c.usuario_2)
  ) then raise exception 'CHAT_PARTICIPANT_REQUIRED'; end if;

  select coalesce(c.acceso_contratado, false) or exists (
    select 1 from public.service_confirmation_payments p
    where p.chat_id = c.id and p.status = 'approved'
  ) into v_paid from public.chats c where c.id = new.chat_id;

  if left(v_content, 15) = ('__TOO' || 'RI_QUOTE__') then
    v_is_quote := true;
    begin v_payload := substring(v_content from 16)::jsonb;
    exception when others then raise exception 'CHAT_QUOTE_INVALID'; end;
    v_check := concat_ws(' ', v_payload->>'scope', v_payload->>'materials',
      v_payload->>'timeframe', v_payload->>'warranty', v_payload->>'validUntil',
      v_payload->>'notes');
    select exists (select 1 from public.usuarios u where u.id = auth.uid() and lower(u.rol::text) in ('worker', 'prestador'))
      or exists (select 1 from public.sy_perfiles s where s.id::text = auth.uid()::text and lower(s.rol::text) in ('worker', 'prestador'))
      into v_is_provider;
    if not v_is_provider then raise exception 'CHAT_QUOTE_PROVIDER_ONLY'; end if;
  elsif left(v_content, 19) = ('__TOO' || 'RI_AUDIO_V1__:') then
    v_is_audio := true;
    begin v_payload := substring(v_content from 20)::jsonb;
    exception when others then raise exception 'CHAT_AUDIO_INVALID'; end;
    v_check := coalesce(v_payload->>'transcript', '');
    if not v_paid and trim(v_check) = '' then raise exception 'CHAT_AUDIO_REQUIRES_TRANSCRIPTION'; end if;
  end if;

  if v_paid then return new; end if;

  if v_check ~* '[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}'
    or v_check ~* '(https?://|www\.|wa\.me/|t\.me/|instagram\.com|facebook\.com|messenger\.com)'
    or v_check ~* '(whats?app|telegram|instagram|facebook|messenger)'
    or v_check ~ '([+]?[0-9][[:space:]().-]*){7,}' then
    raise exception 'CHAT_CONTACT_BLOCKED';
  end if;

  if not v_is_quote and (
    v_check ~ E'\\$[[:space:]]*[0-9]'
    or v_check ~* '[0-9][0-9.,]*[[:space:]]*(ars|pesos?)'
    or (v_check ~* '(precio|monto|tarifa|total|cobro|cobrar|cuesta|sale|mano[[:space:]]+de[[:space:]]+obra)' and v_check ~ '[0-9]{2,}')
  ) then raise exception 'CHAT_PRICE_REQUIRES_QUOTE'; end if;

  return new;
end;
$$;
drop trigger if exists enforce_protected_chat_content on public.mensajes;
create trigger enforce_protected_chat_content
before insert or update of contenido on public.mensajes
for each row execute function public.enforce_protected_chat_content();
