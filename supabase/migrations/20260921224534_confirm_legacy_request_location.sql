-- Permite que el cliente complete de forma segura la ubicación exacta de un
-- pedido creado antes de que las coordenadas fueran obligatorias.

create or replace function public.confirm_my_service_request_location(
  p_offer_id bigint,
  p_city text,
  p_province text,
  p_latitude double precision,
  p_longitude double precision,
  p_zone text default null
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, gis
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if nullif(btrim(p_city), '') is null
     or nullif(btrim(p_province), '') is null
     or p_latitude is null
     or p_longitude is null
     or p_latitude < -90
     or p_latitude > 90
     or p_longitude < -180
     or p_longitude > 180 then
    raise exception 'REQUEST_EXACT_LOCATION_REQUIRED';
  end if;

  update public."nuevaOferta"
  set
    ciudad = btrim(p_city),
    provincia = btrim(p_province),
    zona = coalesce(nullif(btrim(p_zone), ''), btrim(p_city) || ', ' || btrim(p_province)),
    location = gis.st_setsrid(gis.st_makepoint(p_longitude, p_latitude), 4326),
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'exact_location_confirmed_at', now(),
      'exact_location_source', 'client_reconfirmation'
    ),
    updated_at = now()
  where id = p_offer_id
    and app_cliente_id = v_user_id
    and lower(coalesce(estado, '')) not in (
      'cancelado',
      'cancelada',
      'finalizado',
      'finalizada'
    );

  if not found then
    raise exception 'REQUEST_NOT_AVAILABLE';
  end if;

  return true;
end;
$$;

revoke all on function public.confirm_my_service_request_location(
  bigint,
  text,
  text,
  double precision,
  double precision,
  text
) from public, anon;

grant execute on function public.confirm_my_service_request_location(
  bigint,
  text,
  text,
  double precision,
  double precision,
  text
) to authenticated;
