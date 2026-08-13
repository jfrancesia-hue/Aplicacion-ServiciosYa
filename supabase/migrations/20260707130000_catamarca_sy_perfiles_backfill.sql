-- Backfill opcional Web/MICA para cuentas Catamarca con servicios publicados.
-- IMPORTANTE: revisar primero supabase/audits/20260707_catamarca_sy_perfiles_backfill_audit.sql.
-- No elimina perfiles. Convierte/crea sy_perfiles operativos por telefono normalizado.

with servicios_por_usuario as (
  select
    s.user_id,
    array_agg(distinct nullif(trim(s.categoria), '') order by nullif(trim(s.categoria), '')) filter (
      where nullif(trim(s.categoria), '') is not null
    ) as categorias_servicios
  from public.servicios s
  where s.user_id is not null
  group by s.user_id
),
candidatos as (
  select
    u.id,
    coalesce(nullif(trim(u.nombre), ''), split_part(u.email, '@', 1), 'Prestador ServiciosYa') as nombre,
    regexp_replace(u.celular::text, '[^0-9]', '', 'g') as telefono_normalizado,
    u.celular::text as telefono,
    concat_ws(', ', nullif(trim(u.ciudad), ''), nullif(trim(u.provincia), ''), nullif(trim(u.barrio), '')) as zona_frecuente,
    coalesce(nullif(u.categoria, '{}'::text[]), sp.categorias_servicios) as oficios,
    coalesce(u.verificado, u.dni_verificado, false) as verificado
  from public.usuarios u
  join servicios_por_usuario sp on sp.user_id = u.id::text
  where lower(trim(coalesce(u.provincia, ''))) like '%catamarca%'
    and lower(trim(coalesce(u.rol::text, ''))) in ('user', 'worker')
    and u.celular is not null
    and coalesce(nullif(u.categoria, '{}'::text[]), sp.categorias_servicios) is not null
    and cardinality(coalesce(nullif(u.categoria, '{}'::text[]), sp.categorias_servicios)) > 0
),
actualizados as (
  update public.sy_perfiles sy
  set
    nombre = c.nombre,
    rol = 'prestador',
    zona_frecuente = nullif(c.zona_frecuente, ''),
    oficios = to_jsonb(c.oficios),
    verificado = c.verificado
  from candidatos c
  where regexp_replace(coalesce(sy.telefono, ''), '[^0-9]', '', 'g') = c.telefono_normalizado
  returning sy.id
)
insert into public.sy_perfiles (
  id,
  nombre,
  telefono,
  rol,
  zona_frecuente,
  oficios,
  verificado
)
select
  c.id,
  c.nombre,
  c.telefono,
  'prestador',
  nullif(c.zona_frecuente, ''),
  to_jsonb(c.oficios),
  c.verificado
from candidatos c
where not exists (
  select 1
  from public.sy_perfiles sy
  where regexp_replace(coalesce(sy.telefono, ''), '[^0-9]', '', 'g') = c.telefono_normalizado
);
