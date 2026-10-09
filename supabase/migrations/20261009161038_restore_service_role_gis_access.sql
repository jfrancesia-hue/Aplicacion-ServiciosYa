-- The provider catalogue Edge Function reads public.servicios_with_coords
-- with the service role. That view casts PostGIS values from the gis schema,
-- so the role needs schema usage even though it already has SELECT on the view.
grant usage on schema gis to service_role;
