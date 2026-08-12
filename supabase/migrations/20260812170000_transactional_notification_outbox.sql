-- Bandeja idempotente para notificaciones in-app, push y correo transaccional.

create table if not exists public.transactional_notification_outbox (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  title text not null,
  body text not null,
  action_screen text,
  action_params jsonb not null default '{}'::jsonb,
  scheduled_for timestamptz not null default now(),
  in_app_status text not null default 'pending'
    check (in_app_status in ('pending', 'sent', 'failed')),
  push_status text not null default 'pending'
    check (push_status in ('pending', 'sent', 'skipped', 'failed')),
  email_status text not null default 'pending'
    check (email_status in ('pending', 'sent', 'skipped', 'waiting_configuration', 'failed')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  processing_at timestamptz,
  in_app_sent_at timestamptz,
  push_sent_at timestamptz,
  email_sent_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists transactional_notification_outbox_due_idx
  on public.transactional_notification_outbox (next_attempt_at, scheduled_for)
  where push_status = 'pending' or email_status in ('pending', 'waiting_configuration');

alter table public.transactional_notification_outbox enable row level security;
drop policy if exists transactional_notification_outbox_service_role_all
  on public.transactional_notification_outbox;
create policy transactional_notification_outbox_service_role_all
  on public.transactional_notification_outbox for all to service_role
  using (true) with check (true);
grant all on public.transactional_notification_outbox to service_role;

alter table public.notificaciones
  add column if not exists transactional_outbox_id uuid
    references public.transactional_notification_outbox(id) on delete set null;

create unique index if not exists notificaciones_transactional_outbox_uidx
  on public.notificaciones (transactional_outbox_id)
  where transactional_outbox_id is not null;

create or replace function public.enqueue_transactional_notification(
  p_event_key text,
  p_user_id uuid,
  p_event_type text,
  p_title text,
  p_body text,
  p_action_screen text default null,
  p_action_params jsonb default '{}'::jsonb,
  p_scheduled_for timestamptz default now(),
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  insert into public.transactional_notification_outbox (
    event_key, user_id, event_type, title, body, action_screen,
    action_params, scheduled_for, next_attempt_at, metadata
  ) values (
    left(p_event_key, 240), p_user_id, left(p_event_type, 80),
    left(p_title, 160), left(p_body, 1000), p_action_screen,
    coalesce(p_action_params, '{}'::jsonb), p_scheduled_for,
    least(p_scheduled_for, now()), coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (event_key) do update set
    title = excluded.title,
    body = excluded.body,
    action_screen = excluded.action_screen,
    action_params = excluded.action_params,
    scheduled_for = excluded.scheduled_for,
    metadata = excluded.metadata,
    updated_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.enqueue_transactional_notification(text, uuid, text, text, text, text, jsonb, timestamptz, jsonb) from public;
grant execute on function public.enqueue_transactional_notification(text, uuid, text, text, text, text, jsonb, timestamptz, jsonb) to service_role;

create or replace function public.claim_transactional_notifications(p_limit integer default 50)
returns setof public.transactional_notification_outbox
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with due as (
    select o.id
    from public.transactional_notification_outbox o
    where o.scheduled_for <= now()
      and o.next_attempt_at <= now()
      and (
        o.in_app_status = 'pending'
        or o.push_status = 'pending'
        or o.email_status in ('pending', 'waiting_configuration')
      )
      and (o.processing_at is null or o.processing_at < now() - interval '5 minutes')
    order by o.scheduled_for, o.created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 50), 100))
  )
  update public.transactional_notification_outbox o
  set processing_at = now(), attempts = o.attempts + 1, updated_at = now()
  from due
  where o.id = due.id
  returning o.*;
end;
$$;

revoke all on function public.claim_transactional_notifications(integer) from public;
grant execute on function public.claim_transactional_notifications(integer) to service_role;

create or replace function public.enqueue_service_payment_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    perform public.enqueue_transactional_notification(
      'payment-approved-provider:' || new.id, new.provider_id, 'payment_approved',
      'Presupuesto confirmado',
      'El cliente pagó la comisión de conexión. Proponé hasta tres fechas desde el chat.',
      'ChatIndividual', jsonb_build_object('chatId', new.chat_id), now(),
      jsonb_build_object('payment_record_id', new.id)
    );
    perform public.enqueue_transactional_notification(
      'payment-approved-client:' || new.id, new.payer_id, 'payment_approved',
      'Pago confirmado',
      'La comisión quedó aprobada. El prestador podrá proponerte fechas desde el chat.',
      'ChatIndividual', jsonb_build_object('chatId', new.chat_id), now(),
      jsonb_build_object('payment_record_id', new.id)
    );
  end if;

  if new.schedule_status = 'scheduled' and (
    old.schedule_status is distinct from 'scheduled'
    or old.scheduled_start is distinct from new.scheduled_start
  ) then
    update public.transactional_notification_outbox
    set push_status = case when push_status = 'pending' then 'skipped' else push_status end,
        email_status = case when email_status in ('pending', 'waiting_configuration') then 'skipped' else email_status end,
        last_error = 'superseded_by_reschedule', updated_at = now()
    where metadata->>'payment_record_id' = new.id::text
      and event_type in ('job_reminder_24h', 'job_reminder_2h')
      and scheduled_for > now();

    perform public.enqueue_transactional_notification(
      'schedule-confirmed-client:' || new.id || ':' || new.schedule_round,
      new.payer_id, 'schedule_confirmed', 'Fecha confirmada',
      'La fecha del trabajo quedó confirmada. Revisá los detalles en Mis trabajos.',
      'TrabajosPendientes', '{}'::jsonb, now(),
      jsonb_build_object('payment_record_id', new.id, 'scheduled_start', new.scheduled_start)
    );
    perform public.enqueue_transactional_notification(
      'schedule-confirmed-provider:' || new.id || ':' || new.schedule_round,
      new.provider_id, 'schedule_confirmed', 'Fecha confirmada',
      'La fecha del trabajo quedó confirmada. Revisá los detalles en Mis trabajos.',
      'TrabajosPendientes', '{}'::jsonb, now(),
      jsonb_build_object('payment_record_id', new.id, 'scheduled_start', new.scheduled_start)
    );
    -- select_service_schedule_slot ya notificó directamente a quien propuso las opciones.
    update public.transactional_notification_outbox
    set in_app_status = 'sent', in_app_sent_at = now()
    where event_key = case
      when new.schedule_proposed_by = new.payer_id
        then 'schedule-confirmed-client:' || new.id || ':' || new.schedule_round
      else 'schedule-confirmed-provider:' || new.id || ':' || new.schedule_round
    end;

    if new.scheduled_start > now() + interval '24 hours' then
      perform public.enqueue_transactional_notification(
        'job-reminder-24h-client:' || new.id || ':' || new.schedule_round,
        new.payer_id, 'job_reminder_24h', 'Trabajo programado para mañana',
        'Recordatorio: tenés un servicio confirmado dentro de aproximadamente 24 horas.',
        'TrabajosPendientes', '{}'::jsonb, new.scheduled_start - interval '24 hours',
        jsonb_build_object('payment_record_id', new.id, 'scheduled_start', new.scheduled_start)
      );
      perform public.enqueue_transactional_notification(
        'job-reminder-24h-provider:' || new.id || ':' || new.schedule_round,
        new.provider_id, 'job_reminder_24h', 'Trabajo programado para mañana',
        'Recordatorio: tenés un servicio confirmado dentro de aproximadamente 24 horas.',
        'TrabajosPendientes', '{}'::jsonb, new.scheduled_start - interval '24 hours',
        jsonb_build_object('payment_record_id', new.id, 'scheduled_start', new.scheduled_start)
      );
    end if;
    if new.scheduled_start > now() + interval '2 hours' then
      perform public.enqueue_transactional_notification(
        'job-reminder-2h-client:' || new.id || ':' || new.schedule_round,
        new.payer_id, 'job_reminder_2h', 'Tu trabajo comienza pronto',
        'Recordatorio: el servicio está programado dentro de aproximadamente 2 horas.',
        'TrabajosPendientes', '{}'::jsonb, new.scheduled_start - interval '2 hours',
        jsonb_build_object('payment_record_id', new.id, 'scheduled_start', new.scheduled_start)
      );
      perform public.enqueue_transactional_notification(
        'job-reminder-2h-provider:' || new.id || ':' || new.schedule_round,
        new.provider_id, 'job_reminder_2h', 'Tu trabajo comienza pronto',
        'Recordatorio: el servicio está programado dentro de aproximadamente 2 horas.',
        'TrabajosPendientes', '{}'::jsonb, new.scheduled_start - interval '2 hours',
        jsonb_build_object('payment_record_id', new.id, 'scheduled_start', new.scheduled_start)
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enqueue_service_payment_notifications on public.service_confirmation_payments;
create trigger enqueue_service_payment_notifications
after update on public.service_confirmation_payments
for each row execute function public.enqueue_service_payment_notifications();

create or replace function public.enqueue_schedule_proposal_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_payment public.service_confirmation_payments%rowtype;
declare v_recipient uuid;
begin
  select * into v_payment from public.service_confirmation_payments where id = new.payment_record_id;
  v_recipient := case when new.proposed_by = v_payment.payer_id then v_payment.provider_id else v_payment.payer_id end;
  perform public.enqueue_transactional_notification(
    'schedule-options:' || new.id, v_recipient, 'schedule_options',
    case when new.reason = 'reschedule' then 'Propuesta de reprogramación' else 'Elegí una fecha para el trabajo' end,
    case when new.reason = 'reschedule'
      then 'La otra parte propuso nuevas fechas. Elegí una desde el chat.'
      else 'El prestador propuso fechas para el trabajo. Elegí una desde el chat.' end,
    'ChatIndividual', jsonb_build_object('chatId', new.chat_id), now(),
    jsonb_build_object('payment_record_id', new.payment_record_id, 'proposal_id', new.id)
  );
  update public.transactional_notification_outbox
  set in_app_status = 'sent', in_app_sent_at = now()
  where event_key = 'schedule-options:' || new.id;
  return new;
end;
$$;

drop trigger if exists enqueue_schedule_proposal_notification on public.service_schedule_proposals;
create trigger enqueue_schedule_proposal_notification
after insert on public.service_schedule_proposals
for each row execute function public.enqueue_schedule_proposal_notification();

create or replace function public.enqueue_incident_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_admin record;
begin
  perform public.enqueue_transactional_notification(
    'incident-provider:' || new.id, new.provider_id, 'incident_opened',
    'Reclamo abierto',
    'Se abrió un reclamo del servicio. El equipo operativo revisará el caso.',
    'TrabajosPendientes', '{}'::jsonb, now(), jsonb_build_object('incident_id', new.id)
  );
  update public.transactional_notification_outbox
  set in_app_status = 'sent', in_app_sent_at = now()
  where event_key = 'incident-provider:' || new.id;
  for v_admin in
    select id from public.usuarios where lower(coalesce(rol::text, '')) = 'admin'
  loop
    perform public.enqueue_transactional_notification(
      'incident-admin:' || new.id || ':' || v_admin.id, v_admin.id, 'incident_admin',
      'Nuevo reclamo para revisar',
      'MICA completó el intake del caso ' || new.case_number || '.',
      'OperationalDashboard', '{}'::jsonb, now(), jsonb_build_object('incident_id', new.id)
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists enqueue_incident_notifications on public.service_job_incidents;
create trigger enqueue_incident_notifications
after insert on public.service_job_incidents
for each row execute function public.enqueue_incident_notifications();

select cron.unschedule('process-transactional-notifications-every-minute')
where exists (select 1 from cron.job where jobname = 'process-transactional-notifications-every-minute');

select cron.schedule(
  'process-transactional-notifications-every-minute', '* * * * *',
  $$
  select net.http_post(
    url := 'https://dhhhftzdfpqthzvkrqoz.functions.supabase.co/process-transactional-notifications',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
