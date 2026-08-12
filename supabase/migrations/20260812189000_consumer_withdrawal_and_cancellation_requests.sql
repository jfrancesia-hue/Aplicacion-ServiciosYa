-- Solicitudes públicas de arrepentimiento y baja, sin exigir inicio de sesión.

create table if not exists public.consumer_right_requests (
  id uuid primary key default gen_random_uuid(),
  request_code text not null unique,
  request_type text not null check (
    request_type in ('withdrawal', 'service_cancellation')
  ),
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  operation_reference text,
  details text,
  status text not null default 'received' check (
    status in ('received', 'reviewing', 'completed', 'rejected')
  ),
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists consumer_right_requests_queue_idx
  on public.consumer_right_requests (status, created_at desc);

alter table public.consumer_right_requests enable row level security;

drop policy if exists consumer_right_requests_own_or_admin_read
  on public.consumer_right_requests;
create policy consumer_right_requests_own_or_admin_read
  on public.consumer_right_requests for select to authenticated
  using (auth.uid() = user_id or public.is_operational_admin());

drop policy if exists consumer_right_requests_service_role_all
  on public.consumer_right_requests;
create policy consumer_right_requests_service_role_all
  on public.consumer_right_requests for all to service_role
  using (true) with check (true);

grant select on public.consumer_right_requests to authenticated;
grant all on public.consumer_right_requests to service_role;

create or replace function public.submit_consumer_right_request(
  p_request_type text,
  p_email text,
  p_operation_reference text default null,
  p_details text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_reference text := left(nullif(trim(coalesce(p_operation_reference, '')), ''), 200);
  v_details text := left(nullif(trim(coalesce(p_details, '')), ''), 2000);
  v_request public.consumer_right_requests%rowtype;
  v_code text;
begin
  if p_request_type not in ('withdrawal', 'service_cancellation') then
    raise exception 'CONSUMER_REQUEST_TYPE_INVALID';
  end if;
  if v_email !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$'
    or char_length(v_email) > 254 then
    raise exception 'CONSUMER_REQUEST_EMAIL_INVALID';
  end if;

  if (
    select count(*)
    from public.consumer_right_requests r
    where r.email = v_email
      and r.created_at > now() - interval '24 hours'
  ) >= 5 then
    raise exception 'CONSUMER_REQUEST_RATE_LIMIT';
  end if;

  v_code := 'SY-' || case
    when p_request_type = 'withdrawal' then 'ARR'
    else 'BAJ'
  end || '-' || to_char(now(), 'YYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.consumer_right_requests (
    request_code,
    request_type,
    user_id,
    email,
    operation_reference,
    details
  ) values (
    v_code,
    p_request_type,
    auth.uid(),
    v_email,
    v_reference,
    v_details
  ) returning * into v_request;

  return jsonb_build_object(
    'ok', true,
    'request_id', v_request.id,
    'request_code', v_request.request_code,
    'status', v_request.status,
    'created_at', v_request.created_at
  );
end;
$$;

revoke all on function public.submit_consumer_right_request(text, text, text, text)
  from public;
grant execute on function public.submit_consumer_right_request(text, text, text, text)
  to anon, authenticated, service_role;
