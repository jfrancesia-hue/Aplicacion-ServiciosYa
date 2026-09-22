-- Cierra las escaladas de privilegios y la exposición de datos exactos detectadas
-- durante la auditoría previa al lanzamiento. La migración es compatible con el
-- cliente existente para inserciones y mutaciones legítimas, pero retira accesos
-- que nunca debieron formar parte de la API pública.

begin;

-- La autoridad operativa deja de depender de usuarios.rol, que es un dato de
-- perfil. Conservamos los administradores actuales sin exponer esta tabla por API.
create table if not exists private.operational_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

insert into private.operational_admins (user_id)
select id
from public.usuarios
where rol::text = 'admin'
on conflict (user_id) do nothing;

revoke all on table private.operational_admins from public, anon, authenticated;
grant select, insert, update, delete on table private.operational_admins to service_role;

create or replace function private.is_operational_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.operational_admins admin
    where admin.user_id = auth.uid()
  );
$$;

revoke all on function private.is_operational_admin() from public, anon;
grant execute on function private.is_operational_admin() to authenticated, service_role;

-- Un usuario puede completar su perfil y elegir entre cliente/prestador, pero no
-- puede autoasignarse administración, verificación, créditos, suscripción o
-- reputación. Los procesos con service_role y los administradores operativos sí.
alter table public.usuarios alter column suscriptor set default false;

-- El valor anterior por defecto era true y marcó perfiles como Premium aun
-- cuando no existe una suscripción ni una vigencia registrada.
update public.usuarios usuario
set suscriptor = false
where coalesce(usuario.suscriptor, false)
  and not coalesce(usuario.suscripcion_activa_hasta > now(), false)
  and not exists (
    select 1
    from public.suscriptores suscripcion
    where suscripcion.id_suscriptor = usuario.id
  );

create or replace function private.protect_usuario_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_trusted boolean :=
    (
      session_user in ('postgres', 'supabase_admin')
      and coalesce(auth.role(), '') not in ('authenticated', 'anon')
    )
    or coalesce(auth.role(), '') = 'service_role'
    or private.is_operational_admin();
begin
  if v_is_trusted then
    return new;
  end if;

  if auth.uid() is null or new.id is distinct from auth.uid() then
    raise exception 'PROFILE_OWNER_REQUIRED';
  end if;

  if tg_op = 'INSERT' then
    if new.rol::text not in ('guest', 'user', 'worker')
      or coalesce(new.verificado, false)
      or coalesce(new.dni_verificado, false)
      or coalesce(new.creditos, 0) <> 0
      or coalesce(new.suscriptor, false)
      or new.suscripcion_activa_hasta is not null
      or coalesce(new.registropagado, false)
      or coalesce(new.ranking, '[]'::jsonb)
        is distinct from '[{"estrellas": 0, "puntualidad": 0}]'::jsonb
      or coalesce(new.comentarios, '[]'::jsonb) is distinct from '[]'::jsonb
    then
      raise exception 'PROFILE_PRIVILEGED_FIELDS_FORBIDDEN';
    end if;

    if new.usuario_id is distinct from new.id then
      raise exception 'PROFILE_IDENTITY_MISMATCH';
    end if;

    return new;
  end if;

  if new.id is distinct from old.id
    or new.usuario_id is distinct from old.usuario_id
    or new.verificado is distinct from old.verificado
    or new.dni_verificado is distinct from old.dni_verificado
    or new.creditos is distinct from old.creditos
    or new.pago is distinct from old.pago
    or new.suscriptor is distinct from old.suscriptor
    or new.suscripcion_activa_hasta is distinct from old.suscripcion_activa_hasta
    or new.registropagado is distinct from old.registropagado
    or new.ranking is distinct from old.ranking
    or new.comentarios is distinct from old.comentarios
    or (
      new.rol is distinct from old.rol
      and (new.rol::text = 'admin' or old.rol::text = 'admin')
    )
  then
    raise exception 'PROFILE_PRIVILEGED_FIELDS_FORBIDDEN';
  end if;

  return new;
