-- Guarda la ubicación exacta de cada pedido sin exponerla al prestador y la
-- usa para ordenar primero las oportunidades realmente cercanas. Las RPC v1 se
-- conservan para las versiones ya publicadas; la app nueva consume las v2.

begin;

alter table public."nuevaOferta"
  add column if not exists location gis.geometry(Point, 4326);

create index if not exists nueva_oferta_location_gix
  on public."nuevaOferta" using gist (location);

create or replace function private.create_mica_app_request_v2(
  p_categoria text,
  p_descripcion text,
  p_zona text,
  p_latitude double precision,
  p_longitude double precision,
  p_nombre_cliente text default null,
  p_cliente_telefono text default null,
  p_ciudad text default null,
  p_provincia text default null,
  p_historial jsonb default '[]'::jsonb,
  p_metadata jsonb default '{}'::jsonb
)
returns table (ok boolean, oferta_id text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_oferta_id text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if nullif(trim(coalesce(p_categoria, '')), '') is null then
    raise exception 'REQUEST_CATEGORY_REQUIRED';
  end if;
  if nullif(trim(coalesce(p_descripcion, '')), '') is null then
    raise exception 'REQUEST_DESCRIPTION_REQUIRED';
  end if;
  if nullif(trim(coalesce(p_ciudad, '')), '') is null then
    raise exception 'REQUEST_CITY_REQUIRED';
  end if;
  if nullif(trim(coalesce(p_provincia, '')), '') is null then
    raise exception 'REQUEST_PROVINCE_REQUIRED';
  end if;
  if p_latitude is null or p_latitude < -90 or p_latitude > 90
    or p_longitude is null or p_longitude < -180 or p_longitude > 180
  then
    raise exception 'REQUEST_EXACT_LOCATION_REQUIRED';
  end if;

  insert into public."nuevaOferta" (
    app_cliente_id, nombre_cliente, cliente_telefono, categoria, descripcion,
    zona, ciudad, provincia, location, estado, paso, source, modo_agente,
    historial_conversacion, metadata, created_at, updated_at
  ) values (
    auth.uid(),
    nullif(trim(coalesce(p_nombre_cliente, '')), ''),
    nullif(trim(coalesce(p_cliente_telefono, '')), ''),
    trim(p_categoria), trim(p_descripcion),
    coalesce(nullif(trim(coalesce(p_zona, '')), ''), trim(p_ciudad)),
    trim(p_ciudad), trim(p_provincia),
    gis.st_setsrid(gis.st_makepoint(p_longitude, p_latitude), 4326),
    'recolectando', 1, 'mica_app', true,
    coalesce(p_historial, '[]'::jsonb)::text,
    coalesce(p_metadata, '{}'::jsonb), now(), now()
  ) returning id::text into v_oferta_id;

  return query select true, v_oferta_id;
end;
$$;

create or replace function public.create_mica_app_request_v2(
  p_categoria text,
  p_descripcion text,
  p_zona text,
  p_latitude double precision,
  p_longitude double precision,
  p_nombre_cliente text default null,
  p_cliente_telefono text default null,
  p_ciudad text default null,
  p_provincia text default null,
  p_historial jsonb default '[]'::jsonb,
  p_metadata jsonb default '{}'::jsonb
)
returns table (ok boolean, oferta_id text)
language sql
security invoker
set search_path = ''
as $$
  select * from private.create_mica_app_request_v2(
    p_categoria, p_descripcion, p_zona, p_latitude, p_longitude,
    p_nombre_cliente, p_cliente_telefono, p_ciudad, p_provincia,
    p_historial, p_metadata
  );
$$;

create or replace function private.create_manual_service_request_v2(
  p_categoria text,
  p_descripcion text,
  p_zona text,
  p_latitude double precision,
  p_longitude double precision,
  p_ciudad text default null,
  p_provincia text default null,
  p_urgencia text default 'normal',
  p_responsable_herramientas text default 'a_coordinar',
  p_cantidad_personas integer default 1,
  p_modalidad_preferida text default 'a_coordinar'
)
returns table (ok boolean, oferta_id text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_oferta_id text;
  v_profile public.usuarios%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if nullif(trim(coalesce(p_categoria, '')), '') is null then
    raise exception 'REQUEST_CATEGORY_REQUIRED';
  end if;
  if length(trim(coalesce(p_descripcion, ''))) < 20 then
    raise exception 'REQUEST_DESCRIPTION_TOO_SHORT';
  end if;
  if nullif(trim(coalesce(p_zona, '')), '') is null then
    raise exception 'REQUEST_ZONE_REQUIRED';
  end if;
  if nullif(trim(coalesce(p_ciudad, '')), '') is null then
    raise exception 'REQUEST_CITY_REQUIRED';
  end if;
  if nullif(trim(coalesce(p_provincia, '')), '') is null then
    raise exception 'REQUEST_PROVINCE_REQUIRED';
  end if;
  if p_latitude is null or p_latitude < -90 or p_latitude > 90
    or p_longitude is null or p_longitude < -180 or p_longitude > 180
  then
    raise exception 'REQUEST_EXACT_LOCATION_REQUIRED';
  end if;
  if p_urgencia not in ('normal', 'pronto', 'urgente') then
    raise exception 'REQUEST_URGENCY_INVALID';
  end if;
  if p_responsable_herramientas not in ('cliente', 'prestador', 'a_coordinar') then
    raise exception 'REQUEST_TOOLS_INVALID';
  end if;
  if p_cantidad_personas < 1 or p_cantidad_personas > 10 then
    raise exception 'REQUEST_TEAM_SIZE_INVALID';
  end if;
  if p_modalidad_preferida not in ('a_coordinar', 'proyecto', 'hora', 'dia') then
    raise exception 'REQUEST_BUDGET_MODE_INVALID';
  end if;

  select * into v_profile
  from public.usuarios
  where id = auth.uid();

  insert into public."nuevaOferta" (
    app_cliente_id, nombre_cliente, cliente_telefono, categoria, descripcion,
    zona, ciudad, provincia, location, estado, paso, source, modo_agente,
    historial_conversacion, metadata, created_at, updated_at
  ) values (
    auth.uid(), v_profile.nombre, v_profile.celular, trim(p_categoria),
    trim(p_descripcion), trim(p_zona), trim(p_ciudad), trim(p_provincia),
    gis.st_setsrid(gis.st_makepoint(p_longitude, p_latitude), 4326),
    'recolectando', 1, 'manual_app', false, '[]',
    jsonb_build_object(
      'source_screen', 'PublicarNecesidad',
      'urgency', p_urgencia,
      'tools_responsibility', p_responsable_herramientas,
      'team_size', p_cantidad_personas,
      'preferred_budget_mode', p_modalidad_preferida
    ),
    now(), now()
  ) returning id::text into v_oferta_id;

  return query select true, v_oferta_id;
end;
$$;

create or replace function public.create_manual_service_request_v2(
  p_categoria text,
  p_descripcion text,
  p_zona text,
  p_latitude double precision,
  p_longitude double precision,
  p_ciudad text default null,
  p_provincia text default null,
  p_urgencia text default 'normal',
  p_responsable_herramientas text default 'a_coordinar',
  p_cantidad_personas integer default 1,
  p_modalidad_preferida text default 'a_coordinar'
)
returns table (ok boolean, oferta_id text)
language sql
security invoker
set search_path = ''
as $$
  select * from private.create_manual_service_request_v2(
    p_categoria, p_descripcion, p_zona, p_latitude, p_longitude,
    p_ciudad, p_provincia, p_urgencia, p_responsable_herramientas,
    p_cantidad_personas, p_modalidad_preferida
  );
$$;

revoke all on function private.create_mica_app_request_v2(
  text, text, text, double precision, double precision, text, text, text,
  text, jsonb, jsonb
) from public, anon;
grant execute on function private.create_mica_app_request_v2(
  text, text, text, double precision, double precision, text, text, text,
  text, jsonb, jsonb
) to authenticated, service_role;
revoke all on function public.create_mica_app_request_v2(
  text, text, text, double precision, double precision, text, text, text,
  text, jsonb, jsonb
) from public, anon;
grant execute on function public.create_mica_app_request_v2(
  text, text, text, double precision, double precision, text, text, text,
  text, jsonb, jsonb
) to authenticated, service_role;

revoke all on function private.create_manual_service_request_v2(
  text, text, text, double precision, double precision, text, text, text,
  text, integer, text
) from public, anon;
grant execute on function private.create_manual_service_request_v2(
  text, text, text, double precision, double precision, text, text, text,
  text, integer, text
) to authenticated, service_role;
revoke all on function public.create_manual_service_request_v2(
  text, text, text, double precision, double precision, text, text, text,
  text, integer, text
) from public, anon;
grant execute on function public.create_manual_service_request_v2(
  text, text, text, double precision, double precision, text, text, text,
  text, integer, text
) to authenticated, service_role;

-- Mantiene el alcance provincial para zonas rurales, pero dentro de ese alcance
-- prioriza por distancia real cuando ambos lados confirmaron coordenadas.
create or replace function private.get_mica_app_requests_for_worker(
  p_app_user_id uuid,
  p_oficios text[],
  p_ciudad text default null,
  p_provincia text default null,
  p_limit integer default 20
)
returns table (
  id text,
  categoria text,
  zona text,
  descripcion text,
  estado text,
  paso integer,
  created_at text,
  media_url text,
  video_urls text,
  presupuesto_estimado numeric,
  ya_respondio boolean,
  source text,
  metadata jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  with caller as materialized (
    select u.id, u.ciudad, u.provincia, u.categoria
    from public.usuarios u
    where u.id = auth.uid()
      and u.id = p_app_user_id
      and lower(u.rol::text) = 'worker'
  ),
  caller_trades as materialized (
    select trim(trade) as trade
    from caller c
    cross join lateral unnest(coalesce(c.categoria, '{}'::text[])) trade
    where nullif(trim(trade), '') is not null

    union

    select trim(s.categoria)
    from caller c
    join public.servicios s
      on s.usuario_id = c.id or s.user_id = c.id::text
    where nullif(trim(coalesce(s.categoria, '')), '') is not null
  )
  select
    o.id::text,
    coalesce(o.categoria, 'Servicio'),
    coalesce(o.zona, concat_ws(', ', o.ciudad, o.provincia)),
    coalesce(o.descripcion, ''),
    coalesce(o.estado, 'recolectando'),
    coalesce(o.paso, 1),
    o.created_at::text,
    o.media_url,
    o.video_urls,
    o.presupuesto_estimado,
    exists (
      select 1 from public.presupuestos p
      where p.oferta_id = o.id and p.trabajador_uuid = c.id
    ),
    coalesce(o.source, 'mica'),
    coalesce(o.metadata, '{}'::jsonb)
  from public."nuevaOferta" o
  cross join caller c
  left join public.workers w on w.user_id = c.id
  where coalesce(o.source, '') in ('mica_app', 'manual_app')
    and coalesce(o.estado, '') not in (
      'cancelado', 'cancelada', 'finalizado', 'finalizada'
    )
    and (o.app_cliente_id is null or o.app_cliente_id <> c.id)
    and not exists (
      select 1 from public.presupuestos p
      where p.oferta_id = o.id and p.trabajador_uuid = c.id
    )
    and exists (
      select 1 from caller_trades ct
      where public.service_category_key(o.categoria) =
        public.service_category_key(ct.trade)
        or public.service_category_key(o.categoria) like
          '%' || public.service_category_key(ct.trade) || '%'
        or public.service_category_key(ct.trade) like
          '%' || public.service_category_key(o.categoria) || '%'
    )
    and (
      (
        nullif(trim(coalesce(c.provincia, '')), '') is not null
        and (
          extensions.unaccent(lower(coalesce(o.provincia, ''))) like
            '%' || extensions.unaccent(lower(trim(c.provincia))) || '%'
          or extensions.unaccent(lower(coalesce(o.zona, ''))) like
            '%' || extensions.unaccent(lower(trim(c.provincia))) || '%'
        )
      )
      or (
        nullif(trim(coalesce(c.provincia, '')), '') is null
        and nullif(trim(coalesce(c.ciudad, '')), '') is not null
        and (
          extensions.unaccent(lower(coalesce(o.ciudad, ''))) like
            '%' || extensions.unaccent(lower(trim(c.ciudad))) || '%'
          or extensions.unaccent(lower(coalesce(o.zona, ''))) like
            '%' || extensions.unaccent(lower(trim(c.ciudad))) || '%'
        )
      )
    )
  order by
    case when o.location is not null and w.location is not null then 0 else 1 end,
    gis.st_distance(o.location, w.location) asc nulls last,
    case
      when nullif(trim(coalesce(c.ciudad, '')), '') is not null
        and (
          extensions.unaccent(lower(coalesce(o.ciudad, ''))) like
            '%' || extensions.unaccent(lower(trim(c.ciudad))) || '%'
          or extensions.unaccent(lower(coalesce(o.zona, ''))) like
            '%' || extensions.unaccent(lower(trim(c.ciudad))) || '%'
        )
      then 0 else 1
    end,
    o.created_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 50));
$$;

commit;
