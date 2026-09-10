-- Los teléfonos son identificadores, no cantidades: preservan prefijos y ceros.
drop view if exists public.provider_profile_completeness;

alter table public.usuarios
  alter column celular type text
  using celular::text;

comment on column public.usuarios.celular is
  'Número telefónico en formato de texto para preservar prefijos y ceros.';

create view public.provider_profile_completeness
with (security_invoker = true)
as
with reminder_stats as (
  select
    reminder.user_id,
    count(*) filter (
      where reminder.status in (
        'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained'
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
      case when length(regexp_replace(coalesce(usuario.celular, ''), '[^0-9]', '', 'g')) >= 8 then 15 else 0 end +
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
      case when length(regexp_replace(coalesce(usuario.celular, ''), '[^0-9]', '', 'g')) < 8 then 'celular' end,
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
      where coalesce(servicio.user_id, servicio.usuario_id::text) = usuario.id::text
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

revoke all on public.provider_profile_completeness from public, anon, authenticated;
grant select on public.provider_profile_completeness to service_role;
