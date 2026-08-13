-- Bandeja móvil de respaldo para pedidos creados desde MICA en ServiciosYa.
-- Complementa el endpoint web de ServiciosYa cuando un pedido todavía no está
-- disponible mediante el puente principal.

alter table public."nuevaOferta"
  add column if not exists modo_agente boolean default false;

create or replace function public.create_mica_app_request(
  p_categoria text,
  p_descripcion text,
  p_zona text,
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
set search_path = public
as $$
declare
  v_oferta_id text;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  if nullif(trim(coalesce(p_categoria, '')), '') is null then
    raise exception 'Falta categoria';
  end if;

  if nullif(trim(coalesce(p_descripcion, '')), '') is null then
    raise exception 'Falta descripcion';
  end if;

  insert into public."nuevaOferta" (
    app_cliente_id,
    nombre_cliente,
    cliente_telefono,
    categoria,
    descripcion,
    zona,
    ciudad,
    provincia,
    estado,
    paso,
    source,
    modo_agente,
    historial_conversacion,
    metadata,
    created_at,
    updated_at
  )
  values (
    auth.uid(),
    nullif(trim(coalesce(p_nombre_cliente, '')), ''),
    nullif(trim(coalesce(p_cliente_telefono, '')), ''),
    trim(p_categoria),
    trim(p_descripcion),
    nullif(trim(coalesce(p_zona, '')), ''),
    nullif(trim(coalesce(p_ciudad, '')), ''),
    nullif(trim(coalesce(p_provincia, '')), ''),
    'recolectando',
    1,
    'mica_app',
    true,
    coalesce(p_historial, '[]'::jsonb)::text,
    coalesce(p_metadata, '{}'::jsonb),
    now(),
    now()
  )
  returning id::text into v_oferta_id;

  return query select true, v_oferta_id;
end;
$$;

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
  ya_respondio boolean
)
language sql
security definer
set search_path = public
as $$
  select
    o.id::text,
    coalesce(o.categoria, 'Servicio') as categoria,
    coalesce(o.zona, concat_ws(', ', o.ciudad, o.provincia)) as zona,
    coalesce(o.descripcion, '') as descripcion,
    coalesce(o.estado, 'recolectando') as estado,
    coalesce(o.paso, 1) as paso,
    o.created_at::text as created_at,
    o.media_url,
    o.video_urls,
    o.presupuesto_estimado,
    exists (
      select 1
      from public.presupuestos p
      where p.oferta_id = o.id
        and p.trabajador_uuid = p_app_user_id
    ) as ya_respondio
  from public."nuevaOferta" o
  where auth.uid() = p_app_user_id
    and coalesce(o.source, '') = 'mica_app'
    and coalesce(o.estado, '') not in ('cancelado', 'cancelada', 'finalizada')
    and (o.app_cliente_id is null or o.app_cliente_id <> p_app_user_id)
    and not exists (
      select 1
      from public.presupuestos p
      where p.oferta_id = o.id
        and p.trabajador_uuid = p_app_user_id
    )
    and (
      coalesce(array_length(p_oficios, 1), 0) = 0
      or exists (
        select 1
        from unnest(p_oficios) oficio
        where nullif(trim(oficio), '') is not null
          and (
            lower(coalesce(o.categoria, '')) like '%' || lower(trim(oficio)) || '%'
            or lower(trim(oficio)) like '%' || lower(coalesce(o.categoria, '')) || '%'
          )
      )
    )
    and (
      nullif(trim(coalesce(p_provincia, '')), '') is null
      or lower(coalesce(o.provincia, '')) like '%' || lower(trim(p_provincia)) || '%'
      or lower(coalesce(o.zona, '')) like '%' || lower(trim(p_provincia)) || '%'
    )
  order by o.created_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 50));
$$;

grant execute on function public.create_mica_app_request(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  jsonb
) to authenticated;

grant execute on function public.get_mica_app_requests_for_worker(
  uuid,
  text[],
  text,
  text,
  integer
) to authenticated;

