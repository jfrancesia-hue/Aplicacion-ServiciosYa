-- Reactivacion responsable de prestadores con perfil incompleto.

create table if not exists public.provider_communication_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  marketing_email_enabled boolean not null default true,
  unsubscribed_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.provider_communication_preferences enable row level security;

drop policy if exists provider_communication_preferences_own
  on public.provider_communication_preferences;
create policy provider_communication_preferences_own
  on public.provider_communication_preferences
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists provider_communication_preferences_service_role
  on public.provider_communication_preferences;
create policy provider_communication_preferences_service_role
  on public.provider_communication_preferences
  for all
  to service_role
  using (true)
  with check (true);

grant select, insert, update on public.provider_communication_preferences
  to authenticated;
grant all on public.provider_communication_preferences to service_role;

create table if not exists public.provider_profile_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reminder_number smallint not null
    check (reminder_number between 1 and 3),
  recipient_email text not null,
  missing_fields text[] not null default '{}'::text[],
  profile_score smallint not null check (profile_score between 0 and 100),
  status text not null default 'preparing'
    check (
      status in (
        'preparing',
        'sent',
        'delivered',
        'opened',
        'clicked',
        'bounced',
        'complained',
        'failed'
      )
    ),
  provider_message_id text,
  error_message text,
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_profile_reminders_user_number_unique
    unique (user_id, reminder_number),
  constraint provider_profile_reminders_error_length
    check (error_message is null or char_length(error_message) <= 1000)
);

create unique index if not exists provider_profile_reminders_message_idx
  on public.provider_profile_reminders (provider_message_id)
  where provider_message_id is not null;

create index if not exists provider_profile_reminders_sent_idx
  on public.provider_profile_reminders (sent_at desc);

alter table public.provider_profile_reminders enable row level security;

drop policy if exists provider_profile_reminders_own_read
  on public.provider_profile_reminders;
create policy provider_profile_reminders_own_read
  on public.provider_profile_reminders
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists provider_profile_reminders_service_role
  on public.provider_profile_reminders;
create policy provider_profile_reminders_service_role
  on public.provider_profile_reminders
  for all
  to service_role
  using (true)
  with check (true);

grant select on public.provider_profile_reminders to authenticated;
grant all on public.provider_profile_reminders to service_role;

create or replace function public.touch_provider_engagement_row()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists provider_communication_preferences_touch
  on public.provider_communication_preferences;
create trigger provider_communication_preferences_touch
before update on public.provider_communication_preferences
for each row execute function public.touch_provider_engagement_row();

drop trigger if exists provider_profile_reminders_touch
  on public.provider_profile_reminders;
create trigger provider_profile_reminders_touch
before update on public.provider_profile_reminders
for each row execute function public.touch_provider_engagement_row();

create or replace view public.provider_profile_completeness
with (security_invoker = true)
as
with reminder_stats as (
  select
    reminder.user_id,
    count(*) filter (
      where reminder.status in (
        'sent',
        'delivered',
        'opened',
        'clicked',
        'bounced',
        'complained'
      )
    )::integer as reminders_sent,
    max(reminder.sent_at) as last_reminder_at
  from public.provider_profile_reminders reminder
  group by reminder.user_id
),
profiles as (
  select
    usuario.id as user_id,
    usuario.email,
    coalesce(nullif(trim(usuario.nombre), ''), split_part(usuario.email, '@', 1)) as nombre,
    usuario.actualizado_en,
    coalesce(usuario.created_at, usuario.creado_en, now()) as registered_at,
    (
      case when nullif(trim(usuario.nombre), '') is not null then 15 else 0 end +
      case when usuario.email ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then 10 else 0 end +
      case when length(regexp_replace(coalesce(usuario.celular::text, ''), '[^0-9]', '', 'g')) >= 8 then 15 else 0 end +
      case when coalesce(cardinality(usuario.categoria), 0) > 0 then 15 else 0 end +
      case when nullif(trim(usuario.provincia), '') is not null then 10 else 0 end +
      case when nullif(trim(usuario.ciudad), '') is not null then 10 else 0 end +
      case when nullif(trim(usuario.foto_perfil), '') is not null then 10 else 0 end +
      case when nullif(trim(usuario.descripcion), '') is not null then 5 else 0 end +
      case when nullif(trim(usuario.experiencia), '') is not null then 5 else 0 end +
      case when nullif(trim(usuario.horarios), '') is not null then 5 else 0 end
    )::smallint as profile_score,
    array_remove(array[
      case when nullif(trim(usuario.nombre), '') is null then 'nombre' end,
      case when length(regexp_replace(coalesce(usuario.celular::text, ''), '[^0-9]', '', 'g')) < 8 then 'celular' end,
      case when coalesce(cardinality(usuario.categoria), 0) = 0 then 'especialidad' end,
      case when nullif(trim(usuario.provincia), '') is null then 'provincia' end,
      case when nullif(trim(usuario.ciudad), '') is null then 'ciudad' end,
      case when nullif(trim(usuario.foto_perfil), '') is null then 'foto' end,
      case when nullif(trim(usuario.descripcion), '') is null then 'descripcion' end,
      case when nullif(trim(usuario.experiencia), '') is null then 'experiencia' end,
      case when nullif(trim(usuario.horarios), '') is null then 'horarios' end
    ], null)::text[] as missing_fields
  from public.usuarios usuario
  where
    lower(coalesce(usuario.rol::text, '')) = 'worker'
    or exists (
      select 1
      from public.servicios servicio
      where coalesce(servicio.user_id::text, servicio.usuario_id::text) = usuario.id::text
        and lower(coalesce(servicio.estado, 'activo')) = 'activo'
    )
)
select
  profile.user_id,
  profile.email,
  profile.nombre,
  profile.profile_score,
  profile.missing_fields,
  coalesce(preference.marketing_email_enabled, true) as marketing_email_enabled,
  coalesce(stats.reminders_sent, 0) as reminders_sent,
  stats.last_reminder_at,
  (
    profile.profile_score < 100
    and profile.email ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    and coalesce(preference.marketing_email_enabled, true)
    and coalesce(stats.reminders_sent, 0) < 3
    and profile.registered_at <= now() - interval '24 hours'
    and (
      stats.last_reminder_at is null
      or stats.last_reminder_at <= now() - interval '7 days'
    )
  ) as email_due
from profiles profile
left join public.provider_communication_preferences preference
  on preference.user_id = profile.user_id
left join reminder_stats stats
  on stats.user_id = profile.user_id;

revoke all on public.provider_profile_completeness from public;
grant select on public.provider_profile_completeness to service_role;
