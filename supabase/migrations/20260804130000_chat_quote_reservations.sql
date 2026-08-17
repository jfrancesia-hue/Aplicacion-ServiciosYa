-- Propuestas versionadas dentro del chat, reserva del 10% y agenda posterior.

create table if not exists public.chat_quotes (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete restrict,
  message_id uuid not null unique references public.mensajes(id) on delete restrict,
  provider_id uuid not null references auth.users(id) on delete restrict,
  client_id uuid not null references auth.users(id) on delete restrict,
  version integer not null check (version > 0),
  amount_provider numeric(14, 2) not null check (amount_provider >= 100),
  fee_rate numeric(6, 5) not null default 0.10
    check (fee_rate > 0 and fee_rate <= 1),
  fee_amount numeric(14, 2) not null check (fee_amount > 0),
  client_total numeric(14, 2) not null check (client_total > amount_provider),
  scope text not null check (char_length(trim(scope)) between 3 and 2000),
  materials text not null default 'A confirmar'
    check (char_length(materials) <= 1000),
  timeframe text not null default 'A coordinar'
    check (char_length(timeframe) <= 500),
  warranty text not null default 'Sin garantia especificada'
    check (char_length(warranty) <= 500),
  validity_text text not null default '24 horas'
    check (char_length(validity_text) <= 200),
  notes text check (notes is null or char_length(notes) <= 2000),
  status text not null default 'pending'
    check (
      status in (
        'pending',
        'changes_requested',
        'accepted_payment_pending',
        'paid',
        'withdrawn',
        'superseded',
        'expired',
        'cancelled'
      )
    ),
  supersedes_quote_id uuid references public.chat_quotes(id) on delete set null,
  accepted_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chat_quotes_participants_differ check (provider_id <> client_id),
  constraint chat_quotes_fee_matches check (
    fee_amount = round(amount_provider * fee_rate, 2)
  ),
  constraint chat_quotes_total_matches check (
    client_total = amount_provider + fee_amount
  ),
  constraint chat_quotes_version_unique unique (chat_id, provider_id, version)
);

create index if not exists chat_quotes_chat_idx
  on public.chat_quotes (chat_id, created_at desc);

create index if not exists chat_quotes_participants_idx
  on public.chat_quotes (provider_id, client_id, status);

alter table public.chat_quotes enable row level security;

drop policy if exists chat_quotes_participants_read on public.chat_quotes;
create policy chat_quotes_participants_read
  on public.chat_quotes
  for select
  to authenticated
  using (auth.uid() = provider_id or auth.uid() = client_id);

drop policy if exists chat_quotes_service_role_all on public.chat_quotes;
create policy chat_quotes_service_role_all
  on public.chat_quotes
  for all
  to service_role
  using (true)
  with check (true);

grant select on public.chat_quotes to authenticated;
grant all on public.chat_quotes to service_role;

create or replace function public.touch_chat_quote()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists chat_quotes_touch on public.chat_quotes;
create trigger chat_quotes_touch
before update on public.chat_quotes
for each row execute function public.touch_chat_quote();

