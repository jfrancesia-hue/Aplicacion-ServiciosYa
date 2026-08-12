-- Publicaciones manuales de clientes sobre el flujo existente nuevaOferta/presupuestos.

create or replace function public.create_manual_service_request(
  p_categoria text,
  p_descripcion text,
  p_zona text,
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
set search_path = public
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

  select * into v_profile from public.usuarios where id = auth.uid();

  insert into public."nuevaOferta" (
    app_cliente_id, nombre_cliente, cliente_telefono, categoria, descripcion,
    zona, ciudad, provincia, estado, paso, source, modo_agente,
    historial_conversacion, metadata, created_at, updated_at
  ) values (
    auth.uid(), v_profile.nombre, v_profile.celular, trim(p_categoria),
    trim(p_descripcion), trim(p_zona),
    nullif(trim(coalesce(p_ciudad, '')), ''),
    nullif(trim(coalesce(p_provincia, '')), ''),
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

create or replace function public.get_my_service_requests(p_limit integer default 30)
returns table (
  id text,
  categoria text,
  zona text,
  descripcion text,
  estado text,
  paso integer,
  source text,
  metadata jsonb,
  created_at text,
  response_count bigint,
  selected_budget_id text,
  chat_id uuid
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
    coalesce(o.source, 'mica'),
    coalesce(o.metadata, '{}'::jsonb),
    o.created_at::text,
    count(p.id) filter (where coalesce(p.estado, '') <> 'rechazado'),
    o.presupuesto_seleccionado_id::text,
    o.app_chat_id
  from public."nuevaOferta" o
  left join public.presupuestos p on p.oferta_id = o.id
  where auth.uid() is not null and o.app_cliente_id = auth.uid()
  group by o.id
  order by o.created_at desc
  limit greatest(1, least(coalesce(p_limit, 30), 100));
$$;

create or replace function public.cancel_service_request(p_oferta_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_offer public."nuevaOferta"%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_offer
  from public."nuevaOferta"
  where id::text = p_oferta_id and app_cliente_id = auth.uid()
  for update;

  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if v_offer.presupuesto_seleccionado_id is not null or v_offer.app_chat_id is not null then
    raise exception 'REQUEST_ALREADY_CONFIRMED';
  end if;

  update public."nuevaOferta"
  set estado = 'cancelada', updated_at = now()
  where id = v_offer.id;

  return jsonb_build_object('ok', true, 'oferta_id', v_offer.id::text);
end;
$$;

drop function if exists public.get_mica_app_requests_for_worker(uuid, text[], text, text, integer);
create function public.get_mica_app_requests_for_worker(
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
            lower(coalesce(o.categoria, '')) like '%' || lower(trim(oficio)) || '%'
            or lower(trim(oficio)) like '%' || lower(coalesce(o.categoria, '')) || '%'
          )
      )
    )
    and (
      nullif(trim(coalesce(p_ciudad, '')), '') is null
      or lower(coalesce(o.ciudad, '')) like '%' || lower(trim(p_ciudad)) || '%'
      or lower(coalesce(o.zona, '')) like '%' || lower(trim(p_ciudad)) || '%'
    )
    and (
      nullif(trim(coalesce(p_provincia, '')), '') is null
      or lower(coalesce(o.provincia, '')) like '%' || lower(trim(p_provincia)) || '%'
      or lower(coalesce(o.zona, '')) like '%' || lower(trim(p_provincia)) || '%'
    )
  order by o.created_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 50));
$$;

revoke all on function public.create_manual_service_request(text, text, text, text, text, text, text, integer, text) from public;
revoke all on function public.get_my_service_requests(integer) from public;
revoke all on function public.cancel_service_request(text) from public;
revoke all on function public.get_mica_app_requests_for_worker(uuid, text[], text, text, integer) from public;

grant execute on function public.create_manual_service_request(text, text, text, text, text, text, text, integer, text) to authenticated, service_role;
grant execute on function public.get_my_service_requests(integer) to authenticated, service_role;
grant execute on function public.cancel_service_request(text) to authenticated, service_role;
grant execute on function public.get_mica_app_requests_for_worker(uuid, text[], text, text, integer) to authenticated, service_role;
