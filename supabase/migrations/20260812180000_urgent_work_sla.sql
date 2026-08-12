-- Urgencias reales: respuesta explícita, SLA de 20 minutos y disciplina configurable.

alter table public.urgent_work_alerts
  drop constraint if exists urgent_work_alerts_status_check;
alter table public.urgent_work_alerts
  add constraint urgent_work_alerts_status_check
  check (status in ('pending', 'accepted', 'declined', 'expired', 'cancelled', 'reassigned', 'escalation_ready'));

alter table public.urgent_work_alerts
  add column if not exists response_deadline timestamptz,
  add column if not exists responded_at timestamptz,
  add column if not exists response_action text,
  add column if not exists missed_at timestamptz,
  add column if not exists processing_at timestamptz,
  add column if not exists root_alert_id uuid references public.urgent_work_alerts(id) on delete set null,
  add column if not exists reassigned_from_id uuid references public.urgent_work_alerts(id) on delete set null,
  add column if not exists reassigned_alert_id uuid references public.urgent_work_alerts(id) on delete set null,
  add column if not exists reassignment_processed_at timestamptz,
  add column if not exists assignment_round integer not null default 1;

alter table public.urgent_work_alerts
  drop constraint if exists urgent_work_alerts_response_action_check;
alter table public.urgent_work_alerts
  add constraint urgent_work_alerts_response_action_check
  check (response_action is null or response_action in ('accepted', 'declined'));

update public.urgent_work_alerts
set response_deadline = created_at + interval '20 minutes',
    next_attempt_at = least(next_attempt_at, now())
where response_deadline is null;

alter table public.urgent_work_alerts
  alter column response_deadline set default (now() + interval '20 minutes'),
  alter column response_deadline set not null;

create index if not exists urgent_work_alerts_deadline_idx
  on public.urgent_work_alerts (status, response_deadline)
  where status in ('pending', 'declined');

drop policy if exists urgent_work_alerts_participants_read on public.urgent_work_alerts;
create policy urgent_work_alerts_participants_read
  on public.urgent_work_alerts for select to authenticated
  using (auth.uid() in (worker_id, cliente_id) or public.is_operational_admin());
drop policy if exists urgent_work_alerts_authenticated_insert on public.urgent_work_alerts;
revoke insert, update, delete on public.urgent_work_alerts from authenticated;
grant select on public.urgent_work_alerts to authenticated;

