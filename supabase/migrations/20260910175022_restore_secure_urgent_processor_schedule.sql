-- A prior cleanup repaired a cron entry by numeric id and could remove this job.
-- Restore it by stable name and keep authentication in Vault.
do $$
begin
  if not exists (
    select 1
    from vault.secrets
    where name = 'marketplace_scheduled_processors_secret'
  ) then
    raise exception 'MARKETPLACE_SCHEDULED_PROCESSORS_SECRET_MISSING';
  end if;
end
$$;

select cron.unschedule(jobid)
from cron.job
where jobname = 'process-urgent-work-alerts-every-minute';

select cron.schedule(
  'process-urgent-work-alerts-every-minute',
  '* * * * *',
  $job$
  select net.http_post(
    url := 'https://dhhhftzdfpqthzvkrqoz.functions.supabase.co/process-urgent-work-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-marketplace-cron-secret', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'marketplace_scheduled_processors_secret'
        limit 1
      )
    ),
    body := '{}'::jsonb
  );
  $job$
);