end;
$$;

revoke all on function private.protect_usuario_privileged_fields() from public, anon, authenticated;
grant execute on function private.protect_usuario_privileged_fields() to service_role;

drop trigger if exists protect_usuario_privileged_fields on public.usuarios;
create trigger protect_usuario_privileged_fields
before insert or update on public.usuarios
for each row execute function private.protect_usuario_privileged_fields();

-- Un autenticado sólo ve su perfil, un prestador que decidió hacerlo público o
-- el perfil de la contraparte de uno de sus chats. Ya no puede enumerar clientes.
drop policy if exists user_public_profiles_authenticated_read
  on public.user_public_profiles;
create policy user_public_profiles_authenticated_read
on public.user_public_profiles
for select to authenticated
using (
  id = (select auth.uid())
  or (perfil_publico and rol::text = 'worker')
  or exists (
    select 1
    from public.chats chat
    where (select auth.uid()) in (chat.participant_a, chat.participant_b)
      and user_public_profiles.id in (chat.participant_a, chat.participant_b)
  )
  or (select private.is_operational_admin())
);

-- Sólo los prestadores con perfil completo pueden crear nuevas publicaciones.
drop policy if exists servicios_insert_owner on public.servicios;
create policy servicios_insert_owner
on public.servicios
for insert to authenticated
with check (
  coalesce(usuario_id::text, user_id) = (select auth.uid())::text
  and exists (
    select 1
    from public.usuarios usuario
    where usuario.id = (select auth.uid())
      and usuario.rol::text = 'worker'
      and usuario.perfil_completo
  )
);

-- El catálogo público no incluye punto geográfico, latitud, longitud ni código
-- postal. El motor interno conserva esos datos para calcular cercanía.
create or replace view public.servicios_public
with (security_invoker = true)
as
select
  id,
  titulo,
  descripcion,
  categoria_id,
  usuario_id,
  precio,
  horario,
  categoria,
  user_id,
  veces_contratado,
  calificacion_promedio,
  foto_perfil,
  estado,
  aceptado,
  ciudad,
  barrio,
  country
from public.servicios;

grant insert, update, delete on public.servicios to authenticated;
grant select on public.servicios_public to anon, authenticated;

-- Compatibilidad temporal para las versiones ya publicadas: la vista heredada
-- mantiene sus columnas, pero sólo entrega coordenadas al dueño o a service_role.
-- La tabla base se cerrará con el script post-rollout cuando Play ya distribuya
-- el cliente que consume servicios_public.
create or replace view public.servicios_with_coords
with (security_invoker = true)
as
select
  servicio.id,
  servicio.titulo,
  servicio.descripcion,
  servicio.categoria_id,
  servicio.usuario_id,
  servicio.precio,
  servicio.horario,
  servicio.categoria,
  servicio.user_id,
  servicio.veces_contratado,
  servicio.calificacion_promedio,
  servicio.foto_perfil,
  servicio.estado,
  servicio.aceptado,
  servicio.ciudad,
  servicio.barrio,
  case when coalesce(auth.role(), '') = 'service_role'
      or coalesce(servicio.usuario_id::text, servicio.user_id) = auth.uid()::text
    then servicio.longitud else null end as longitud,
  case when coalesce(auth.role(), '') = 'service_role'
      or coalesce(servicio.usuario_id::text, servicio.user_id) = auth.uid()::text
    then servicio.latitud else null end as latitud,
  case when coalesce(auth.role(), '') = 'service_role'
      or coalesce(servicio.usuario_id::text, servicio.user_id) = auth.uid()::text
    then servicio.postal_code else null end as postal_code,
  servicio.country,
  case when coalesce(auth.role(), '') = 'service_role'
      or coalesce(servicio.usuario_id::text, servicio.user_id) = auth.uid()::text
    then servicio.location else null end::gis.geography(Point, 4326) as location,
  case when (
      coalesce(auth.role(), '') = 'service_role'
      or coalesce(servicio.usuario_id::text, servicio.user_id) = auth.uid()::text
    ) and servicio.location is not null
    then gis.st_x(servicio.location::gis.geometry) else null end as longitude,
  case when (
      coalesce(auth.role(), '') = 'service_role'
      or coalesce(servicio.usuario_id::text, servicio.user_id) = auth.uid()::text
    ) and servicio.location is not null
    then gis.st_y(servicio.location::gis.geometry) else null end as latitude