create table if not exists public.urgent_work_policy (
  singleton boolean primary key default true check (singleton),
  sla_minutes integer not null default 20 check (sla_minutes between 5 and 60),
  reminder_minutes integer not null default 10 check (reminder_minutes between 1 and 59),
  max_reassignments integer not null default 3 check (max_reassignments between 0 and 10),
  enforcement_enabled boolean not null default false,
  missed_threshold integer not null default 3 check (missed_threshold between 1 and 20),
  window_days integer not null default 30 check (window_days between 1 and 365),
  priority_suspension_days integer not null default 7 check (priority_suspension_days between 1 and 90),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
insert into public.urgent_work_policy (singleton) values (true) on conflict do nothing;
alter table public.urgent_work_policy enable row level security;
drop policy if exists urgent_work_policy_authenticated_read on public.urgent_work_policy;
create policy urgent_work_policy_authenticated_read
  on public.urgent_work_policy for select to authenticated using (true);
drop policy if exists urgent_work_policy_service_role_all on public.urgent_work_policy;
create policy urgent_work_policy_service_role_all
  on public.urgent_work_policy for all to service_role using (true) with check (true);
grant select on public.urgent_work_policy to authenticated;
grant all on public.urgent_work_policy to service_role;

create table if not exists public.urgent_work_misses (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null unique references public.urgent_work_alerts(id) on delete cascade,
  worker_id uuid not null references auth.users(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  response_deadline timestamptz not null,
  assignment_round integer not null,
  enforcement_applied boolean not null default false,
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists urgent_work_misses_worker_idx
  on public.urgent_work_misses (worker_id, occurred_at desc);
alter table public.urgent_work_misses enable row level security;
drop policy if exists urgent_work_misses_worker_read on public.urgent_work_misses;
create policy urgent_work_misses_worker_read
  on public.urgent_work_misses for select to authenticated
  using (auth.uid() = worker_id or public.is_operational_admin());
drop policy if exists urgent_work_misses_service_role_all on public.urgent_work_misses;
create policy urgent_work_misses_service_role_all
  on public.urgent_work_misses for all to service_role using (true) with check (true);
grant select on public.urgent_work_misses to authenticated;
grant all on public.urgent_work_misses to service_role;

create table if not exists public.worker_urgent_discipline (
  worker_id uuid primary key references auth.users(id) on delete cascade,
  priority_suspended_until timestamptz,
  last_missed_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.worker_urgent_discipline enable row level security;
drop policy if exists worker_urgent_discipline_own_read on public.worker_urgent_discipline;
create policy worker_urgent_discipline_own_read
  on public.worker_urgent_discipline for select to authenticated
  using (auth.uid() = worker_id or public.is_operational_admin());
drop policy if exists worker_urgent_discipline_service_role_all on public.worker_urgent_discipline;
create policy worker_urgent_discipline_service_role_all
  on public.worker_urgent_discipline for all to service_role using (true) with check (true);
grant select on public.worker_urgent_discipline to authenticated;
grant all on public.worker_urgent_discipline to service_role;

create or replace function public.apply_urgent_work_miss_discipline()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_policy public.urgent_work_policy%rowtype;
  v_recent_misses integer;
begin
  select * into v_policy from public.urgent_work_policy where singleton;
  insert into public.worker_urgent_discipline (worker_id, last_missed_at, updated_at)
  values (new.worker_id, new.occurred_at, now())
  on conflict (worker_id) do update
  set last_missed_at = excluded.last_missed_at, updated_at = now();

  select count(*) into v_recent_misses
  from public.urgent_work_misses m
  where m.worker_id = new.worker_id
    and m.occurred_at >= now() - make_interval(days => v_policy.window_days);

  if v_policy.enforcement_enabled and v_recent_misses >= v_policy.missed_threshold then
    update public.worker_urgent_discipline
    set priority_suspended_until = greatest(
          coalesce(priority_suspended_until, now()),
          now() + make_interval(days => v_policy.priority_suspension_days)
        ),
        updated_at = now()
    where worker_id = new.worker_id;
    update public.urgent_work_misses set enforcement_applied = true where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists apply_urgent_work_miss_discipline on public.urgent_work_misses;
create trigger apply_urgent_work_miss_discipline
after insert on public.urgent_work_misses
for each row execute function public.apply_urgent_work_miss_discipline();

alter table public.notificaciones
  add column if not exists urgent_work_alert_id uuid
    references public.urgent_work_alerts(id) on delete set null,
  add column if not exists urgent_response_deadline timestamptz;
create unique index if not exists notificaciones_urgent_work_alert_uidx
  on public.notificaciones (urgent_work_alert_id)
  where urgent_work_alert_id is not null;

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
  if p_worker_id is null or p_worker_id = auth.uid() then raise exception 'URGENT_WORKER_INVALID'; end if;
  if p_source not in ('service_request', 'direct_contact') then raise exception 'URGENT_SOURCE_INVALID'; end if;
  if not exists (
    select 1 from public.usuarios u
    where u.id = p_worker_id and lower(coalesce(u.rol::text, '')) in ('worker', 'prestador')
  ) then raise exception 'URGENT_WORKER_NOT_FOUND'; end if;
  if exists (
    select 1 from public.worker_urgent_discipline d
    where d.worker_id = p_worker_id and d.priority_suspended_until > now()
  ) then raise exception 'URGENT_PRIORITY_SUSPENDED'; end if;
  if p_chat_id is not null and not exists (
    select 1 from public.chats c
    where c.id = p_chat_id and auth.uid() in (c.participant_a, c.participant_b, c.usuario_1, c.usuario_2)
  ) then raise exception 'CHAT_PARTICIPANT_REQUIRED'; end if;

  select * into v_alert
  from public.urgent_work_alerts a
  where a.worker_id = p_worker_id and a.cliente_id = auth.uid()
    and a.status = 'pending' and a.response_deadline > now()
    and (p_chat_id is null or a.chat_id = p_chat_id)
  order by a.created_at desc limit 1;
  if found then
    return jsonb_build_object('ok', true, 'alert_id', v_alert.id,
      'response_deadline', v_alert.response_deadline, 'already_open', true);
  end if;

  select * into v_policy from public.urgent_work_policy where singleton;
  insert into public.urgent_work_alerts (
    source, status, worker_id, cliente_id, servicio_id, chat_id, category,
    title, body, attempts_sent, next_attempt_at, response_deadline, metadata
  ) values (
    p_source, 'pending', p_worker_id, auth.uid(), p_servicio_id, p_chat_id,
    nullif(trim(coalesce(p_category, '')), ''), left(p_title, 160), left(p_body, 1000),
    0, now(), now() + make_interval(mins => v_policy.sla_minutes),
    coalesce(p_metadata, '{}'::jsonb)
  ) returning * into v_alert;

  update public.urgent_work_alerts set root_alert_id = v_alert.id where id = v_alert.id;
  insert into public.notificaciones (
    receptor_id, emisor_id, mensaje, estado, leido, servicio_id,
    urgent_work_alert_id, urgent_response_deadline
  ) values (
    p_worker_id, auth.uid(), p_body, 'urgente_pendiente', false, p_servicio_id,
    v_alert.id, v_alert.response_deadline
  ) returning id into v_notification_id;
  update public.urgent_work_alerts set notificacion_id = v_notification_id where id = v_alert.id;

  return jsonb_build_object('ok', true, 'alert_id', v_alert.id,
    'response_deadline', v_alert.response_deadline, 'already_open', false);
end;
$$;

create or replace function public.respond_to_urgent_work_alert(
  p_alert_id uuid,
  p_response text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_alert public.urgent_work_alerts%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_response not in ('accepted', 'declined') then raise exception 'URGENT_RESPONSE_INVALID'; end if;
  select * into v_alert from public.urgent_work_alerts where id = p_alert_id for update;
  if not found then raise exception 'URGENT_ALERT_NOT_FOUND'; end if;
  if v_alert.worker_id <> auth.uid() then raise exception 'URGENT_WORKER_REQUIRED'; end if;
  if v_alert.status <> 'pending' then
    return jsonb_build_object('ok', false, 'reason', 'already_resolved', 'status', v_alert.status);
  end if;
  if v_alert.response_deadline <= now() then
    update public.urgent_work_alerts
    set status = 'expired', missed_at = now(), processing_at = null, updated_at = now()
    where id = v_alert.id;
    insert into public.urgent_work_misses (alert_id, worker_id, response_deadline, assignment_round)
    values (v_alert.id, v_alert.worker_id, v_alert.response_deadline, v_alert.assignment_round)
    on conflict (alert_id) do nothing;
    return jsonb_build_object('ok', false, 'reason', 'expired', 'status', 'expired');
  end if;

  update public.urgent_work_alerts
  set status = p_response, response_action = p_response, responded_at = now(),
      next_attempt_at = now(), processing_at = null, updated_at = now()
  where id = v_alert.id;
  update public.notificaciones
  set estado = case when p_response = 'accepted' then 'aceptado' else 'rechazado' end,
      leido = true
  where urgent_work_alert_id = v_alert.id;

  if p_response = 'accepted' then
    perform public.enqueue_transactional_notification(
      'urgent-accepted-client:' || v_alert.id, v_alert.cliente_id, 'urgent_accepted',
      'Solicitud urgente aceptada', 'El prestador respondió dentro de los 20 minutos.',
      'ChatIndividual', jsonb_build_object('chatId', v_alert.chat_id), now(),
      jsonb_build_object('urgent_alert_id', v_alert.id)
    );
  end if;
  return jsonb_build_object('ok', true, 'status', p_response,
    'responded_at', now(), 'response_deadline', v_alert.response_deadline);
end;
$$;

create or replace function public.claim_due_urgent_work_alerts(p_limit integer default 100)
returns setof public.urgent_work_alerts
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with due as (
    select a.id from public.urgent_work_alerts a
    where (
      (a.status = 'pending' and (a.next_attempt_at <= now() or a.response_deadline <= now()))
      or (a.status in ('declined', 'expired') and a.reassignment_processed_at is null)
    )
    and (a.processing_at is null or a.processing_at < now() - interval '5 minutes')
    order by a.response_deadline, a.created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 100), 200))
  )
  update public.urgent_work_alerts a
  set processing_at = now(), updated_at = now()
  from due where a.id = due.id
  returning a.*;
end;
$$;

revoke all on function public.create_urgent_work_alert(uuid, text, text, uuid, text, text, text, jsonb) from public;
revoke all on function public.respond_to_urgent_work_alert(uuid, text) from public;
revoke all on function public.claim_due_urgent_work_alerts(integer) from public;
grant execute on function public.create_urgent_work_alert(uuid, text, text, uuid, text, text, text, jsonb) to authenticated, service_role;
grant execute on function public.respond_to_urgent_work_alert(uuid, text) to authenticated, service_role;
grant execute on function public.claim_due_urgent_work_alerts(integer) to service_role;
