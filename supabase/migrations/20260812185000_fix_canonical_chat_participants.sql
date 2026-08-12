-- Corrige referencias heredadas a chats.usuario_1/usuario_2.
-- La tabla vigente usa exclusivamente participant_a/participant_b.

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
  v_is_provider boolean := false;
begin
  if auth.role() = 'service_role' then return new; end if;
  if auth.uid() is null or new.remitente_id <> auth.uid() then
    raise exception 'CHAT_SENDER_INVALID';
  end if;

  if not exists (
    select 1 from public.chats c
    where c.id = new.chat_id
      and auth.uid() in (c.participant_a, c.participant_b)
  ) then raise exception 'CHAT_PARTICIPANT_REQUIRED'; end if;

  select coalesce(c.acceso_contratado, false) or exists (
    select 1 from public.service_confirmation_payments p
    where p.chat_id = c.id and p.status = 'approved'
  ) into v_paid from public.chats c where c.id = new.chat_id;

  if left(v_content, 15) = '__TOORI_QUOTE__' then
    v_is_quote := true;
    begin v_payload := substring(v_content from 16)::jsonb;
    exception when others then raise exception 'CHAT_QUOTE_INVALID'; end;
    v_check := concat_ws(' ', v_payload->>'scope', v_payload->>'materials',
      v_payload->>'timeframe', v_payload->>'warranty', v_payload->>'validUntil',
      v_payload->>'notes');
    select exists (
      select 1 from public.usuarios u
      where u.id = auth.uid()
        and lower(u.rol::text) in ('worker', 'prestador')
    ) or exists (
      select 1 from public.sy_perfiles s
      where s.id::text = auth.uid()::text
        and lower(s.rol::text) in ('worker', 'prestador')
    ) into v_is_provider;
    if not v_is_provider then raise exception 'CHAT_QUOTE_PROVIDER_ONLY'; end if;
  elsif left(v_content, 19) = '__TOORI_AUDIO_V1__:' then
    begin v_payload := substring(v_content from 20)::jsonb;
    exception when others then raise exception 'CHAT_AUDIO_INVALID'; end;
    v_check := coalesce(v_payload->>'transcript', '');
    if not v_paid and trim(v_check) = '' then
      raise exception 'CHAT_AUDIO_REQUIRES_TRANSCRIPTION';
    end if;
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
    or (
      v_check ~* '(precio|monto|tarifa|total|cobro|cobrar|cuesta|sale|mano[[:space:]]+de[[:space:]]+obra)'
      and v_check ~ '[0-9]{2,}'
    )
  ) then raise exception 'CHAT_PRICE_REQUIRES_QUOTE'; end if;

  return new;
end;
$$;

create or replace function public.create_urgent_work_alert(
  p_worker_id uuid,
  p_source text,
  p_category text default null,
  p_chat_id uuid default null,
  p_servicio_id text default null,
  p_title text default 'Trabajo urgente',
  p_body text default 'Un cliente solicita una respuesta urgente.',
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_policy public.urgent_work_policy%rowtype;
  v_alert public.urgent_work_alerts%rowtype;
  v_notification_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_worker_id is null or p_worker_id = auth.uid() then
    raise exception 'URGENT_WORKER_INVALID';
  end if;
  if p_source not in ('service_request', 'direct_contact') then
    raise exception 'URGENT_SOURCE_INVALID';
  end if;
  if not exists (
    select 1 from public.usuarios u
    where u.id = p_worker_id
      and lower(coalesce(u.rol::text, '')) in ('worker', 'prestador')
  ) then raise exception 'URGENT_WORKER_NOT_FOUND'; end if;
  if exists (
    select 1 from public.worker_urgent_discipline d
    where d.worker_id = p_worker_id and d.priority_suspended_until > now()
  ) then raise exception 'URGENT_PRIORITY_SUSPENDED'; end if;
  if p_chat_id is not null and not exists (
    select 1 from public.chats c
    where c.id = p_chat_id
      and auth.uid() in (c.participant_a, c.participant_b)
  ) then raise exception 'CHAT_PARTICIPANT_REQUIRED'; end if;

  select * into v_alert
  from public.urgent_work_alerts a
  where a.worker_id = p_worker_id
    and a.cliente_id = auth.uid()
    and a.status = 'pending'
    and a.response_deadline > now()
    and (p_chat_id is null or a.chat_id = p_chat_id)
  order by a.created_at desc
  limit 1;
  if found then
    return jsonb_build_object(
      'ok', true,
      'alert_id', v_alert.id,
      'response_deadline', v_alert.response_deadline,
      'already_open', true
    );
  end if;

  select * into v_policy
  from public.urgent_work_policy
  where singleton;

  insert into public.urgent_work_alerts (
    source, status, worker_id, cliente_id, servicio_id, chat_id, category,
    title, body, attempts_sent, next_attempt_at, response_deadline, metadata
  ) values (
    p_source, 'pending', p_worker_id, auth.uid(), p_servicio_id, p_chat_id,
    nullif(trim(coalesce(p_category, '')), ''), left(p_title, 160),
    left(p_body, 1000), 0, now(),
    now() + make_interval(mins => v_policy.sla_minutes),
    coalesce(p_metadata, '{}'::jsonb)
  ) returning * into v_alert;

  update public.urgent_work_alerts
  set root_alert_id = v_alert.id
  where id = v_alert.id;

  insert into public.notificaciones (
    receptor_id, emisor_id, mensaje, estado, leido, servicio_id,
    urgent_work_alert_id, urgent_response_deadline
  ) values (
    p_worker_id, auth.uid(), p_body, 'urgente_pendiente', false, p_servicio_id,
    v_alert.id, v_alert.response_deadline
  ) returning id into v_notification_id;

  update public.urgent_work_alerts
  set notificacion_id = v_notification_id
  where id = v_alert.id;

  return jsonb_build_object(
    'ok', true,
    'alert_id', v_alert.id,
    'response_deadline', v_alert.response_deadline,
    'already_open', false
  );
end;
$$;

revoke all on function public.create_urgent_work_alert(uuid, text, text, uuid, text, text, text, jsonb)
  from public;
grant execute on function public.create_urgent_work_alert(uuid, text, text, uuid, text, text, text, jsonb)
  to authenticated, service_role;
