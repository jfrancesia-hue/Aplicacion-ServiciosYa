-- Evita requerir SELECT para devolver el comprobante de una solicitud anónima.
create or replace function private.guard_consumer_right_request()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_email text := lower(trim(coalesce(new.email, '')));
  expected_prefix text;
begin
  if new.request_type not in ('withdrawal', 'service_cancellation') then
    raise exception 'CONSUMER_REQUEST_TYPE_INVALID';
  end if;

  if normalized_email !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$'
    or char_length(normalized_email) > 254 then
    raise exception 'CONSUMER_REQUEST_EMAIL_INVALID';
  end if;

  if (
    select count(*)
    from public.consumer_right_requests request
    where request.email = normalized_email
      and request.created_at > now() - interval '24 hours'
  ) >= 5 then
    raise exception 'CONSUMER_REQUEST_RATE_LIMIT';
  end if;

  expected_prefix := case
    when new.request_type = 'withdrawal' then 'SY-ARR-'
    else 'SY-BAJ-'
  end;
  if new.request_code !~ ('^' || expected_prefix || '[0-9]{6}-[A-F0-9]{6}$') then
    new.request_code := expected_prefix || to_char(now(), 'YYMMDD') || '-' ||
      upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  end if;

  new.user_id := auth.uid();
  new.email := normalized_email;
  new.operation_reference := left(
    nullif(trim(coalesce(new.operation_reference, '')), ''),
    200
  );
  new.details := left(nullif(trim(coalesce(new.details, '')), ''), 2000);
  new.status := 'received';
  new.admin_notes := null;
  new.resolved_at := null;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.guard_consumer_right_request() from public, anon, authenticated;

create or replace function public.submit_consumer_right_request(
  p_request_type text,
  p_email text,
  p_operation_reference text default null,
  p_details text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  request_id uuid := gen_random_uuid();
  request_created_at timestamptz := now();
  request_code text;
begin
  request_code := 'SY-' || case
    when p_request_type = 'withdrawal' then 'ARR'
    when p_request_type = 'service_cancellation' then 'BAJ'
    else 'INVALID'
  end || '-' || to_char(request_created_at, 'YYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.consumer_right_requests (
    id,
    request_code,
    request_type,
    user_id,
    email,
    operation_reference,
    details,
    created_at,
    updated_at
  ) values (
    request_id,
    request_code,
    p_request_type,
    auth.uid(),
    p_email,
    p_operation_reference,
    p_details,
    request_created_at,
    request_created_at
  );

  return jsonb_build_object(
    'ok', true,
    'request_id', request_id,
    'request_code', request_code,
    'status', 'received',
    'created_at', request_created_at
  );
end;
$$;

revoke all on function public.submit_consumer_right_request(text, text, text, text)
  from public;
grant execute on function public.submit_consumer_right_request(text, text, text, text)
  to anon, authenticated, service_role;
