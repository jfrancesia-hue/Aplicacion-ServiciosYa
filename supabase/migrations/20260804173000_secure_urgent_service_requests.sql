-- Pedido urgente explicito, limitado y seleccionado desde servidor.

do $$
begin
  if exists (
    select 1
    from cron.job
    where jobname = 'process-urgent-work-alerts-every-minute'
  ) then
    perform cron.unschedule('process-urgent-work-alerts-every-minute');
  end if;
end
$$;

update public.urgent_work_alerts
set status = 'cancelled', updated_at = now()
where status in ('pending', 'escalation_ready');

drop policy if exists "urgent_work_alerts_authenticated_insert"
  on public.urgent_work_alerts;
revoke insert, update, delete on public.urgent_work_alerts
  from authenticated, anon;

create table if not exists public.urgent_service_requests (
  id uuid primary key default gen_random_uuid(),
  request_code text not null unique,
  client_id uuid not null references auth.users(id) on delete restrict,
  category text not null,
  description text not null,
  urgency_window text not null
    check (urgency_window in ('now', 'today')),
  city text not null,
  province text not null,
  status text not null default 'open'
    check (
      status in (
        'open',
        'responded',
        'matched',
        'no_candidates',
        'expired',
        'cancelled'
      )
    ),
  selected_provider_id uuid references auth.users(id) on delete set null,
  chat_id uuid references public.chats(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '45 minutes'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  matched_at timestamptz,
  constraint urgent_service_requests_category_length
    check (char_length(category) between 2 and 120),
  constraint urgent_service_requests_description_length
    check (char_length(description) between 10 and 600),
  constraint urgent_service_requests_city_length
    check (char_length(city) between 2 and 120),
  constraint urgent_service_requests_province_length
    check (char_length(province) between 2 and 120)
);

create index if not exists urgent_service_requests_client_idx
  on public.urgent_service_requests (client_id, created_at desc);
create index if not exists urgent_service_requests_active_idx
  on public.urgent_service_requests (status, expires_at)
  where status in ('open', 'responded');

create table if not exists public.urgent_service_candidates (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null
    references public.urgent_service_requests(id) on delete cascade,
  provider_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'notified'
    check (
      status in (
        'notified',
        'interested',
        'unavailable',
        'selected',
        'expired'
      )
    ),
  push_status text,
  push_ticket_id text,
  notified_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (request_id, provider_id)
);

create index if not exists urgent_service_candidates_provider_idx
  on public.urgent_service_candidates (provider_id, status, notified_at desc);

alter table public.urgent_service_requests enable row level security;
alter table public.urgent_service_candidates enable row level security;

drop policy if exists urgent_service_requests_participants_read
  on public.urgent_service_requests;
create policy urgent_service_requests_participants_read
  on public.urgent_service_requests
  for select
  to authenticated
  using (
    client_id = auth.uid()
    or selected_provider_id = auth.uid()
  );

drop policy if exists urgent_service_requests_service_role
  on public.urgent_service_requests;
create policy urgent_service_requests_service_role
  on public.urgent_service_requests
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists urgent_service_candidates_participants_read
  on public.urgent_service_candidates;
create policy urgent_service_candidates_participants_read
  on public.urgent_service_candidates
  for select
  to authenticated
  using (provider_id = auth.uid());

drop policy if exists urgent_service_candidates_service_role
  on public.urgent_service_candidates;
create policy urgent_service_candidates_service_role
  on public.urgent_service_candidates
  for all
  to service_role
  using (true)
  with check (true);

grant select on public.urgent_service_requests to authenticated;
grant select on public.urgent_service_candidates to authenticated;
grant all on public.urgent_service_requests to service_role;
grant all on public.urgent_service_candidates to service_role;

drop trigger if exists urgent_service_requests_touch
  on public.urgent_service_requests;
create trigger urgent_service_requests_touch
before update on public.urgent_service_requests
for each row execute function public.touch_provider_engagement_row();

create or replace function public.create_urgent_service_request_internal(
  p_client_id uuid,
  p_category text,
  p_description text,
  p_urgency_window text,
  p_city text,
  p_province text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_id uuid := gen_random_uuid();
  v_request_code text;
  v_candidate_count integer;
  v_candidates jsonb;
begin
  if p_client_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if char_length(trim(coalesce(p_category, ''))) not between 2 and 120
    or char_length(trim(coalesce(p_description, ''))) not between 10 and 600
    or char_length(trim(coalesce(p_city, ''))) not between 2 and 120
    or char_length(trim(coalesce(p_province, ''))) not between 2 and 120
    or p_urgency_window not in ('now', 'today') then
    raise exception 'INVALID_URGENT_REQUEST';
  end if;

  perform pg_advisory_xact_lock(hashtext('urgent:' || p_client_id::text));

  update public.urgent_service_requests
  set status = 'expired'
  where client_id = p_client_id
    and status in ('open', 'responded')
    and expires_at <= now();

  if exists (
    select 1
    from public.urgent_service_requests request
    where request.client_id = p_client_id
      and request.status in ('open', 'responded')
      and request.expires_at > now()
  ) then
    raise exception 'URGENT_REQUEST_ALREADY_ACTIVE';
  end if;

  if (
    select count(*)
    from public.urgent_service_requests request
    where request.client_id = p_client_id
      and request.created_at >= now() - interval '24 hours'
  ) >= 3 then
    raise exception 'URGENT_REQUEST_RATE_LIMIT';
  end if;

  v_request_code := 'URG-' ||
    upper(substr(replace(v_request_id::text, '-', ''), 1, 8));

  insert into public.urgent_service_requests (
    id,
    request_code,
    client_id,
    category,
    description,
    urgency_window,
    city,
    province
  ) values (
    v_request_id,
    v_request_code,
    p_client_id,
    trim(p_category),
    trim(p_description),
    p_urgency_window,
    trim(p_city),
    trim(p_province)
  );

  insert into public.urgent_service_candidates (request_id, provider_id)
  select v_request_id, provider.id
  from public.usuarios provider
  join public.workers worker on worker.user_id = provider.id
  where provider.id <> p_client_id
    and lower(coalesce(provider.rol::text, '')) = 'worker'
    and provider."perfilPublico" is true
    and provider.expo_token is not null
    and worker.status = 'ONLINE'
    and (
      worker.available_until > now()
      or (
        worker.available_until is null
        and worker.last_seen_at >= now() - interval '30 minutes'
      )
    )
    and exists (
      select 1
      from unnest(coalesce(provider.categoria, '{}'::text[])) category_name
      where translate(lower(trim(category_name)), 'áéíóúüñ', 'aeiouun') =
        translate(lower(trim(p_category)), 'áéíóúüñ', 'aeiouun')
    )
    and translate(lower(trim(coalesce(provider.provincia, ''))), 'áéíóúüñ', 'aeiouun') =
      translate(lower(trim(p_province)), 'áéíóúüñ', 'aeiouun')
    and not exists (
      select 1
      from public.user_blocks block
      where
        (block.blocker_id = p_client_id and block.blocked_id = provider.id)
        or
        (block.blocker_id = provider.id and block.blocked_id = p_client_id)
    )
  order by
    case
      when translate(lower(trim(coalesce(provider.ciudad, ''))), 'áéíóúüñ', 'aeiouun') =
        translate(lower(trim(p_city)), 'áéíóúüñ', 'aeiouun')
      then 0 else 1
    end,
    case when provider.verificado is true then 0 else 1 end,
    worker.last_seen_at desc nulls last
  limit 3;

  get diagnostics v_candidate_count = row_count;

  if v_candidate_count = 0 then
    update public.urgent_service_requests
    set status = 'no_candidates'
    where id = v_request_id;
  end if;

  select coalesce(
    jsonb_agg(jsonb_build_object(
      'candidate_id', candidate.id,
      'provider_id', candidate.provider_id,
      'expo_token', provider.expo_token
    )),
    '[]'::jsonb
  )
  into v_candidates
  from public.urgent_service_candidates candidate
  join public.usuarios provider on provider.id = candidate.provider_id
  where candidate.request_id = v_request_id;

  return jsonb_build_object(
    'ok', true,
    'request_id', v_request_id,
    'request_code', v_request_code,
    'status', case when v_candidate_count = 0 then 'no_candidates' else 'open' end,
    'candidate_count', v_candidate_count,
    'candidates', v_candidates,
    'expires_at', now() + interval '45 minutes'
  );
end;
$$;

revoke all on function public.create_urgent_service_request_internal(
  uuid, text, text, text, text, text
) from public;
grant execute on function public.create_urgent_service_request_internal(
  uuid, text, text, text, text, text
) to service_role;

create or replace function public.get_provider_urgent_requests_internal(
  p_provider_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requests jsonb;
begin
  update public.urgent_service_candidates candidate
  set status = 'expired'
  from public.urgent_service_requests request
  where candidate.request_id = request.id
    and candidate.provider_id = p_provider_id
    and candidate.status = 'notified'
    and (
      request.expires_at <= now()
      or request.status in ('matched', 'expired', 'cancelled')
    );

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'candidate_id', candidate.id,
        'request_id', request.id,
        'request_code', request.request_code,
        'category', request.category,
        'description', request.description,
        'urgency_window', request.urgency_window,
        'city', request.city,
        'province', request.province,
        'expires_at', request.expires_at,
        'created_at', request.created_at,
        'candidate_status', candidate.status
      )
      order by request.created_at desc
    ),
    '[]'::jsonb
  )
  into v_requests
  from public.urgent_service_candidates candidate
  join public.urgent_service_requests request on request.id = candidate.request_id
  where candidate.provider_id = p_provider_id
    and candidate.status = 'notified'
    and request.status in ('open', 'responded')
    and request.expires_at > now();

  return jsonb_build_object('ok', true, 'requests', v_requests);
