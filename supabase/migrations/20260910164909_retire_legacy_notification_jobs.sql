-- Retira tareas duplicadas y rotas. Las notificaciones vigentes se procesan
-- mediante transactional_notification_outbox y provider-reactivation-emails.
do $$
declare
  legacy_job record;
begin
  for legacy_job in
    select jobid
    from cron.job
    where jobname in (
      'Marketing Notifications',
      'Recordatorio de conectarse a la app'
    )
  loop
    perform cron.unschedule(legacy_job.jobid);
  end loop;
end;
$$;

revoke all on function public.get_inactive_users_for_reminders(integer, integer)
  from public, anon, authenticated;
revoke all on function public.get_marketing_candidate_users(integer)
  from public, anon, authenticated;
revoke all on function public.get_marketing_candidate_users(integer, integer)
  from public, anon, authenticated;

grant execute on function public.get_inactive_users_for_reminders(integer, integer)
  to service_role;
grant execute on function public.get_marketing_candidate_users(integer)
  to service_role;
grant execute on function public.get_marketing_candidate_users(integer, integer)
  to service_role;
