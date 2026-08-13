-- Panel global de trabajos del cliente y del prestador.

create or replace function public.safe_quote_scope(p_content text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare v_payload jsonb;
begin
  if left(coalesce(p_content, ''), 15) <> ('__TOO' || 'RI_QUOTE__') then return null; end if;
  begin
    v_payload := substring(p_content from 16)::jsonb;
    return nullif(trim(v_payload->>'scope'), '');
  exception when others then
    return null;
  end;
end;
$$;

create or replace function public.get_my_service_jobs(p_limit integer default 100)
returns table (
  payment_record_id uuid,
  chat_id uuid,
  payer_id uuid,
  provider_id uuid,
  is_payer boolean,
  is_provider boolean,
  counterpart_id uuid,
  counterpart_name text,
  counterpart_avatar text,
  title text,
  description text,
  amount_total numeric,
  pricing_mode text,
  job_status text,
  schedule_status text,
  schedule_round integer,
  schedule_proposed_by uuid,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  incident_id uuid,
  incident_case_number text,
  incident_status text,
  review_rating integer,
  requires_action boolean,
  can_close boolean,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    payment.id,
    payment.chat_id,
    payment.payer_id,
    payment.provider_id,
    auth.uid() = payment.payer_id,
    auth.uid() = payment.provider_id,
    case when auth.uid() = payment.payer_id then payment.provider_id else payment.payer_id end,
    coalesce(
      nullif(trim(concat_ws(' ', counterpart.nombre, counterpart.apellido)), ''),
      'Usuario de Servicios Ya'
    ),
    counterpart.foto_perfil,
    coalesce(nullif(offer.categoria, ''), 'Servicio confirmado'),
    coalesce(nullif(offer.descripcion, ''), public.safe_quote_scope(message.contenido), 'Trabajo coordinado en el chat'),
    payment.amount_total,
    coalesce(payment.pricing_mode, 'project'),
    payment.job_status,
    payment.schedule_status,
    payment.schedule_round,
    payment.schedule_proposed_by,
    payment.scheduled_start,
    payment.scheduled_end,
    incident.id,
    incident.case_number,
    incident.status,
    review.rating::integer,
    payment.job_status = 'confirmed' and (
      (payment.schedule_status = 'awaiting_provider_options' and auth.uid() = payment.provider_id)
      or (payment.schedule_status = 'awaiting_selection' and payment.schedule_proposed_by <> auth.uid())
      or (payment.schedule_status = 'scheduled' and auth.uid() = payment.payer_id
        and coalesce(payment.scheduled_end, payment.scheduled_start) <= now() and review.id is null)
    ),
    payment.job_status = 'confirmed' and auth.uid() = payment.payer_id
      and payment.schedule_status = 'scheduled'
      and coalesce(payment.scheduled_end, payment.scheduled_start) <= now()
      and review.id is null,
    payment.created_at
  from public.service_confirmation_payments payment
  left join public.usuarios counterpart on counterpart.id = case
    when auth.uid() = payment.payer_id then payment.provider_id else payment.payer_id end
  left join public.mensajes message on message.id = payment.quote_message_id
  left join public."nuevaOferta" offer on offer.app_chat_id = payment.chat_id
  left join public.service_job_incidents incident on incident.payment_record_id = payment.id
  left join public.service_job_reviews review on review.payment_record_id = payment.id
  where auth.uid() is not null
    and auth.uid() in (payment.payer_id, payment.provider_id)
    and payment.status = 'approved'
    and payment.chat_id is not null
  order by
    case
      when payment.job_status = 'disputed' and coalesce(incident.status, '') not in ('resolved', 'dismissed') then 0
      when payment.job_status = 'confirmed' and (
        (payment.schedule_status = 'awaiting_provider_options' and auth.uid() = payment.provider_id)
        or (payment.schedule_status = 'awaiting_selection' and payment.schedule_proposed_by <> auth.uid())
      ) then 1
      when payment.job_status = 'confirmed' and payment.schedule_status = 'scheduled' then 2
      when payment.job_status = 'confirmed' then 3
      else 4
    end,
    payment.scheduled_start asc nulls last,
    payment.created_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 200));
$$;

revoke all on function public.safe_quote_scope(text) from public;
revoke all on function public.get_my_service_jobs(integer) from public;
grant execute on function public.get_my_service_jobs(integer) to authenticated, service_role;
