-- La protección del chat no debe depender de `chats.acceso_contratado`,
-- columna eliminada al consolidar los participantes canónicos.

create or replace function public.enforce_protected_chat_content()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_content text := coalesce(new.contenido, '');
  v_check text := coalesce(new.contenido, '');
  v_payload jsonb;
  v_paid boolean := false;
  v_is_quote boolean := false;
  v_is_provider boolean := false;
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if auth.uid() is null or new.remitente_id <> auth.uid() then
    raise exception 'CHAT_SENDER_INVALID';
  end if;

  if not exists (
    select 1
    from public.chats as chat
    where chat.id = new.chat_id
      and auth.uid() in (chat.participant_a, chat.participant_b)
  ) then
    raise exception 'CHAT_PARTICIPANT_REQUIRED';
  end if;

  select exists (
    select 1
    from public.service_confirmation_payments as payment
    where payment.chat_id = new.chat_id
      and payment.status = 'approved'
  ) into v_paid;

  if left(v_content, 15) = ('__TOO' || 'RI_QUOTE__') then
    v_is_quote := true;
    begin
      v_payload := substring(v_content from 16)::jsonb;
    exception when others then
      raise exception 'CHAT_QUOTE_INVALID';
    end;
    v_check := concat_ws(
      ' ',
      v_payload->>'scope',
      v_payload->>'materials',
      v_payload->>'timeframe',
      v_payload->>'warranty',
      v_payload->>'validUntil',
      v_payload->>'notes'
    );
    select exists (
      select 1
      from public.usuarios as usuario
      where usuario.id = auth.uid()
        and lower(usuario.rol::text) in ('worker', 'prestador')
    ) or exists (
      select 1
      from public.sy_perfiles as perfil
      where perfil.id::text = auth.uid()::text
        and lower(perfil.rol::text) in ('worker', 'prestador')
    ) into v_is_provider;
    if not v_is_provider then
      raise exception 'CHAT_QUOTE_PROVIDER_ONLY';
    end if;
  elsif left(v_content, 19) = ('__TOO' || 'RI_AUDIO_V1__:') then
    begin
      v_payload := substring(v_content from 20)::jsonb;
    exception when others then
      raise exception 'CHAT_AUDIO_INVALID';
    end;
    v_check := coalesce(v_payload->>'transcript', '');
    if not v_paid and trim(v_check) = '' then
      raise exception 'CHAT_AUDIO_REQUIRES_TRANSCRIPTION';
    end if;
  end if;

  if v_paid then
    return new;
  end if;

  if v_check ~* '[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}'
    or v_check ~* '(https?://|www\.|wa\.me/|t\.me/|instagram\.com|facebook\.com|messenger\.com)'
    or v_check ~* '(whats?app|telegram|instagram|facebook|messenger)'
    or v_check ~ '([+]?[0-9][[:space:]().-]*){7,}' then
    raise exception 'CHAT_CONTACT_BLOCKED';
  end if;

  if not v_is_quote and (
    v_check ~ E'\\$[[:space:]]*[0-9]'
    or v_check ~* '[0-9][0-9.,]*[[:space:]]*(ars|pesos?)'
    or (
      v_check ~* '(precio|monto|tarifa|total|cobro|cobrar|cuesta|sale|mano[[:space:]]+de[[:space:]]+obra)'
      and v_check ~ '[0-9]{2,}'
    )
  ) then
    raise exception 'CHAT_PRICE_REQUIRES_QUOTE';
  end if;

  return new;
end;
$$;
