-- Evita que la métrica de primera respuesta bloquee los mensajes del prestador.
-- `mensajes` conserva únicamente `created_at`; las columnas heredadas
-- `creado_en` y `fecha_creacion` ya no forman parte del esquema canónico.

create or replace function public.capture_provider_first_response()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requester_id uuid;
  v_first_request_at timestamptz;
  v_response_at timestamptz;
begin
  if new.chat_id is null or new.remitente_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.usuarios as usuario
    where usuario.id = new.remitente_id
      and (
        lower(coalesce(usuario.rol::text, '')) in ('worker', 'prestador')
        or exists (
          select 1
          from public.sy_perfiles as perfil
          where perfil.id::text = usuario.id::text
            and lower(coalesce(perfil.rol::text, '')) in ('worker', 'prestador')
        )
        or exists (
          select 1
          from public.servicios as servicio
          where servicio.user_id = usuario.id::text
             or servicio.usuario_id = usuario.id
        )
      )
  ) then
    return new;
  end if;

  select message.remitente_id, message.created_at
    into v_requester_id, v_first_request_at
  from public.mensajes as message
  where message.chat_id = new.chat_id
    and message.remitente_id is not null
    and message.remitente_id <> new.remitente_id
  order by message.created_at
  limit 1;

  if v_requester_id is null or v_first_request_at is null then
    return new;
  end if;

  if not exists (
    select 1
    from auth.users
    where id = v_requester_id
  ) or not exists (
    select 1
    from auth.users
    where id = new.remitente_id
  ) then
    return new;
  end if;

  v_response_at := coalesce(new.created_at, now());

  if v_response_at < v_first_request_at then
    return new;
  end if;

  insert into public.provider_chat_response_times (
    chat_id,
    provider_id,
    requester_id,
    first_request_at,
    first_response_at,
    response_minutes
  )
  values (
    new.chat_id,
    new.remitente_id,
    v_requester_id,
    v_first_request_at,
    v_response_at,
    extract(epoch from (v_response_at - v_first_request_at)) / 60.0
  )
  on conflict (chat_id, provider_id) do nothing;

  return new;
end;
$$;
