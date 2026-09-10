-- Cache request-scoped identity lookups once per statement instead of once per row.
alter policy chats_select_participants on public.chats
  using (((select auth.uid()) = participant_a) or ((select auth.uid()) = participant_b));

alter policy chats_insert_self on public.chats
  with check (((select auth.uid()) = participant_a) or ((select auth.uid()) = participant_b));

alter policy chats_update_participants on public.chats
  using (((select auth.uid()) = participant_a) or ((select auth.uid()) = participant_b))
  with check (((select auth.uid()) = participant_a) or ((select auth.uid()) = participant_b));

alter policy mensajes_select_participants on public.mensajes
  using (exists (
    select 1 from public.chats c
    where c.id = mensajes.chat_id
      and (((select auth.uid()) = c.participant_a) or ((select auth.uid()) = c.participant_b))
  ));

alter policy mensajes_insert_participant on public.mensajes
  with check (
    (select auth.uid()) = remitente_id
    and exists (
      select 1 from public.chats c
      where c.id = mensajes.chat_id
        and (((select auth.uid()) = c.participant_a) or ((select auth.uid()) = c.participant_b))
    )
  );

alter policy mensajes_update_leido on public.mensajes
  using (exists (
    select 1 from public.chats c
    where c.id = mensajes.chat_id
      and (((select auth.uid()) = c.participant_a) or ((select auth.uid()) = c.participant_b))
  ));

alter policy contact_unlocks_users_select_own on public.contact_unlocks
  using ((cliente_id = (select auth.uid())) or (trabajador_id = (select auth.uid())));

alter policy user_blocks_select_own on public.user_blocks
  using (blocker_id = (select auth.uid()));

alter policy user_blocks_insert_own on public.user_blocks
  with check (blocker_id = (select auth.uid()));

alter policy user_blocks_delete_own on public.user_blocks
  using (blocker_id = (select auth.uid()));

alter policy profile_reports_select_own on public.profile_reports
  using (reporter_id = (select auth.uid()));

alter policy profile_reports_insert_own on public.profile_reports
  with check (reporter_id = (select auth.uid()));

alter policy service_confirmation_payments_participants_read on public.service_confirmation_payments
  using (((select auth.uid()) = payer_id) or ((select auth.uid()) = provider_id));

alter policy service_job_reviews_participants_read on public.service_job_reviews
  using (((select auth.uid()) = reviewer_id) or ((select auth.uid()) = provider_id));

alter policy service_job_incidents_participants_read on public.service_job_incidents
  using (
    ((select auth.uid()) = reporter_id)
    or ((select auth.uid()) = provider_id)
    or (select private.is_operational_admin())
  );

alter policy service_schedule_proposals_participants_read on public.service_schedule_proposals
  using (exists (
    select 1 from public.service_confirmation_payments p
    where p.id = service_schedule_proposals.payment_record_id
      and (((select auth.uid()) = p.payer_id) or ((select auth.uid()) = p.provider_id))
  ));

alter policy service_schedule_slots_participants_read on public.service_schedule_slots
  using (exists (
    select 1
    from public.service_schedule_proposals proposal
    join public.service_confirmation_payments p on p.id = proposal.payment_record_id
    where proposal.id = service_schedule_slots.proposal_id
      and (((select auth.uid()) = p.payer_id) or ((select auth.uid()) = p.provider_id))
  ));

alter policy urgent_work_alerts_participants_read on public.urgent_work_alerts
  using (
    ((select auth.uid()) = worker_id)
    or ((select auth.uid()) = cliente_id)
    or (select private.is_operational_admin())
  );

alter policy urgent_work_misses_worker_read on public.urgent_work_misses
  using (((select auth.uid()) = worker_id) or (select private.is_operational_admin()));

alter policy worker_urgent_discipline_own_read on public.worker_urgent_discipline
  using (((select auth.uid()) = worker_id) or (select private.is_operational_admin()));

alter policy client_job_reviews_participants_read on public.client_job_reviews
  using (
    ((select auth.uid()) = reviewer_id)
    or ((select auth.uid()) = client_id)
    or (select private.is_operational_admin())
  );

alter policy user_legal_acceptances_own_read on public.user_legal_acceptances
  using (((select auth.uid()) = user_id) or (select private.is_operational_admin()));

alter policy consumer_right_requests_own_or_admin_read on public.consumer_right_requests
  using (((select auth.uid()) = user_id) or (select private.is_operational_admin()));

alter policy urgent_work_discipline_events_worker_read on public.urgent_work_discipline_events
  using (((select auth.uid()) = worker_id) or (select private.is_operational_admin()));

alter policy chat_quotes_participants_read on public.chat_quotes
  using (((select auth.uid()) = provider_id) or ((select auth.uid()) = client_id));

alter policy service_cancellation_requests_participants_read on public.service_cancellation_requests
  using (exists (
    select 1 from public.service_confirmation_payments payment
    where payment.id = service_cancellation_requests.payment_record_id
      and (((select auth.uid()) = payment.payer_id) or ((select auth.uid()) = payment.provider_id))
  ));

alter policy provider_communication_preferences_own on public.provider_communication_preferences
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter policy provider_profile_reminders_own_read on public.provider_profile_reminders
  using (user_id = (select auth.uid()));

alter policy urgent_service_requests_participants_read on public.urgent_service_requests
  using ((client_id = (select auth.uid())) or (selected_provider_id = (select auth.uid())));

