-- Los pedidos deben coincidir por provincia en todo el país, sin depender de
-- tildes ni de que cliente y prestador escriban la capital de la misma forma.

create extension if not exists unaccent with schema extensions;

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
      where p.oferta_id = o.id and p.trabajador_uuid = p_app_user_id
    ),
    coalesce(o.source, 'mica'),
    coalesce(o.metadata, '{}'::jsonb)
  from public."nuevaOferta" o
  where auth.uid() = p_app_user_id
    and coalesce(o.source, '') in ('mica_app', 'manual_app')
    and coalesce(o.estado, '') not in ('cancelado', 'cancelada', 'finalizada')
    and (o.app_cliente_id is null or o.app_cliente_id <> p_app_user_id)
    and not exists (
      select 1 from public.presupuestos p
      where p.oferta_id = o.id and p.trabajador_uuid = p_app_user_id
    )
    and (
      coalesce(array_length(p_oficios, 1), 0) = 0
      or exists (
        select 1 from unnest(p_oficios) oficio
        where nullif(trim(oficio), '') is not null
          and (
            extensions.unaccent(lower(coalesce(o.categoria, ''))) like
              '%' || extensions.unaccent(lower(trim(oficio))) || '%'
            or extensions.unaccent(lower(trim(oficio))) like
              '%' || extensions.unaccent(lower(coalesce(o.categoria, ''))) || '%'
          )
      )
    )
    and (
      (
        nullif(trim(coalesce(p_provincia, '')), '') is not null
        and (
          extensions.unaccent(lower(coalesce(o.provincia, ''))) like
            '%' || extensions.unaccent(lower(trim(p_provincia))) || '%'
          or extensions.unaccent(lower(coalesce(o.zona, ''))) like
            '%' || extensions.unaccent(lower(trim(p_provincia))) || '%'
        )
      )
      or (
        nullif(trim(coalesce(p_provincia, '')), '') is null
        and nullif(trim(coalesce(p_ciudad, '')), '') is not null
        and (
          extensions.unaccent(lower(coalesce(o.ciudad, ''))) like
            '%' || extensions.unaccent(lower(trim(p_ciudad))) || '%'
          or extensions.unaccent(lower(coalesce(o.zona, ''))) like
            '%' || extensions.unaccent(lower(trim(p_ciudad))) || '%'
        )
      )
      or (
        nullif(trim(coalesce(p_provincia, '')), '') is null
        and nullif(trim(coalesce(p_ciudad, '')), '') is null
      )
    )
  order by o.created_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 50));
$$;

revoke all on function public.get_mica_app_requests_for_worker(uuid, text[], text, text, integer) from public;
grant execute on function public.get_mica_app_requests_for_worker(uuid, text[], text, text, integer)
  to authenticated, service_role;
