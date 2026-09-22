-- EJECUCIÓN MANUAL POST-ROLLOUT
-- Aplicar únicamente cuando la versión que consume public.servicios_public ya
-- esté publicada en producción. Las versiones antiguas hacen SELECT * sobre la
-- tabla base y dejarían de funcionar si se ejecuta antes.

begin;

revoke select on table public.servicios from anon, authenticated;
grant select (
  id,
  titulo,
  descripcion,
  categoria_id,
  usuario_id,
  precio,
  horario,
  categoria,
  user_id,
  veces_contratado,
  calificacion_promedio,
  foto_perfil,
  estado,
  aceptado,
  ciudad,
  barrio,
  country
) on public.servicios to anon, authenticated;

do $$
declare
  target record;
begin
  for target in
    select p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'get_services_by_category_in_radius',
        'get_servicios_with_online_workers',
        'get_servicios_with_worker_status',
        'test_get_servicios_with_worker_status',
        'count_services_by_status_in_radius'
      )
  loop
    execute format(
      'revoke execute on function public.%I(%s) from public, anon, authenticated',
      target.proname,
      target.args
    );
    execute format(
      'grant execute on function public.%I(%s) to service_role',
      target.proname,
      target.args
    );
  end loop;
end;
$$;

commit;