end;
$$;

revoke all on function public.get_provider_urgent_requests_internal(uuid)
  from public;
grant execute on function public.get_provider_urgent_requests_internal(uuid)
  to service_role;

create or replace function public.respond_urgent_service_request_internal(
  p_provider_id uuid,
  p_request_id uuid,
  p_interested boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.urgent_service_requests%rowtype;
  v_candidate public.urgent_service_candidates%rowtype;
  v_client_token text;
begin
  select * into v_request
  from public.urgent_service_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'URGENT_REQUEST_NOT_FOUND';
  end if;

  select * into v_candidate
  from public.urgent_service_candidates
  where request_id = p_request_id
    and provider_id = p_provider_id
  for update;

  if not found then
    raise exception 'URGENT_RESPONSE_FORBIDDEN';
  end if;
  if v_candidate.status <> 'notified' then
    raise exception 'URGENT_REQUEST_ALREADY_ANSWERED';
  end if;
  if v_request.status not in ('open', 'responded')
    or v_request.expires_at <= now() then
    update public.urgent_service_candidates
    set status = 'expired', responded_at = now()
    where id = v_candidate.id;
    raise exception 'URGENT_REQUEST_EXPIRED';
  end if;

  update public.urgent_service_candidates
  set
    status = case when p_interested then 'interested' else 'unavailable' end,
    responded_at = now()
  where id = v_candidate.id;

  if p_interested then
    update public.urgent_service_requests
    set status = 'responded'
    where id = v_request.id
      and status = 'open';
  end if;

  select expo_token into v_client_token
  from public.usuarios
  where id = v_request.client_id;

  return jsonb_build_object(
    'ok', true,
    'status', case when p_interested then 'interested' else 'unavailable' end,
    'request_code', v_request.request_code,
    'category', v_request.category,
    'client_id', v_request.client_id,
    'client_expo_token', v_client_token
  );
end;
$$;

revoke all on function public.respond_urgent_service_request_internal(
  uuid, uuid, boolean
) from public;
grant execute on function public.respond_urgent_service_request_internal(
  uuid, uuid, boolean
) to service_role;

create or replace function public.get_client_urgent_request_internal(
  p_client_id uuid,
  p_request_id uuid default null,
  p_category text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.urgent_service_requests%rowtype;
  v_providers jsonb;
begin
  select * into v_request
  from public.urgent_service_requests request
  where request.client_id = p_client_id
    and (p_request_id is null or request.id = p_request_id)
    and (
      p_request_id is not null
      or p_category is null
      or translate(lower(trim(request.category)), 'áéíóúüñ', 'aeiouun') =
        translate(lower(trim(p_category)), 'áéíóúüñ', 'aeiouun')
    )
  order by request.created_at desc
  limit 1
  for update;

  if not found then
    return jsonb_build_object('ok', true, 'request', null);
  end if;

  if v_request.status in ('open', 'responded')
    and v_request.expires_at <= now() then
    update public.urgent_service_requests
    set status = 'expired'
    where id = v_request.id;
    update public.urgent_service_candidates
    set status = 'expired'
    where request_id = v_request.id
      and status in ('notified', 'interested');
    v_request.status := 'expired';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'provider_id', provider.id,
        'name', coalesce(
          nullif(trim(concat_ws(' ', provider.nombre, provider.apellido)), ''),
          'Prestador'
        ),
        'photo_url', provider.foto_perfil,
        'verified', coalesce(provider.verificado, false),
        'candidate_status', candidate.status,
        'responded_at', candidate.responded_at
      )
      order by candidate.responded_at asc
    ) filter (where candidate.status in ('interested', 'selected')),
    '[]'::jsonb
  )
  into v_providers
  from public.urgent_service_candidates candidate
  join public.usuarios provider on provider.id = candidate.provider_id
  where candidate.request_id = v_request.id;

  return jsonb_build_object(
    'ok', true,
    'request', jsonb_build_object(
      'id', v_request.id,
      'request_code', v_request.request_code,
      'category', v_request.category,
      'description', v_request.description,
      'urgency_window', v_request.urgency_window,
      'city', v_request.city,
      'province', v_request.province,
      'status', v_request.status,
      'expires_at', v_request.expires_at,
      'chat_id', v_request.chat_id,
      'selected_provider_id', v_request.selected_provider_id,
      'providers', v_providers
    )
  );
