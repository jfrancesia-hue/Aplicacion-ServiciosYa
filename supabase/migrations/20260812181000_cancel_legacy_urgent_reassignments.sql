-- Los avisos previos al nuevo SLA no tenían aceptación explícita ni podían computar incumplimientos.
-- Se conservan para auditoría, pero se cancelan sus reasignaciones y métricas generadas al migrar.

do $$
declare
  v_cutoff constant timestamptz := '2026-08-12 15:49:09+00';
begin
  update public.notificaciones n
  set estado = 'urgente_legacy_cancelada', leido = true
  where n.urgent_work_alert_id in (
    select child.id
    from public.urgent_work_alerts child
    join public.urgent_work_alerts root on root.id = child.root_alert_id
    where root.created_at < v_cutoff and child.reassigned_from_id is not null
  );

  update public.urgent_work_alerts child
  set status = 'cancelled', processing_at = null,
      reassignment_processed_at = coalesce(child.reassignment_processed_at, now()),
      updated_at = now(),
      metadata = coalesce(child.metadata, '{}'::jsonb) || '{"cancel_reason":"legacy_sla_migration"}'::jsonb
  from public.urgent_work_alerts root
  where root.id = child.root_alert_id
    and root.created_at < v_cutoff
    and child.reassigned_from_id is not null
    and child.status in ('pending', 'declined', 'expired', 'reassigned');

  update public.urgent_work_alerts
  set status = 'cancelled', processing_at = null,
      reassignment_processed_at = coalesce(reassignment_processed_at, now()),
      updated_at = now(),
      metadata = coalesce(metadata, '{}'::jsonb) || '{"cancel_reason":"legacy_sla_migration"}'::jsonb
  where created_at < v_cutoff and root_alert_id = id
    and status in ('pending', 'declined', 'expired', 'reassigned', 'escalation_ready');

  delete from public.urgent_work_misses m
  using public.urgent_work_alerts a
  where a.id = m.alert_id and a.created_at < v_cutoff;

  update public.transactional_notification_outbox o
  set in_app_status = case when in_app_status = 'pending' then 'failed' else in_app_status end,
      push_status = case when push_status = 'pending' then 'skipped' else push_status end,
      email_status = case when email_status in ('pending', 'waiting_configuration') then 'skipped' else email_status end,
      last_error = 'cancelled_legacy_urgent_migration', updated_at = now()
  where o.event_type in ('urgent_expired', 'urgent_declined')
    and exists (
      select 1 from public.urgent_work_alerts a
      where a.id::text = o.metadata->>'urgent_alert_id' and a.created_at < v_cutoff
    );

  update public.notificaciones n
  set estado = 'urgente_legacy_cancelada', leido = true
  from public.transactional_notification_outbox o
  where n.transactional_outbox_id = o.id
    and o.last_error = 'cancelled_legacy_urgent_migration';
end;
$$;

create or replace function public.protect_pending_urgent_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.urgent_work_alert_id is not null and exists (
    select 1 from public.urgent_work_alerts a
    where a.id = old.urgent_work_alert_id
      and a.status = 'pending' and a.response_deadline > now()
  ) then raise exception 'URGENT_NOTIFICATION_RESPONSE_REQUIRED'; end if;
  return old;
end;
$$;

drop trigger if exists protect_pending_urgent_notification on public.notificaciones;
create trigger protect_pending_urgent_notification
before delete on public.notificaciones
for each row execute function public.protect_pending_urgent_notification();