create or replace function public.send_chat_quote(
  p_chat_id uuid,
  p_amount numeric,
  p_scope text,
  p_materials text default 'A confirmar',
  p_timeframe text default 'A coordinar',
  p_warranty text default 'Sin garantia especificada',
  p_validity_text text default '24 horas',
  p_notes text default null,
  p_pricing_mode text default 'project',
  p_unit_rate numeric default null,
  p_estimated_units numeric default 1,
  p_reference_type text default 'fixed',
  p_operational_notice_version text default null,
  p_operational_notice_accepted_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_chat public.chats%rowtype;
  v_client_id uuid;
  v_is_provider boolean := false;
  v_previous public.chat_quotes%rowtype;
  v_version integer;
  v_quote_id uuid := gen_random_uuid();
  v_message_id uuid;
  v_fee_rate numeric(6, 5) := 0.10;
  v_fee_amount numeric(14, 2);
  v_client_total numeric(14, 2);
  v_content text;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if p_amount is null or p_amount < 100 or p_amount > 100000000 then
    raise exception 'INVALID_QUOTE_AMOUNT';
  end if;
  if char_length(trim(coalesce(p_scope, ''))) < 3 then
    raise exception 'QUOTE_SCOPE_REQUIRED';
  end if;
  if p_pricing_mode not in ('project', 'hour', 'day') then
    raise exception 'INVALID_QUOTE_PRICING_MODE';
  end if;
  if p_reference_type not in ('fixed', 'estimate', 'cap') then
    raise exception 'INVALID_QUOTE_REFERENCE_TYPE';
  end if;
  if p_unit_rate is null or p_unit_rate <= 0 or p_estimated_units <= 0 then
    raise exception 'INVALID_QUOTE_PRICING';
  end if;
  if abs(
    round(
      p_unit_rate * case when p_pricing_mode = 'project' then 1 else p_estimated_units end,
      2
    ) - p_amount
  ) >= 0.01 then
    raise exception 'QUOTE_PRICING_MISMATCH';
  end if;

  select * into v_chat
  from public.chats
  where id = p_chat_id;

  if not found then
    raise exception 'CHAT_NOT_FOUND';
  end if;

  if v_user_id not in (
    coalesce(v_chat.participant_a, v_chat.usuario_1),
    coalesce(v_chat.participant_b, v_chat.usuario_2)
  ) then
    raise exception 'CHAT_FORBIDDEN';
  end if;

  v_client_id := case
    when v_user_id = coalesce(v_chat.participant_a, v_chat.usuario_1)
      then coalesce(v_chat.participant_b, v_chat.usuario_2)
    else coalesce(v_chat.participant_a, v_chat.usuario_1)
  end;

  select exists (
    select 1
    from public.usuarios u
    where u.id = v_user_id
      and lower(coalesce(u.rol::text, '')) = 'worker'
  ) or exists (
    select 1
    from public.sy_perfiles p
    where p.id = v_user_id
      and lower(coalesce(p.rol::text, '')) = 'prestador'
  ) into v_is_provider;

  if not v_is_provider then
    raise exception 'ONLY_PROVIDER_CAN_QUOTE';
  end if;

  if exists (
    select 1
    from public.chat_quotes q
    where q.chat_id = p_chat_id
      and q.provider_id = v_user_id
      and q.status in ('accepted_payment_pending', 'paid')
  ) then
    raise exception 'QUOTE_ALREADY_CONFIRMED';
  end if;

  if exists (
    select 1
    from public.service_confirmation_payments payment
    where payment.chat_id = p_chat_id
      and payment.provider_id = v_user_id
      and payment.status in ('creating', 'pending', 'approved')
  ) then
    raise exception 'SERVICE_ALREADY_CONFIRMED';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_chat_id::text));

  select * into v_previous
  from public.chat_quotes q
  where q.chat_id = p_chat_id
    and q.provider_id = v_user_id
    and q.status in ('pending', 'changes_requested')
  order by q.version desc
  limit 1
  for update;

  select coalesce(max(q.version), 0) + 1
  into v_version
  from public.chat_quotes q
  where q.chat_id = p_chat_id
    and q.provider_id = v_user_id;

  v_fee_amount := round(p_amount * v_fee_rate, 2);
  v_client_total := p_amount + v_fee_amount;

  v_content := ('__' || 'TOO' || 'RI_QUOTE__') || jsonb_build_object(
    'type', 'quote',
    'quoteId', v_quote_id,
    'version', v_version,
    'amount', p_amount,
    'feeRate', v_fee_rate,
    'feeAmount', v_fee_amount,
    'clientTotal', v_client_total,
    'scope', trim(p_scope),
    'materials', coalesce(nullif(trim(p_materials), ''), 'A confirmar'),
    'timeframe', coalesce(nullif(trim(p_timeframe), ''), 'A coordinar'),
    'warranty', coalesce(nullif(trim(p_warranty), ''), 'Sin garantia especificada'),
    'validUntil', coalesce(nullif(trim(p_validity_text), ''), '24 horas'),
    'notes', nullif(trim(coalesce(p_notes, '')), ''),
    'pricingMode', p_pricing_mode,
    'unitRate', p_unit_rate,
    'estimatedUnits', case
      when p_pricing_mode = 'project' then 1
      else p_estimated_units
    end,
    'referenceType', case
      when p_pricing_mode = 'project' then 'fixed'
      else p_reference_type
    end,
    'operationalNoticeVersion', nullif(trim(coalesce(p_operational_notice_version, '')), ''),
    'operationalNoticeAcceptedAt', p_operational_notice_accepted_at,
    'createdAt', now()
  )::text;

  insert into public.mensajes (chat_id, remitente_id, contenido)
  values (p_chat_id, v_user_id, v_content)
  returning id into v_message_id;

  if v_previous.id is not null then
    update public.chat_quotes
    set status = 'superseded'
    where id = v_previous.id;
  end if;

  insert into public.chat_quotes (
    id,
    chat_id,
    message_id,
    provider_id,
    client_id,
    version,
    amount_provider,
    fee_rate,
    fee_amount,
    client_total,
    scope,
    materials,
    timeframe,
    warranty,
    validity_text,
    notes,
    supersedes_quote_id
  ) values (
    v_quote_id,
    p_chat_id,
    v_message_id,
    v_user_id,
    v_client_id,
    v_version,
    p_amount,
    v_fee_rate,
    v_fee_amount,
    v_client_total,
    trim(p_scope),
    coalesce(nullif(trim(p_materials), ''), 'A confirmar'),
    coalesce(nullif(trim(p_timeframe), ''), 'A coordinar'),
    coalesce(nullif(trim(p_warranty), ''), 'Sin garantia especificada'),
    coalesce(nullif(trim(p_validity_text), ''), '24 horas'),
    nullif(trim(coalesce(p_notes, '')), ''),
    v_previous.id
  );

  update public.chats set updated_at = now() where id = p_chat_id;

  return jsonb_build_object(
    'ok', true,
    'quote_id', v_quote_id,
    'message_id', v_message_id,
    'version', v_version,
    'amount_provider', p_amount,
    'fee_amount', v_fee_amount,
    'client_total', v_client_total,
    'status', 'pending'
  );
