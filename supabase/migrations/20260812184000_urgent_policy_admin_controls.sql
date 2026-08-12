-- Configuración operativa y auditoría de la disciplina de urgencias.
-- El SLA hablado queda fijado en un máximo de 20 minutos; la sanción sigue
-- desactivada hasta que un administrador la habilite explícitamente.

update public.urgent_work_policy
set sla_minutes = least(sla_minutes, 20),
    reminder_minutes = least(reminder_minutes, least(sla_minutes, 20) - 1),
    updated_at = now()
where singleton;

alter table public.urgent_work_policy
  drop constraint if exists urgent_work_policy_sla_minutes_check;
alter table public.urgent_work_policy
  add constraint urgent_work_policy_sla_minutes_check
  check (sla_minutes between 5 and 20);

alter table public.urgent_work_policy
  drop constraint if exists urgent_work_policy_reminder_before_sla_check;
alter table public.urgent_work_policy
  add constraint urgent_work_policy_reminder_before_sla_check
  check (reminder_minutes < sla_minutes);

create table if not exists public.urgent_work_policy_audit (
  id uuid primary key default gen_random_uuid(),
  changed_by uuid not null references auth.users(id) on delete restrict,
  previous_policy jsonb not null,
  new_policy jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists urgent_work_policy_audit_created_idx
  on public.urgent_work_policy_audit (created_at desc);

alter table public.urgent_work_policy_audit enable row level security;

drop policy if exists urgent_work_policy_audit_admin_read
  on public.urgent_work_policy_audit;
create policy urgent_work_policy_audit_admin_read
  on public.urgent_work_policy_audit for select to authenticated
  using (public.is_operational_admin());

drop policy if exists urgent_work_policy_audit_service_role_all
  on public.urgent_work_policy_audit;
create policy urgent_work_policy_audit_service_role_all
  on public.urgent_work_policy_audit for all to service_role
  using (true) with check (true);

grant select on public.urgent_work_policy_audit to authenticated;
grant all on public.urgent_work_policy_audit to service_role;

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
  if p_enforcement_enabled is null
    or p_missed_threshold not between 1 and 20
    or p_window_days not between 1 and 365
    or p_priority_suspension_days not between 1 and 90
    or p_max_reassignments not between 0 and 10 then
    raise exception 'URGENT_POLICY_INVALID';
  end if;

  select * into v_previous
  from public.urgent_work_policy
  where singleton
  for update;

  if not found then
    raise exception 'URGENT_POLICY_NOT_FOUND';
  end if;

  update public.urgent_work_policy
  set enforcement_enabled = p_enforcement_enabled,
      missed_threshold = p_missed_threshold,
      window_days = p_window_days,
      priority_suspension_days = p_priority_suspension_days,
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

  return jsonb_build_object(
    'ok', true,
    'policy', to_jsonb(v_next)
  );
end;
$$;

revoke all on function public.set_urgent_work_policy(boolean, integer, integer, integer, integer, uuid)
  from public;
grant execute on function public.set_urgent_work_policy(boolean, integer, integer, integer, integer, uuid)
  to service_role;
