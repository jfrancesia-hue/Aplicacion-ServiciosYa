-- Los guards deben confiar en el rol efectivo, no en el usuario original de
-- una conexión que pudo ejecutar SET ROLE.

begin;

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
  if v_is_trusted then return new; end if;

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

  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;

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

commit;