end;
$$;

revoke all on function public.send_chat_quote(
  uuid, numeric, text, text, text, text, text, text,
  text, numeric, numeric, text, text, timestamptz
) from public;
grant execute on function public.send_chat_quote(
  uuid, numeric, text, text, text, text, text, text,
  text, numeric, numeric, text, text, timestamptz
) to authenticated;
grant execute on function public.send_chat_quote(
  uuid, numeric, text, text, text, text, text, text,
  text, numeric, numeric, text, text, timestamptz
) to service_role;

create or replace function public.request_chat_quote_changes(
  p_quote_id uuid,
  p_reason text default 'Revisar la propuesta'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_quote public.chat_quotes%rowtype;
  v_reason text := left(coalesce(nullif(trim(p_reason), ''), 'Revisar la propuesta'), 300);
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select * into v_quote
  from public.chat_quotes
  where id = p_quote_id
  for update;

  if not found then
    raise exception 'QUOTE_NOT_FOUND';
  end if;
  if v_quote.client_id <> v_user_id then
    raise exception 'ONLY_CLIENT_CAN_REQUEST_CHANGES';
  end if;
  if v_quote.status <> 'pending' then
    raise exception 'QUOTE_NOT_EDITABLE';
  end if;

  update public.chat_quotes
  set status = 'changes_requested'
  where id = v_quote.id;

  insert into public.mensajes (chat_id, remitente_id, contenido)
  values (
    v_quote.chat_id,
    v_user_id,
    'Quiero revisar la propuesta: ' || v_reason || '. Sigamos conversando por aca.'
  );

  update public.chats set updated_at = now() where id = v_quote.chat_id;

  return jsonb_build_object('ok', true, 'status', 'changes_requested');
end;
$$;

revoke all on function public.request_chat_quote_changes(uuid, text) from public;
grant execute on function public.request_chat_quote_changes(uuid, text)
  to authenticated;
grant execute on function public.request_chat_quote_changes(uuid, text)
  to service_role;

alter table public.service_confirmation_payments
  add column if not exists chat_quote_id uuid references public.chat_quotes(id) on delete restrict,
  add column if not exists fee_rate numeric(6, 5),
  add column if not exists client_total numeric(14, 2),
  add column if not exists visit_status text not null default 'not_proposed',
  add column if not exists visit_scheduled_for timestamptz,
  add column if not exists visit_note text,
  add column if not exists visit_proposed_by uuid references auth.users(id) on delete set null,
  add column if not exists visit_updated_at timestamptz;

create unique index if not exists service_confirmation_payments_quote_idx
  on public.service_confirmation_payments (chat_quote_id)
  where chat_quote_id is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'service_confirmation_payments_visit_status_check'
      and conrelid = 'public.service_confirmation_payments'::regclass
  ) then
    alter table public.service_confirmation_payments
      add constraint service_confirmation_payments_visit_status_check
      check (
        visit_status in (
          'not_proposed',
          'proposed',
          'scheduled',
          'reschedule_requested',
          'cancelled'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'service_confirmation_payments_visit_note_length'
      and conrelid = 'public.service_confirmation_payments'::regclass
  ) then
    alter table public.service_confirmation_payments
      add constraint service_confirmation_payments_visit_note_length
      check (visit_note is null or char_length(visit_note) <= 500);
  end if;
end
$$;

create or replace function public.confirm_service_reservation(
  p_payment_record_id uuid,
  p_payment_id text,
  p_provider_status text default 'approved'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.service_confirmation_payments%rowtype;
  v_confirmation_message_id uuid;
  v_now timestamptz := now();
  v_content text;
begin
  if nullif(trim(coalesce(p_payment_id, '')), '') is null then
    raise exception 'PAYMENT_ID_REQUIRED';
  end if;

  select * into v_payment
  from public.service_confirmation_payments
  where id = p_payment_record_id
  for update;

  if not found then
    raise exception 'PAYMENT_NOT_FOUND';
  end if;

  if v_payment.status = 'approved'
    and v_payment.confirmation_message_id is not null then
    return jsonb_build_object(
      'ok', true,
      'approved', true,
      'payment_record_id', v_payment.id,
      'confirmation_message_id', v_payment.confirmation_message_id
    );
  end if;

  v_content := '__SERVICIOSYA_SYSTEM_V1__:' || jsonb_build_object(
    'kind', 'booking_confirmed',
    'title', 'Reserva confirmada por ServiciosYa',
    'text', 'El cargo de reserva fue aprobado. Ahora pueden coordinar la fecha de visita dentro de este chat. El precio del trabajo se paga directamente al prestador al finalizar.',
    'actorId', v_payment.payer_id,
    'eventId', v_payment.id
  )::text;

  insert into public.mensajes (chat_id, remitente_id, contenido)
  values (v_payment.chat_id, v_payment.payer_id, v_content)
  returning id into v_confirmation_message_id;

  update public.service_confirmation_payments
  set
    status = 'approved',
    job_status = 'confirmed',
    payment_id = trim(p_payment_id),
    provider_status = coalesce(nullif(trim(p_provider_status), ''), 'approved'),
    approved_at = coalesce(approved_at, v_now),
    confirmation_message_id = v_confirmation_message_id
  where id = v_payment.id;

  if v_payment.chat_quote_id is not null then
    update public.chat_quotes
    set status = 'paid', paid_at = coalesce(paid_at, v_now)
    where id = v_payment.chat_quote_id
      and client_id = v_payment.payer_id
      and provider_id = v_payment.provider_id;
  end if;

  update public.chats
  set acceso_contratado = true, updated_at = v_now
  where id = v_payment.chat_id;

  return jsonb_build_object(
    'ok', true,
    'approved', true,
    'payment_record_id', v_payment.id,
    'confirmation_message_id', v_confirmation_message_id
  );
end;
$$;

revoke all on function public.confirm_service_reservation(uuid, text, text)
  from public;
grant execute on function public.confirm_service_reservation(uuid, text, text)
  to service_role;

create or replace function public.propose_service_visit(
  p_payment_record_id uuid,
  p_scheduled_for timestamptz,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_payment public.service_confirmation_payments%rowtype;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_display_date text;
  v_content text;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if p_scheduled_for is null or p_scheduled_for <= now() then
    raise exception 'VISIT_DATE_MUST_BE_FUTURE';
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'VISIT_NOTE_TOO_LONG';
  end if;

  select * into v_payment
  from public.service_confirmation_payments
  where id = p_payment_record_id
  for update;

  if not found then
    raise exception 'PAYMENT_NOT_FOUND';
  end if;
  if v_payment.provider_id <> v_user_id then
    raise exception 'ONLY_PROVIDER_CAN_PROPOSE_VISIT';
  end if;
  if v_payment.status <> 'approved' or v_payment.job_status <> 'confirmed' then
    raise exception 'JOB_NOT_CONFIRMED';
  end if;
  if v_payment.visit_status not in (
    'not_proposed',
    'proposed',
    'reschedule_requested'
  ) then
    raise exception 'VISIT_ALREADY_SCHEDULED';
  end if;

  update public.service_confirmation_payments
  set
    visit_status = 'proposed',
    visit_scheduled_for = p_scheduled_for,
    visit_note = v_note,
    visit_proposed_by = v_user_id,
    visit_updated_at = now()
  where id = v_payment.id;

  v_display_date := to_char(
    p_scheduled_for at time zone 'America/Argentina/Buenos_Aires',
    'DD/MM/YYYY HH24:MI'
  );
  v_content := '__SERVICIOSYA_SYSTEM_V1__:' || jsonb_build_object(
    'kind', 'visit_proposed',
    'title', 'Fecha de visita propuesta',
    'text', 'El prestador propuso la visita para el ' || v_display_date ||
      case when v_note is null then '.' else '. Nota: ' || v_note end,
    'actorId', v_user_id
  )::text;

  insert into public.mensajes (chat_id, remitente_id, contenido)
  values (v_payment.chat_id, v_user_id, v_content);

  update public.chats set updated_at = now() where id = v_payment.chat_id;

  return jsonb_build_object(
    'ok', true,
    'visit_status', 'proposed',
    'visit_scheduled_for', p_scheduled_for,
    'visit_note', v_note
  );
end;
$$;

revoke all on function public.propose_service_visit(uuid, timestamptz, text)
  from public;
grant execute on function public.propose_service_visit(uuid, timestamptz, text)
  to authenticated;
grant execute on function public.propose_service_visit(uuid, timestamptz, text)
  to service_role;

create or replace function public.respond_service_visit(
  p_payment_record_id uuid,
  p_accept boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_payment public.service_confirmation_payments%rowtype;
  v_next_status text;
  v_display_date text;
  v_content text;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if p_accept is null then
    raise exception 'VISIT_RESPONSE_REQUIRED';
  end if;

  select * into v_payment
  from public.service_confirmation_payments
  where id = p_payment_record_id
  for update;

  if not found then
    raise exception 'PAYMENT_NOT_FOUND';
  end if;
  if v_payment.payer_id <> v_user_id then
    raise exception 'ONLY_CLIENT_CAN_RESPOND_VISIT';
  end if;
  if v_payment.status <> 'approved' or v_payment.visit_status <> 'proposed' then
    raise exception 'VISIT_NOT_PENDING';
  end if;

  v_next_status := case when p_accept then 'scheduled' else 'reschedule_requested' end;

  update public.service_confirmation_payments
  set visit_status = v_next_status, visit_updated_at = now()
  where id = v_payment.id;

  v_display_date := to_char(
    v_payment.visit_scheduled_for at time zone 'America/Argentina/Buenos_Aires',
    'DD/MM/YYYY HH24:MI'
  );
  v_content := '__SERVICIOSYA_SYSTEM_V1__:' || jsonb_build_object(
    'kind', case when p_accept then 'visit_scheduled' else 'visit_reschedule_requested' end,
    'title', case when p_accept then 'Visita agendada' else 'Reprogramacion solicitada' end,
    'text', case
      when p_accept then 'El cliente confirmo la visita para el ' || v_display_date || '.'
      else 'El cliente pidio otra fecha. Continuen coordinando dentro del chat.'
    end,
    'actorId', v_user_id
  )::text;

  insert into public.mensajes (chat_id, remitente_id, contenido)
  values (v_payment.chat_id, v_user_id, v_content);

  update public.chats set updated_at = now() where id = v_payment.chat_id;

  return jsonb_build_object('ok', true, 'visit_status', v_next_status);
end;
$$;

revoke all on function public.respond_service_visit(uuid, boolean) from public;
grant execute on function public.respond_service_visit(uuid, boolean)
  to authenticated;
grant execute on function public.respond_service_visit(uuid, boolean)
  to service_role;

create or replace function public.get_chat_job_status(p_chat_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select jsonb_build_object(
    'payment_record_id', payment.id,
    'chat_quote_id', payment.chat_quote_id,
    'status', payment.status,
    'job_status', payment.job_status,
    'amount_total', payment.amount_total,
    'commission_amount', payment.commission_amount,
    'fee_rate', payment.fee_rate,
    'client_total', payment.client_total,
    'currency', payment.currency,
    'provider_id', payment.provider_id,
    'payer_id', payment.payer_id,
    'is_payer', payment.payer_id = auth.uid(),
    'is_provider', payment.provider_id = auth.uid(),
    'can_review',
      payment.payer_id = auth.uid()
      and payment.status = 'approved'
      and payment.job_status = 'confirmed'
      and review.id is null,
    'visit_status', payment.visit_status,
    'visit_scheduled_for', payment.visit_scheduled_for,
    'visit_note', payment.visit_note,
    'completed_at', payment.completed_at,
    'rating', review.rating,
    'reviewed_at', review.created_at
  )
  into v_result
  from public.service_confirmation_payments as payment
  left join public.service_job_reviews as review
    on review.payment_record_id = payment.id
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
