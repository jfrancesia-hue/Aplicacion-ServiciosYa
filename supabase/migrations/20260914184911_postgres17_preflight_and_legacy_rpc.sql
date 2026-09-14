-- Prepara la base para PostgreSQL 17 y corrige una RPC heredada.
-- pgjwt fue deprecada por Supabase; Auth usa sus propias funciones auth.jwt().
-- Antes de retirarla se verificó que no existieran dependencias ajenas a la extensión.
drop extension if exists pgjwt;

-- La tabla public.servicios usa bigint. La firma uuid anterior nunca podía
-- comparar correctamente contra servicios.id y solo estaba habilitada para
-- service_role.
drop function if exists public.incrementar_veces_contratado(uuid);

create function public.incrementar_veces_contratado(servicio_id_input bigint)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.servicios
  set veces_contratado = coalesce(veces_contratado, 0) + 1
  where id = servicio_id_input;
$$;

revoke all on function public.incrementar_veces_contratado(bigint)
  from public, anon, authenticated;
grant execute on function public.incrementar_veces_contratado(bigint)
  to service_role;

-- pg_cron no elimina su historial automáticamente. Conservar 30 días evita
-- que una tarea por minuto vuelva a inflar la base indefinidamente.
delete from cron.job_run_details
where end_time < now() - interval '30 days';

do $$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id
  from cron.job
  where jobname = 'cleanup-pg-cron-history'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;
end;
$$;

select cron.schedule(
  'cleanup-pg-cron-history',
  '17 3 * * *',
  $command$
    delete from cron.job_run_details
    where end_time < now() - interval '30 days';
  $command$
);