from public.servicios servicio;

grant select on public.servicios_with_coords to anon, authenticated, service_role;

-- La edición propia obtiene coordenadas únicamente mediante una función que fija
-- el usuario a auth.uid(). No acepta un identificador de otro prestador.
create or replace function public.get_my_services_with_coords()
returns table (
  id bigint,
  titulo text,
  descripcion text,
  categoria_id uuid,
  usuario_id uuid,
  precio numeric,
  horario text,
  categoria text,
  user_id text,
  veces_contratado numeric,
  calificacion_promedio numeric,
  foto_perfil text,
  estado text,
  aceptado boolean,
  ciudad text,
  barrio text,
  postal_code text,
  country text,
  latitude double precision,
  longitude double precision
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    servicio.id,
    servicio.titulo,
    servicio.descripcion,
    servicio.categoria_id,
    servicio.usuario_id,
    servicio.precio,
    servicio.horario,
    servicio.categoria,
    servicio.user_id,
    servicio.veces_contratado,
    servicio.calificacion_promedio,
    servicio.foto_perfil,
    servicio.estado,
    servicio.aceptado,
    servicio.ciudad,
    servicio.barrio,
    servicio.postal_code,
    servicio.country,
    case
      when servicio.location is not null then gis.st_y(servicio.location::gis.geometry)
      else servicio.latitud
    end as latitude,
    case
      when servicio.location is not null then gis.st_x(servicio.location::gis.geometry)
      else servicio.longitud
    end as longitude
  from public.servicios servicio
  where coalesce(servicio.usuario_id::text, servicio.user_id)
    = auth.uid()::text
  order by servicio.id desc;
$$;

revoke all on function public.get_my_services_with_coords() from public, anon;
grant execute on function public.get_my_services_with_coords() to authenticated, service_role;

-- El cliente ya no modifica participantes ni timestamps de chats. El trigger de
-- mensajes es la única vía que actualiza updated_at.
revoke update on public.chats from authenticated;
drop policy if exists chats_update_participants on public.chats;

-- En mensajes sólo se habilita el recibo de lectura y la corrección de la
-- transcripción de un audio propio. IDs, autor, chat, fecha y audio son inmutables.
revoke update on public.mensajes from authenticated;
grant update (leido, contenido) on public.mensajes to authenticated;

create or replace function private.protect_message_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_audio jsonb;
  v_new_audio jsonb;
  v_prefix constant text := '__' || 'TOO' || 'RI_AUDIO_V1__:';
begin
  if (
      session_user in ('postgres', 'supabase_admin')
      and coalesce(auth.role(), '') not in ('authenticated', 'anon')
    )
    or coalesce(auth.role(), '') = 'service_role'
  then
    return new;
  end if;

  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if new.id is distinct from old.id
    or new.chat_id is distinct from old.chat_id
    or new.remitente_id is distinct from old.remitente_id
    or new.created_at is distinct from old.created_at
  then
    raise exception 'CHAT_MESSAGE_IMMUTABLE';
  end if;

  if new.leido is distinct from old.leido then
    if old.remitente_id = auth.uid() or new.leido is not true then
      raise exception 'CHAT_READ_RECEIPT_INVALID';
    end if;
  end if;

  if new.contenido is distinct from old.contenido then
    if old.remitente_id <> auth.uid()
      or left(old.contenido, length(v_prefix)) <> v_prefix
      or left(new.contenido, length(v_prefix)) <> v_prefix
    then
      raise exception 'CHAT_CONTENT_IMMUTABLE';
    end if;

    begin
      v_old_audio := substring(old.contenido from length(v_prefix) + 1)::jsonb;
      v_new_audio := substring(new.contenido from length(v_prefix) + 1)::jsonb;
    exception when others then
      raise exception 'CHAT_AUDIO_INVALID';
    end;

    if v_new_audio->>'kind' <> 'audio'
      or v_new_audio->>'path' is distinct from v_old_audio->>'path'
      or v_new_audio->>'durationMs' is distinct from v_old_audio->>'durationMs'
      or v_new_audio->>'mimeType' is distinct from v_old_audio->>'mimeType'
    then
      raise exception 'CHAT_AUDIO_IMMUTABLE';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.protect_message_update() from public, anon, authenticated;
grant execute on function private.protect_message_update() to service_role;

drop trigger if exists protect_message_update on public.mensajes;
create trigger protect_message_update
before update on public.mensajes
for each row execute function private.protect_message_update();

-- El control de contenido sólo debe ejecutarse al insertar o al corregir el
-- contenido. Un recibo de lectura pertenece al destinatario, no al remitente.
drop trigger if exists enforce_protected_chat_content on public.mensajes;
create trigger enforce_protected_chat_content
before insert or update of contenido on public.mensajes
for each row execute function public.enforce_protected_chat_content();

-- El valor histórico con comillas ("'activo'") hacía que la UI y los filtros
-- interpretaran como desconocidos servicios realmente activos.
update public.servicios
set estado = 'activo'
where lower(trim(replace(coalesce(estado, ''), chr(39), ''))) = 'activo'
  and estado is distinct from 'activo';

create or replace function private.normalize_service_state()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.estado is null or trim(new.estado) = '' then
    new.estado := 'activo';
  elsif lower(trim(replace(new.estado, chr(39), ''))) = 'activo' then
    new.estado := 'activo';
  elsif lower(trim(new.estado)) = 'pausado' then
    new.estado := 'pausado';
  end if;
  return new;
end;
$$;

revoke all on function private.normalize_service_state() from public, anon, authenticated;
grant execute on function private.normalize_service_state() to service_role;

drop trigger if exists normalize_service_state on public.servicios;
create trigger normalize_service_state
before insert or update of estado on public.servicios
for each row execute function private.normalize_service_state();

-- Límite persistente para funciones de IA. No depende de memoria efímera del
-- runtime y sólo puede ser consumido por funciones con service role.
create table if not exists private.ai_rate_limits (
  subject_id text not null,
  scope text not null,
  bucket_start timestamptz not null,
  request_count integer not null default 1 check (request_count > 0),
  primary key (subject_id, scope, bucket_start)
);

revoke all on table private.ai_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on table private.ai_rate_limits to service_role;

create or replace function public.consume_ai_rate_limit(
  p_subject_id text,
  p_scope text,
  p_max_requests integer default 20,
  p_window_seconds integer default 60
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bucket timestamptz;
  v_count integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED';
  end if;
  if nullif(trim(p_subject_id), '') is null
    or nullif(trim(p_scope), '') is null
    or p_max_requests < 1
    or p_window_seconds < 1
  then
    raise exception 'RATE_LIMIT_ARGUMENTS_INVALID';
  end if;

  v_bucket := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into private.ai_rate_limits (
    subject_id, scope, bucket_start, request_count
  ) values (
    trim(p_subject_id), trim(p_scope), v_bucket, 1
  )
  on conflict (subject_id, scope, bucket_start)
  do update set request_count = private.ai_rate_limits.request_count + 1
  returning request_count into v_count;

  if random() < 0.01 then
    delete from private.ai_rate_limits
    where bucket_start < now() - interval '2 days';
  end if;

  return v_count <= p_max_requests;
end;
$$;

revoke all on function public.consume_ai_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_ai_rate_limit(text, text, integer, integer)
  to service_role;

commit;
