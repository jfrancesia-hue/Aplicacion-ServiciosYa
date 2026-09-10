-- Repara funciones creadas antes de que `chats` se consolidara sobre
-- `participant_a` y `participant_b`, y antes de eliminar `acceso_contratado`.
-- Se parte de las definiciones versionadas existentes para conservar su lógica
-- de negocio y se falla explícitamente si una forma esperada ya no coincide.

do $migration$
declare
  v_signature regprocedure;
  v_definition text;
  v_repaired text;
begin
  foreach v_signature in array array[
    'public.send_chat_quote(uuid,numeric,text,text,text,text,text,text,text,numeric,numeric,text,text,timestamptz)'::regprocedure,
    'public.confirm_service_reservation(uuid,text,text)'::regprocedure,
    'public.reconcile_service_reservation_refund(uuid,uuid,text,text,numeric,text)'::regprocedure,
    'public.select_urgent_service_provider_internal(uuid,uuid,uuid)'::regprocedure
  ]
  loop
    v_definition := replace(pg_get_functiondef(v_signature), E'\r\n', E'\n');
    v_repaired := v_definition;

    v_repaired := replace(
      v_repaired,
      'coalesce(v_chat.participant_a, v_chat.usuario_1)',
      'v_chat.participant_a'
    );
    v_repaired := replace(
      v_repaired,
      'coalesce(v_chat.participant_b, v_chat.usuario_2)',
      'v_chat.participant_b'
    );
    v_repaired := replace(
      v_repaired,
      'coalesce(chat.participant_a, chat.usuario_1)',
      'chat.participant_a'
    );
    v_repaired := replace(
      v_repaired,
      'coalesce(chat.participant_b, chat.usuario_2)',
      'chat.participant_b'
    );

    if v_signature = 'public.confirm_service_reservation(uuid,text,text)'::regprocedure then
      v_repaired := replace(
        v_repaired,
        E'  update public.chats\n  set acceso_contratado = true, updated_at = v_now\n  where id = v_payment.chat_id;',
        E'  update public.chats\n  set updated_at = v_now\n  where id = v_payment.chat_id;'
      );
    end if;

    if v_signature = 'public.reconcile_service_reservation_refund(uuid,uuid,text,text,numeric,text)'::regprocedure then
      v_repaired := replace(
        v_repaired,
        E'  update public.chats chat\n  set\n    acceso_contratado = exists (\n      select 1\n      from public.service_confirmation_payments active_payment\n      where active_payment.chat_id = chat.id\n        and active_payment.id <> v_payment.id\n        and active_payment.status = ''approved''\n        and active_payment.job_status in (''confirmed'', ''completed'')\n    ),\n    updated_at = v_now\n  where chat.id = v_payment.chat_id;',
        E'  update public.chats as chat\n  set updated_at = v_now\n  where chat.id = v_payment.chat_id;'
      );
    end if;

    if v_repaired = v_definition then
      raise exception 'CANONICAL_CHAT_REPAIR_NOT_APPLIED: %', v_signature;
    end if;

    if v_repaired like '%usuario_1%'
      or v_repaired like '%usuario_2%'
      or v_repaired like '%acceso_contratado%' then
      raise exception 'LEGACY_CHAT_REFERENCE_REMAINS: %', v_signature;
    end if;

    execute v_repaired;
  end loop;
end;
$migration$;
