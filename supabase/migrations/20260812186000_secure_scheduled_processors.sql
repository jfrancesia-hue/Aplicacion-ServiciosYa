-- Protege los procesadores programados con un secreto generado dentro de Vault.
-- El valor nunca queda escrito en el repositorio ni se expone a clientes.

create extension if not exists supabase_vault with schema vault;
create extension if not exists pgcrypto with schema extensions;

do $$
begin
  if not exists (
    select 1 from vault.secrets
    where name = 'marketplace_scheduled_processors_secret'
  ) then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'marketplace_scheduled_processors_secret',
      'Autenticación de cron para urgencias y notificaciones transaccionales'
    );
  end if;
end;
$$;

create or replace function public.verify_marketplace_cron_secret(p_secret text)
returns boolean
language sql
stable
security definer
set search_path = public, vault
as $$
  select p_secret is not null
    and length(p_secret) >= 32
    and exists (
      select 1
      from vault.decrypted_secrets secret
      where secret.name = 'marketplace_scheduled_processors_secret'
        and secret.decrypted_secret = p_secret
    );
$$;

revoke all on function public.verify_marketplace_cron_secret(text) from public;
grant execute on function public.verify_marketplace_cron_secret(text) to service_role;

select cron.unschedule('process-urgent-work-alerts-every-minute')
where exists (
  select 1 from cron.job
  where jobname = 'process-urgent-work-alerts-every-minute'
);

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

select cron.unschedule('process-transactional-notifications-every-minute')
where exists (
  select 1 from cron.job
  where jobname = 'process-transactional-notifications-every-minute'
);

select cron.schedule(
  'process-transactional-notifications-every-minute',
  '* * * * *',
  $job$
  select net.http_post(
    url := 'https://dhhhftzdfpqthzvkrqoz.functions.supabase.co/process-transactional-notifications',
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
