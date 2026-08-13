-- Política A confirmada: tres incumplimientos en treinta días, con suspensión
-- progresiva de 7, 14 y 30 días cuando hay reincidencia dentro de noventa días.
-- La activación no utiliza incumplimientos anteriores a esta migración.

alter table public.urgent_work_policy
  add column if not exists recurrence_window_days integer not null default 90
    check (recurrence_window_days between 1 and 365),
  add column if not exists second_suspension_days integer not null default 14
    check (second_suspension_days between 1 and 90),
  add column if not exists subsequent_suspension_days integer not null default 30
    check (subsequent_suspension_days between 1 and 90),
  add column if not exists enforcement_started_at timestamptz;

alter table public.worker_urgent_discipline
  add column if not exists sanction_level integer not null default 0
    check (sanction_level between 0 and 3),
  add column if not exists suspension_count integer not null default 0
    check (suspension_count >= 0),
  add column if not exists last_suspended_at timestamptz;

create table if not exists public.urgent_work_discipline_events (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references auth.users(id) on delete cascade,
  triggered_by_miss_id uuid not null unique
    references public.urgent_work_misses(id) on delete restrict,
  sanction_level integer not null check (sanction_level between 1 and 3),
  qualifying_misses integer not null check (qualifying_misses >= 1),
  suspension_days integer not null check (suspension_days between 1 and 90),
  suspended_from timestamptz not null,
  suspended_until timestamptz not null,
  policy_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  check (suspended_until > suspended_from)
);

create index if not exists urgent_work_discipline_events_worker_idx
  on public.urgent_work_discipline_events (worker_id, suspended_from desc);

alter table public.urgent_work_discipline_events enable row level security;

drop policy if exists urgent_work_discipline_events_worker_read
  on public.urgent_work_discipline_events;
create policy urgent_work_discipline_events_worker_read
  on public.urgent_work_discipline_events for select to authenticated
  using (auth.uid() = worker_id or public.is_operational_admin());

drop policy if exists urgent_work_discipline_events_service_role_all
  on public.urgent_work_discipline_events;
create policy urgent_work_discipline_events_service_role_all
  on public.urgent_work_discipline_events for all to service_role
  using (true) with check (true);

grant select on public.urgent_work_discipline_events to authenticated;
grant all on public.urgent_work_discipline_events to service_role;

update public.urgent_work_policy
set enforcement_enabled = true,
    missed_threshold = 3,
    window_days = 30,
    priority_suspension_days = 7,
    recurrence_window_days = 90,
    second_suspension_days = 14,
    subsequent_suspension_days = 30,
    enforcement_started_at = now(),
    updated_at = now()
where singleton;

create or replace function public.apply_urgent_work_miss_discipline()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_policy public.urgent_work_policy%rowtype;
  v_discipline public.worker_urgent_discipline%rowtype;
  v_qualifying_misses integer;
  v_level integer;
  v_suspension_days integer;
  v_suspended_from timestamptz := now();
  v_suspended_until timestamptz;
  v_event_id uuid;
begin
  select * into v_policy
  from public.urgent_work_policy
  where singleton;

  insert into public.worker_urgent_discipline (
    worker_id, last_missed_at, updated_at
  ) values (
    new.worker_id, new.occurred_at, now()
  )
  on conflict (worker_id) do update
  set last_missed_at = excluded.last_missed_at,
      updated_at = now();

  select * into v_discipline
  from public.worker_urgent_discipline
  where worker_id = new.worker_id
  for update;

  if not v_policy.enforcement_enabled
    or v_policy.enforcement_started_at is null
    or new.occurred_at < v_policy.enforcement_started_at then
    return new;
  end if;

  select count(*) into v_qualifying_misses
  from public.urgent_work_misses m
  where m.worker_id = new.worker_id
    and not m.enforcement_applied
    and m.occurred_at >= v_policy.enforcement_started_at
    and m.occurred_at >= now() - make_interval(days => v_policy.window_days);

  if v_qualifying_misses < v_policy.missed_threshold then
    return new;
  end if;

  if v_discipline.last_suspended_at is null
    or v_discipline.last_suspended_at
      < now() - make_interval(days => v_policy.recurrence_window_days) then
    v_level := 1;
    v_suspension_days := v_policy.priority_suspension_days;
  elsif v_discipline.sanction_level <= 1 then
    v_level := 2;
    v_suspension_days := v_policy.second_suspension_days;
  else
    v_level := 3;
    v_suspension_days := v_policy.subsequent_suspension_days;
  end if;

  v_suspended_until := v_suspended_from
    + make_interval(days => v_suspension_days);

  insert into public.urgent_work_discipline_events (
    worker_id, triggered_by_miss_id, sanction_level, qualifying_misses,
    suspension_days, suspended_from, suspended_until, policy_snapshot
  ) values (
    new.worker_id, new.id, v_level, v_qualifying_misses,
    v_suspension_days, v_suspended_from, v_suspended_until,
    jsonb_build_object(
      'missed_threshold', v_policy.missed_threshold,
      'window_days', v_policy.window_days,
      'recurrence_window_days', v_policy.recurrence_window_days,
      'first_suspension_days', v_policy.priority_suspension_days,
      'second_suspension_days', v_policy.second_suspension_days,
      'subsequent_suspension_days', v_policy.subsequent_suspension_days
    )
  ) returning id into v_event_id;

  update public.worker_urgent_discipline
  set priority_suspended_until = v_suspended_until,
      sanction_level = v_level,
      suspension_count = suspension_count + 1,
      last_suspended_at = v_suspended_from,
      updated_at = now()
  where worker_id = new.worker_id;

  update public.urgent_work_misses m
  set enforcement_applied = true,
      metadata = coalesce(m.metadata, '{}'::jsonb) || jsonb_build_object(
        'discipline_event_id', v_event_id,
        'sanction_level', v_level
      )
  where m.worker_id = new.worker_id
    and not m.enforcement_applied
    and m.occurred_at >= v_policy.enforcement_started_at
    and m.occurred_at >= now() - make_interval(days => v_policy.window_days);

  perform public.enqueue_transactional_notification(
    'urgent-discipline:' || v_event_id::text,
    new.worker_id,
    'urgent_priority_suspended',
    'Prioridad de urgencias suspendida',
    format(
      'Acumulaste %s urgencias sin respuesta dentro de %s días. La prioridad queda suspendida por %s días. Podés solicitar una revisión desde soporte.',
      v_policy.missed_threshold,
      v_policy.window_days,
      v_suspension_days
    ),
    null,
    '{}'::jsonb,
    now(),
    jsonb_build_object(
      'discipline_event_id', v_event_id,
      'sanction_level', v_level,
      'suspended_until', v_suspended_until
    )
  );

  return new;
