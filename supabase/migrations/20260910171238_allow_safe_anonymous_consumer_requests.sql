-- El botón legal está disponible antes del inicio de sesión. La validación y
-- el límite se aplican en un trigger no invocable desde el Data API.
create or replace function private.guard_consumer_right_request()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_email text := lower(trim(coalesce(new.email, '')));
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

  new.request_code := 'SY-' || case
    when new.request_type = 'withdrawal' then 'ARR'
    else 'BAJ'
  end || '-' || to_char(now(), 'YYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
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

drop trigger if exists guard_consumer_right_request
  on public.consumer_right_requests;
create trigger guard_consumer_right_request
before insert on public.consumer_right_requests
for each row execute function private.guard_consumer_right_request();

grant insert on public.consumer_right_requests to anon, authenticated;

drop policy if exists consumer_right_requests_public_insert
  on public.consumer_right_requests;
create policy consumer_right_requests_public_insert
on public.consumer_right_requests for insert to anon, authenticated
with check (
  user_id is not distinct from (select auth.uid())
  and status = 'received'
  and admin_notes is null
  and resolved_at is null
);

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
  created_request public.consumer_right_requests%rowtype;
begin
  insert into public.consumer_right_requests (
    request_code,
    request_type,
    user_id,
    email,
    operation_reference,
    details
  ) values (
    'pending',
    p_request_type,
    auth.uid(),
    p_email,
    p_operation_reference,
    p_details
  ) returning * into created_request;

  return jsonb_build_object(
    'ok', true,
    'request_id', created_request.id,
    'request_code', created_request.request_code,
    'status', created_request.status,
    'created_at', created_request.created_at
  );
end;
$$;

revoke all on function public.submit_consumer_right_request(text, text, text, text)
  from public;
grant execute on function public.submit_consumer_right_request(text, text, text, text)
  to anon, authenticated, service_role;

drop function if exists private.submit_consumer_right_request(text, text, text, text);