end;
$$;

revoke all on function public.get_client_urgent_request_internal(
  uuid, uuid, text
) from public;
grant execute on function public.get_client_urgent_request_internal(
  uuid, uuid, text
) to service_role;

create or replace function public.select_urgent_service_provider_internal(
  p_client_id uuid,
  p_request_id uuid,
  p_provider_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.urgent_service_requests%rowtype;
  v_candidate public.urgent_service_candidates%rowtype;
  v_chat_id uuid;
  v_participant_a uuid := least(p_client_id, p_provider_id);
  v_participant_b uuid := greatest(p_client_id, p_provider_id);
  v_provider_name text;
  v_provider_token text;
  v_content text;
begin
  select * into v_request
  from public.urgent_service_requests
  where id = p_request_id
  for update;

  if not found or v_request.client_id <> p_client_id then
    raise exception 'URGENT_SELECTION_FORBIDDEN';
  end if;
  if v_request.status = 'matched'
    and v_request.selected_provider_id = p_provider_id then
    select
      coalesce(
        nullif(trim(concat_ws(' ', nombre, apellido)), ''),
        'Prestador'
      ),
      expo_token
    into v_provider_name, v_provider_token
    from public.usuarios
    where id = p_provider_id;

    return jsonb_build_object(
      'ok', true,
      'already_matched', true,
      'chat_id', v_request.chat_id,
      'provider_id', p_provider_id,
      'provider_name', v_provider_name,
      'provider_expo_token', v_provider_token,
      'participant_a', v_participant_a,
      'participant_b', v_participant_b,
      'request_code', v_request.request_code
    );
  end if;
  if v_request.status not in ('open', 'responded')
    or v_request.expires_at <= now() then
    raise exception 'URGENT_REQUEST_EXPIRED';
  end if;

  select * into v_candidate
  from public.urgent_service_candidates
  where request_id = p_request_id
    and provider_id = p_provider_id
  for update;

  if not found or v_candidate.status <> 'interested' then
    raise exception 'PROVIDER_NOT_INTERESTED';
  end if;
  if exists (
    select 1 from public.user_blocks block
    where
      (block.blocker_id = p_client_id and block.blocked_id = p_provider_id)
      or
      (block.blocker_id = p_provider_id and block.blocked_id = p_client_id)
  ) then
    raise exception 'CHAT_BLOCKED';
  end if;

  perform pg_advisory_xact_lock(
    hashtext('chat:' || v_participant_a::text || ':' || v_participant_b::text)
  );

  select chat.id into v_chat_id
  from public.chats chat
  where
    coalesce(chat.participant_a, chat.usuario_1) = v_participant_a
    and coalesce(chat.participant_b, chat.usuario_2) = v_participant_b
  limit 1;

  if v_chat_id is null then
    insert into public.chats (participant_a, participant_b)
    values (v_participant_a, v_participant_b)
    returning id into v_chat_id;
  end if;

  update public.urgent_service_candidates
  set status = case
    when provider_id = p_provider_id then 'selected'
    else 'expired'
  end
  where request_id = v_request.id
    and status in ('notified', 'interested');

  update public.urgent_service_requests
  set
    status = 'matched',
    selected_provider_id = p_provider_id,
    chat_id = v_chat_id,
    matched_at = now()
  where id = v_request.id;

  select
    coalesce(
      nullif(trim(concat_ws(' ', nombre, apellido)), ''),
      'Prestador'
    ),
    expo_token
  into v_provider_name, v_provider_token
  from public.usuarios
  where id = p_provider_id;

  v_content := '__SERVICIOSYA_SYSTEM_V1__:' || jsonb_build_object(
    'kind', 'urgent_request_matched',
    'title', 'Pedido urgente conectado',
    'text', 'El pedido ' || v_request.request_code || ' fue conectado con ' ||
      v_provider_name || '. Conversen los detalles y el prestador puede enviar su presupuesto desde este chat.',
    'actorId', p_client_id,
    'eventId', v_request.id
  )::text;

  insert into public.mensajes (chat_id, remitente_id, contenido)
  values (v_chat_id, p_client_id, v_content);

  update public.chats set updated_at = now() where id = v_chat_id;

  return jsonb_build_object(
    'ok', true,
    'already_matched', false,
    'chat_id', v_chat_id,
    'provider_id', p_provider_id,
    'provider_name', v_provider_name,
    'provider_expo_token', v_provider_token,
    'client_id', p_client_id,
    'participant_a', v_participant_a,
    'participant_b', v_participant_b,
    'request_code', v_request.request_code
  );
end;
$$;

revoke all on function public.select_urgent_service_provider_internal(
  uuid, uuid, uuid
) from public;
grant execute on function public.select_urgent_service_provider_internal(
  uuid, uuid, uuid
) to service_role;

create or replace function public.cancel_urgent_service_request_internal(
  p_client_id uuid,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.urgent_service_requests%rowtype;
begin
  select * into v_request
  from public.urgent_service_requests
  where id = p_request_id
  for update;

  if not found or v_request.client_id <> p_client_id then
    raise exception 'URGENT_CANCELLATION_FORBIDDEN';
  end if;
  if v_request.status = 'matched' then
    raise exception 'URGENT_REQUEST_ALREADY_MATCHED';
  end if;

  update public.urgent_service_requests
  set status = 'cancelled'
  where id = v_request.id;

  update public.urgent_service_candidates
  set status = 'expired'
  where request_id = v_request.id
    and status in ('notified', 'interested');

  return jsonb_build_object('ok', true, 'status', 'cancelled');
end;
$$;

revoke all on function public.cancel_urgent_service_request_internal(
  uuid, uuid
) from public;
grant execute on function public.cancel_urgent_service_request_internal(
  uuid, uuid
) to service_role;
