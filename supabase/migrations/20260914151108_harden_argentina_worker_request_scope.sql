-- El RPC es privilegiado porque necesita leer pedidos abiertos. Su alcance se
-- deriva del perfil autenticado para que ciudad, provincia y oficios no puedan
-- adulterarse desde el cliente.

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
      where extensions.unaccent(lower(coalesce(o.categoria, ''))) like
        '%' || extensions.unaccent(lower(ct.trade)) || '%'
        or extensions.unaccent(lower(ct.trade)) like
          '%' || extensions.unaccent(lower(coalesce(o.categoria, ''))) || '%'
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
