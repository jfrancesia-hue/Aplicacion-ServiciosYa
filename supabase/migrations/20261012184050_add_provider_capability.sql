-- Una cuenta siempre puede solicitar trabajos. Ofrecer servicios es una
-- capacidad adicional; `rol` se conserva como compatibilidad con versiones
-- anteriores de la app y con integraciones que todavia esperan `worker`.

begin;

alter table public.usuarios
  add column if not exists provider_enabled boolean not null default false;

comment on column public.usuarios.provider_enabled is
  'Habilita las funciones de prestador sin quitar la capacidad de solicitar trabajos.';

-- Conservamos a todos los prestadores historicos y recuperamos perfiles que
-- ya tenian evidencia profesional aunque su rol legado hubiera quedado en user.
update public.usuarios as usuario
set provider_enabled = true
where usuario.rol::text = 'worker'
   or exists (
     select 1 from public.workers as worker
     where worker.user_id = usuario.id
   )
   or exists (
     select 1 from public.sy_perfiles as perfil
     where perfil.id = usuario.id and perfil.rol::text = 'prestador'
   )
   or exists (
     select 1 from public.servicios as servicio
     where coalesce(servicio.usuario_id::text, servicio.user_id) = usuario.id::text
   )
   or coalesce(cardinality(usuario.categoria), 0) > 0;

create index if not exists usuarios_provider_enabled_idx
  on public.usuarios (id)
  where provider_enabled;

-- La build 98 sigue escribiendo rol=worker. La build 99 escribe la capacidad
-- explicita. Durante la transicion mantenemos ambos campos sincronizados para
-- que ninguna version publicada ni funcion heredada deje de reconocer al
-- prestador. Ser worker nunca impide solicitar trabajos.
create or replace function private.normalize_provider_capability()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.rol::text = 'worker' or coalesce(new.provider_enabled, false) then
    new.provider_enabled := true;
    if new.rol::text = 'user' then
      new.rol := 'worker'::public.user_role;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.normalize_provider_capability() from public;

drop trigger if exists normalize_provider_capability on public.usuarios;
create trigger normalize_provider_capability
before insert or update of rol, provider_enabled on public.usuarios
for each row execute function private.normalize_provider_capability();

-- Perfil publico: expone la capacidad, nunca datos privados.
alter table public.user_public_profiles
  add column if not exists provider_enabled boolean not null default false;

update public.user_public_profiles as perfil
set provider_enabled = usuario.provider_enabled
from public.usuarios as usuario
where usuario.id = perfil.id
  and perfil.provider_enabled is distinct from usuario.provider_enabled;

create or replace function public.sync_user_public_profile()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.user_public_profiles where id = old.id;
    return old;
  end if;

  insert into public.user_public_profiles (
    id, nombre, apellido, edad, foto_perfil, provincia, ciudad, barrio, rol,
    provider_enabled, categoria, horarios, precio, descripcion, experiencia,
    experiencia_academica, verificado, suscriptor, antiguedad,
    perfil_publico, creado_en, updated_at
  ) values (
    new.id, new.nombre, new.apellido, new.edad, new.foto_perfil,
    new.provincia, new.ciudad, new.barrio, new.rol,
    new.provider_enabled, new.categoria, new.horarios, new.precio,
    new.descripcion, new.experiencia, new.experiencia_academica,
    new.verificado, new.suscriptor, new.antiguedad,
    new."perfilPublico", new.creado_en, now()
  )
  on conflict (id) do update set
    nombre = excluded.nombre,
    apellido = excluded.apellido,
    edad = excluded.edad,
    foto_perfil = excluded.foto_perfil,
    provincia = excluded.provincia,
    ciudad = excluded.ciudad,
    barrio = excluded.barrio,
    rol = excluded.rol,
    provider_enabled = excluded.provider_enabled,
    categoria = excluded.categoria,
    horarios = excluded.horarios,
    precio = excluded.precio,
    descripcion = excluded.descripcion,
    experiencia = excluded.experiencia,
    experiencia_academica = excluded.experiencia_academica,
    verificado = excluded.verificado,
    suscriptor = excluded.suscriptor,
    antiguedad = excluded.antiguedad,
    perfil_publico = excluded.perfil_publico,
    creado_en = excluded.creado_en,
    updated_at = now();

  return new;
end;
$$;

revoke all on function public.sync_user_public_profile() from public, anon, authenticated;

drop policy if exists user_public_profiles_anon_read
  on public.user_public_profiles;
create policy user_public_profiles_anon_read
on public.user_public_profiles for select to anon
using (perfil_publico and provider_enabled);

drop policy if exists user_public_profiles_authenticated_read
  on public.user_public_profiles;
create policy user_public_profiles_authenticated_read
on public.user_public_profiles for select to authenticated
using (
  id = (select auth.uid())
  or (perfil_publico and provider_enabled)
  or exists (
    select 1
    from public.chats as chat
    where (select auth.uid()) in (chat.participant_a, chat.participant_b)
      and user_public_profiles.id in (chat.participant_a, chat.participant_b)
  )
  or (select private.is_operational_admin())
);

-- Publicar servicios depende de la capacidad y del perfil completo. Solicitar
-- trabajos no depende de esta bandera y continua disponible para todos.
drop policy if exists servicios_insert_owner on public.servicios;
create policy servicios_insert_owner
on public.servicios for insert to authenticated
with check (
  coalesce(usuario_id::text, user_id) = (select auth.uid())::text
  and exists (
    select 1
    from public.usuarios as usuario
    where usuario.id = (select auth.uid())
      and usuario.provider_enabled
      and usuario.perfil_completo
  )
);

-- La columna nueva forma parte de una tabla ya expuesta; se mantiene el mismo
-- acceso de lectura/escritura existente, siempre sujeto a sus politicas RLS.
grant select, insert, update on public.usuarios to authenticated;
grant select on public.user_public_profiles to anon, authenticated;
grant all on public.usuarios, public.user_public_profiles to service_role;

commit;
