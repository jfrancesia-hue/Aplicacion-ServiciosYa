-- Disponibilidad temporal y herramientas de confianza.
-- Todos los cambios son aditivos para preservar perfiles, chats y servicios.

alter table public.workers
  add column if not exists available_until timestamptz,
  add column if not exists availability_duration_hours smallint;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'workers_availability_duration_hours_check'
      and conrelid = 'public.workers'::regclass
  ) then
    alter table public.workers
      add constraint workers_availability_duration_hours_check
      check (
        availability_duration_hours is null
        or availability_duration_hours in (8, 12, 24)
      );
  end if;
end
$$;

create index if not exists workers_available_until_idx
  on public.workers (available_until desc)
  where status = 'ONLINE';

create table if not exists public.user_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint user_blocks_not_self check (blocker_id <> blocked_id),
  constraint user_blocks_unique_pair unique (blocker_id, blocked_id)
);

create index if not exists user_blocks_blocked_idx
  on public.user_blocks (blocked_id, blocker_id);

alter table public.user_blocks enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_blocks'
      and policyname = 'user_blocks_select_own'
  ) then
    create policy user_blocks_select_own
      on public.user_blocks
      for select
      to authenticated
      using (blocker_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_blocks'
      and policyname = 'user_blocks_insert_own'
  ) then
    create policy user_blocks_insert_own
      on public.user_blocks
      for insert
      to authenticated
      with check (blocker_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_blocks'
      and policyname = 'user_blocks_delete_own'
  ) then
    create policy user_blocks_delete_own
      on public.user_blocks
      for delete
      to authenticated
      using (blocker_id = auth.uid());
  end if;
end
$$;

grant select, insert, delete on public.user_blocks to authenticated;

create table if not exists public.profile_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  provider_id uuid not null references auth.users(id) on delete cascade,
  service_id integer references public.servicios(id) on delete set null,
  reason_category text not null,
  details text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  constraint profile_reports_not_self check (reporter_id <> provider_id),
  constraint profile_reports_reason_check check (
    reason_category in (
      'inappropriate_content',
      'false_information',
      'spam',
      'potential_scam',
      'security_issue',
      'other'
    )
  ),
  constraint profile_reports_status_check check (
    status in ('pending', 'reviewing', 'resolved', 'dismissed')
  )
);

create index if not exists profile_reports_pending_idx
  on public.profile_reports (status, created_at desc);

create index if not exists profile_reports_provider_idx
  on public.profile_reports (provider_id, created_at desc);

alter table public.profile_reports enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profile_reports'
      and policyname = 'profile_reports_select_own'
  ) then
    create policy profile_reports_select_own
      on public.profile_reports
      for select
      to authenticated
      using (reporter_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profile_reports'
      and policyname = 'profile_reports_insert_own'
  ) then
    create policy profile_reports_insert_own
      on public.profile_reports
      for insert
      to authenticated
      with check (reporter_id = auth.uid());
  end if;
end
$$;

grant select, insert on public.profile_reports to authenticated;

create or replace function public.prevent_blocked_chat_messages()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  chat_participant_a uuid;
  chat_participant_b uuid;
begin
  if new.chat_id is null then
    return new;
  end if;

  select participant_a, participant_b
    into chat_participant_a, chat_participant_b
  from public.chats
  where id = new.chat_id;

  if chat_participant_a is null or chat_participant_b is null then
    return new;
  end if;

  if exists (
    select 1
    from public.user_blocks
    where
      (blocker_id = chat_participant_a and blocked_id = chat_participant_b)
      or
      (blocker_id = chat_participant_b and blocked_id = chat_participant_a)
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'CHAT_BLOCKED',
      hint = 'La conversación está bloqueada por uno de sus participantes.';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_chat_blocks on public.mensajes;
create trigger enforce_chat_blocks
before insert on public.mensajes
for each row execute function public.prevent_blocked_chat_messages();
