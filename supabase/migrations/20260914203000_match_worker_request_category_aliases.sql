-- Unifica nombres equivalentes entre perfiles y pedidos (por ejemplo,
-- "Plomero" y "Plomería") sin relajar el alcance geográfico del RPC.

create or replace function public.service_category_key(p_value text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select case
    when normalized like '%plom%' then 'plomeria'
    when normalized like '%electric%' then 'electricidad'
    when normalized like '%alban%' then 'albanileria'
    when normalized like '%pint%' then 'pintura'
    when normalized like '%limpieza%' or normalized like '%domestica%' then 'limpieza'
    when normalized like '%carpinter%' then 'carpinteria'
    when normalized like '%cerrajer%' then 'cerrajeria'
    when normalized like '%jardin%' then 'jardineria'
    when normalized like '%mecanic%' then 'mecanica'
    when normalized like '%gasista%' then 'gasista'
    when normalized like '%refriger%' or normalized like '%aire acondicionado%' then 'refrigeracion'
    else normalized
  end
  from (
    select trim(regexp_replace(
      extensions.unaccent(lower(coalesce(p_value, ''))),
      '[^a-z0-9]+',
      ' ',
      'g'
    )) as normalized
  ) value;
$$;

revoke all on function public.service_category_key(text) from public;
grant execute on function public.service_category_key(text) to authenticated, service_role;

create or replace function public.get_mica_app_requests_for_worker(
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
set search_path = public
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
  where coalesce(o.source, '') in ('mica_app', 'manual_app')
    and coalesce(o.estado, '') not in ('cancelado', 'cancelada', 'finalizada')
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
  order by o.created_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 50));
$$;

revoke all on function public.get_mica_app_requests_for_worker(uuid, text[], text, text, integer) from public;
grant execute on function public.get_mica_app_requests_for_worker(uuid, text[], text, text, integer)
  to authenticated, service_role;
