-- Ajuste posterior al backfill: las cuentas invitadas nunca pueden prestar y,
-- mientras existan builds anteriores a la 99, la marca legacy `worker` debe
-- acompanar a toda capacidad de prestador para no romper RPC historicas.

begin;

create or replace function private.normalize_provider_capability()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.rol::text = 'guest' then
    new.provider_enabled := false;
    return new;
  end if;

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

update public.usuarios
set provider_enabled = false
where rol::text = 'guest' and provider_enabled;

update public.usuarios
set rol = 'worker'::public.user_role
where provider_enabled and rol::text = 'user';

-- Fuerza la resincronizacion del espejo publico despues de reconciliar roles.
update public.user_public_profiles as perfil
set
  rol = usuario.rol,
  provider_enabled = usuario.provider_enabled,
  updated_at = now()
from public.usuarios as usuario
where usuario.id = perfil.id
  and (
    perfil.rol is distinct from usuario.rol
    or perfil.provider_enabled is distinct from usuario.provider_enabled
  );

commit;
