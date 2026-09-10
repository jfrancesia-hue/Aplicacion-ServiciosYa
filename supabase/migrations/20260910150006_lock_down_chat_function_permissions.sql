-- Los RPC internos reparados no deben heredar EXECUTE para PUBLIC/anon.
-- `send_chat_quote` es el único RPC de este grupo invocado por la app.

revoke all on function public.capture_provider_first_response()
  from public, anon, authenticated, service_role;
revoke all on function public.enforce_protected_chat_content()
  from public, anon, authenticated, service_role;

revoke all on function public.send_chat_quote(
  uuid,
  numeric,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  numeric,
  numeric,
  text,
  text,
  timestamptz
) from public, anon, authenticated, service_role;
grant execute on function public.send_chat_quote(
  uuid,
  numeric,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  numeric,
  numeric,
  text,
  text,
  timestamptz
) to authenticated, service_role;

revoke all on function public.confirm_service_reservation(uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.confirm_service_reservation(uuid, text, text)
  to service_role;

revoke all on function public.reconcile_service_reservation_refund(
  uuid,
  uuid,
  text,
  text,
  numeric,
  text
) from public, anon, authenticated, service_role;
grant execute on function public.reconcile_service_reservation_refund(
  uuid,
  uuid,
  text,
  text,
  numeric,
  text
) to service_role;

revoke all on function public.select_urgent_service_provider_internal(
  uuid,
  uuid,
  uuid
) from public, anon, authenticated, service_role;
grant execute on function public.select_urgent_service_provider_internal(
  uuid,
  uuid,
  uuid
) to service_role;
