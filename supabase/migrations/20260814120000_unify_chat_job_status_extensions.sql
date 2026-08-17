-- Unifica la vista de estado del chat después de aplicar las migraciones
-- remotas de agenda, reclamos y reseñas bilaterales con el flujo local de
-- reserva, cancelación y reintegros.

create or replace function public.get_chat_job_status(p_chat_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select jsonb_build_object(
    'payment_record_id', payment.id,
    'chat_quote_id', payment.chat_quote_id,
    'status', payment.status,
    'job_status', payment.job_status,
    'amount_total', payment.amount_total,
    'commission_amount', payment.commission_amount,
    'fee_rate', payment.fee_rate,
    'client_total', payment.client_total,
    'currency', payment.currency,
    'pricing_mode', payment.pricing_mode,
    'unit_rate', payment.unit_rate,
    'estimated_units', payment.estimated_units,
    'reference_total_type', payment.reference_total_type,
    'provider_id', payment.provider_id,
    'payer_id', payment.payer_id,
    'is_payer', payment.payer_id = auth.uid(),
    'is_provider', payment.provider_id = auth.uid(),
    'can_review',
      payment.payer_id = auth.uid()
      and payment.status = 'approved'
      and payment.job_status = 'confirmed'
      and payment.cancellation_status in ('not_requested', 'review_rejected')
      and provider_review.id is null,
    'can_review_client',
      payment.provider_id = auth.uid()
      and payment.status = 'approved'
      and payment.job_status = 'completed'
      and client_review.id is null,
    'can_cancel',
      auth.uid() in (payment.payer_id, payment.provider_id)
      and payment.status = 'approved'
      and payment.job_status = 'confirmed'
      and payment.cancellation_status in ('not_requested', 'review_rejected'),
    'schedule_status', payment.schedule_status,
    'visit_status', payment.visit_status,
    'visit_scheduled_for', payment.visit_scheduled_for,
    'visit_note', payment.visit_note,
    'cancellation_status', payment.cancellation_status,
    'cancellation_request_id', cancellation.id,
    'cancellation_request_code', cancellation.request_code,
    'cancellation_requester_role', cancellation.requester_role,
    'cancellation_reason', cancellation.reason_code,
    'cancellation_requested_at', cancellation.created_at,
    'cancellation_resolution_note', cancellation.resolution_note,
    'refund_id', payment.refund_id,
    'refund_amount', payment.refund_amount,
    'refunded_at', payment.refunded_at,
    'completed_at', payment.completed_at,
    'rating', provider_review.rating,
    'reviewed_at', provider_review.created_at,
    'client_rating', client_review.rating,
    'client_reviewed_at', client_review.created_at,
    'client_average_rating', client_summary.average_rating,
    'client_review_count', coalesce(client_summary.completed_reviews, 0),
    'incident_id', incident.id,
    'incident_case_number', incident.case_number,
    'incident_status', incident.status,
    'incident_category', incident.category
  )
  into v_result
  from public.service_confirmation_payments as payment
  left join public.service_job_reviews as provider_review
    on provider_review.payment_record_id = payment.id
  left join public.client_job_reviews as client_review
    on client_review.payment_record_id = payment.id
  left join public.client_trust_summary as client_summary
    on client_summary.client_id = payment.payer_id
  left join public.service_job_incidents as incident
    on incident.payment_record_id = payment.id
  left join public.service_cancellation_requests as cancellation
    on cancellation.id = payment.cancellation_request_id
  where payment.chat_id = p_chat_id
    and payment.status in ('approved', 'refunded')
    and auth.uid() in (payment.payer_id, payment.provider_id)
  order by payment.approved_at desc nulls last, payment.created_at desc
  limit 1;

  return coalesce(v_result, '{}'::jsonb);
end;
$$;

revoke all on function public.get_chat_job_status(uuid) from public;
grant execute on function public.get_chat_job_status(uuid)
  to authenticated, service_role;