alter policy urgent_service_candidates_participants_read on public.urgent_service_candidates
  using (provider_id = (select auth.uid()));

-- Cover every ServiciosYa foreign key reported by the database advisor.
create index if not exists chat_quotes_client_id_idx on public.chat_quotes (client_id);
create index if not exists chat_quotes_supersedes_quote_id_idx on public.chat_quotes (supersedes_quote_id);
create index if not exists client_job_reviews_chat_id_idx on public.client_job_reviews (chat_id);
create index if not exists client_job_reviews_reviewer_id_idx on public.client_job_reviews (reviewer_id);
create index if not exists consumer_right_requests_user_id_idx on public.consumer_right_requests (user_id);
create index if not exists marketplace_events_user_id_idx on public.marketplace_events (user_id);
create index if not exists presupuestopagado_presupuesto_id_idx on public.presupuestopagado (presupuesto_id);
create index if not exists profile_reports_reporter_id_idx on public.profile_reports (reporter_id);
create index if not exists profile_reports_service_id_idx on public.profile_reports (service_id);
create index if not exists provider_chat_response_times_requester_id_idx on public.provider_chat_response_times (requester_id);
create index if not exists reports_reporter_user_id_idx on public.reports (reporter_user_id);
create index if not exists reports_service_id_idx on public.reports (service_id);
create index if not exists service_cancellation_requests_requested_by_idx on public.service_cancellation_requests (requested_by);
create index if not exists service_cancellation_requests_resolved_by_idx on public.service_cancellation_requests (resolved_by);
create index if not exists service_confirmation_payments_budget_id_idx on public.service_confirmation_payments (budget_id);
create index if not exists service_confirmation_payments_cancellation_request_id_idx on public.service_confirmation_payments (cancellation_request_id);
create index if not exists service_confirmation_payments_cancelled_by_idx on public.service_confirmation_payments (cancelled_by);
create index if not exists service_confirmation_payments_confirmation_message_id_idx on public.service_confirmation_payments (confirmation_message_id);
create index if not exists service_confirmation_payments_provider_id_idx on public.service_confirmation_payments (provider_id);
create index if not exists service_confirmation_payments_quote_message_id_idx on public.service_confirmation_payments (quote_message_id);
create index if not exists service_confirmation_payments_schedule_proposed_by_idx on public.service_confirmation_payments (schedule_proposed_by);
create index if not exists service_confirmation_payments_visit_proposed_by_idx on public.service_confirmation_payments (visit_proposed_by);
create index if not exists service_job_incidents_assigned_to_idx on public.service_job_incidents (assigned_to);
create index if not exists service_job_incidents_chat_id_idx on public.service_job_incidents (chat_id);
create index if not exists service_job_incidents_provider_id_idx on public.service_job_incidents (provider_id);
create index if not exists service_job_incidents_reporter_id_idx on public.service_job_incidents (reporter_id);
create index if not exists service_job_reviews_chat_id_idx on public.service_job_reviews (chat_id);
create index if not exists service_job_reviews_reviewer_id_idx on public.service_job_reviews (reviewer_id);
create index if not exists service_schedule_proposals_chat_id_idx on public.service_schedule_proposals (chat_id);
create index if not exists service_schedule_proposals_proposed_by_idx on public.service_schedule_proposals (proposed_by);
create index if not exists service_schedule_proposals_selected_slot_id_idx on public.service_schedule_proposals (selected_slot_id);
create index if not exists servicios_usuario_id_idx on public.servicios (usuario_id);
create index if not exists servicios_contratados_contratado_id_idx on public.servicios_contratados (contratado_id);
create index if not exists servicios_contratados_contratante_id_idx on public.servicios_contratados (contratante_id);
create index if not exists servicios_contratados_servicio_id_idx on public.servicios_contratados (servicio_id);
create index if not exists sy_pedidos_cliente_id_idx on public.sy_pedidos (cliente_id);
create index if not exists sy_pedidos_prestador_id_idx on public.sy_pedidos (prestador_id);
create index if not exists transactional_notification_outbox_user_id_idx on public.transactional_notification_outbox (user_id);
create index if not exists urgent_service_requests_chat_id_idx on public.urgent_service_requests (chat_id);
create index if not exists urgent_service_requests_selected_provider_id_idx on public.urgent_service_requests (selected_provider_id);
create index if not exists urgent_work_alerts_reassigned_alert_id_idx on public.urgent_work_alerts (reassigned_alert_id);
create index if not exists urgent_work_alerts_reassigned_from_id_idx on public.urgent_work_alerts (reassigned_from_id);
create index if not exists urgent_work_alerts_root_alert_id_idx on public.urgent_work_alerts (root_alert_id);
create index if not exists urgent_work_policy_updated_by_idx on public.urgent_work_policy (updated_by);
create index if not exists urgent_work_policy_audit_changed_by_idx on public.urgent_work_policy_audit (changed_by);

-- Repair the two remaining structural advisor findings in legacy ServiciosYa tables.
alter table public.contrataciones
  add column if not exists id uuid not null default gen_random_uuid();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.contrataciones'::regclass
      and contype = 'p'
  ) then
    alter table public.contrataciones
      add constraint contrataciones_pkey primary key (id);
  end if;
end
$$;

alter table public.servicios drop constraint if exists fk_usuario_id;
alter table public.perfiles drop constraint if exists perfiles_id_unique;
alter table public.servicios
  add constraint fk_usuario_id
  foreign key (usuario_id) references public.perfiles (id) on delete set null;