end;
$$;

-- La política confirmada queda fija; el panel sólo puede ajustar la cantidad
-- operativa de reasignaciones.
create or replace function public.set_urgent_work_policy(
  p_enforcement_enabled boolean,
  p_missed_threshold integer,
  p_window_days integer,
  p_priority_suspension_days integer,
  p_max_reassignments integer,
  p_updated_by uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_previous public.urgent_work_policy%rowtype;
  v_next public.urgent_work_policy%rowtype;
begin
  if p_updated_by is null or not exists (
    select 1 from public.usuarios u
    where u.id = p_updated_by and u.rol::text = 'admin'
  ) then
    raise exception 'OPERATIONAL_ADMIN_REQUIRED';
  end if;
  if p_enforcement_enabled is distinct from true
    or p_missed_threshold is distinct from 3
    or p_window_days is distinct from 30
    or p_priority_suspension_days is distinct from 7
    or p_max_reassignments is null
    or p_max_reassignments not between 0 and 10 then
    raise exception 'URGENT_POLICY_A_FIXED';
  end if;

  select * into v_previous
  from public.urgent_work_policy
  where singleton
  for update;

  if not found then
    raise exception 'URGENT_POLICY_NOT_FOUND';
  end if;

  update public.urgent_work_policy
  set enforcement_enabled = true,
      missed_threshold = 3,
      window_days = 30,
      priority_suspension_days = 7,
      recurrence_window_days = 90,
      second_suspension_days = 14,
      subsequent_suspension_days = 30,
      max_reassignments = p_max_reassignments,
      updated_at = now(),
      updated_by = p_updated_by
  where singleton
  returning * into v_next;

  if to_jsonb(v_previous) - array['updated_at', 'updated_by']
      is distinct from
      to_jsonb(v_next) - array['updated_at', 'updated_by'] then
    insert into public.urgent_work_policy_audit (
      changed_by, previous_policy, new_policy
    ) values (
      p_updated_by, to_jsonb(v_previous), to_jsonb(v_next)
    );
  end if;

  return jsonb_build_object('ok', true, 'policy', to_jsonb(v_next));
end;
$$;

-- La precisión de la regla disciplinaria cambia los Términos y genera una
-- versión contractual nueva, manteniendo la Política de Privacidad vigente.
create or replace function public.accept_current_legal_documents(
  p_document_set text,
  p_terms_version text,
  p_privacy_version text,
  p_source text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_acceptance public.user_legal_acceptances%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_document_set <> 'legal-2026-08-12-v2'
    or p_terms_version <> 'terms-2026-08-12-v2'
    or p_privacy_version <> 'privacy-2026-08-12-v1' then
    raise exception 'LEGAL_VERSION_INVALID';
  end if;
  if p_source not in (
    'client_registration',
    'provider_registration',
    'profile_completion',
    'account_update'
  ) then raise exception 'LEGAL_SOURCE_INVALID'; end if;

  insert into public.user_legal_acceptances (
    user_id, document_set, terms_version, privacy_version, source
  ) values (
    auth.uid(), p_document_set, p_terms_version, p_privacy_version, p_source
  )
  on conflict (user_id, document_set) do update
  set terms_version = excluded.terms_version,
      privacy_version = excluded.privacy_version,
      source = excluded.source,
      accepted_at = now()
  returning * into v_acceptance;

  return jsonb_build_object(
    'ok', true,
    'acceptance_id', v_acceptance.id,
    'document_set', v_acceptance.document_set,
    'accepted_at', v_acceptance.accepted_at
  );
end;
$$;

revoke all on function public.accept_current_legal_documents(text, text, text, text)
  from public;
grant execute on function public.accept_current_legal_documents(text, text, text, text)
  to authenticated, service_role;
