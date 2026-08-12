-- Intake guiado de reclamos por MICA antes de la derivación humana.

alter table public.service_job_incidents
  add column if not exists intake jsonb not null default '{}'::jsonb,
  add column if not exists requested_resolution text,
  add column if not exists intake_completed_at timestamptz;

create or replace function public.submit_service_incident_intake(
  p_payment_record_id uuid,
  p_category text,
  p_intake jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.service_confirmation_payments%rowtype;
  v_incident public.service_job_incidents%rowtype;
  v_case_number text;
  v_occurred text;
  v_contact_attempts text;
  v_impact text;
  v_evidence text;
  v_resolution text;
  v_details text;
  v_summary text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_category is null or p_category not in ('provider_no_show', 'work_not_completed', 'other') then
    raise exception 'INVALID_INCIDENT_CATEGORY';
  end if;
  if jsonb_typeof(p_intake) <> 'object' then raise exception 'INCIDENT_INTAKE_INVALID'; end if;

  v_occurred := left(nullif(trim(coalesce(p_intake->>'occurred', '')), ''), 1000);
  v_contact_attempts := left(nullif(trim(coalesce(p_intake->>'contactAttempts', '')), ''), 1000);
  v_impact := left(nullif(trim(coalesce(p_intake->>'impact', '')), ''), 1000);
  v_evidence := left(nullif(trim(coalesce(p_intake->>'evidence', '')), ''), 1000);
  v_resolution := left(nullif(trim(coalesce(p_intake->>'requestedResolution', '')), ''), 500);

  if v_occurred is null or v_contact_attempts is null or v_impact is null
    or v_evidence is null or v_resolution is null then
    raise exception 'INCIDENT_INTAKE_INCOMPLETE';
  end if;

  select * into v_payment
  from public.service_confirmation_payments
  where id = p_payment_record_id for update;
  if not found then raise exception 'PAYMENT_NOT_FOUND'; end if;
  if v_payment.payer_id <> auth.uid() then raise exception 'ONLY_PAYER_CAN_REPORT'; end if;
  if v_payment.status <> 'approved' then raise exception 'JOB_NOT_CONFIRMED'; end if;
  if v_payment.job_status = 'completed' then raise exception 'JOB_ALREADY_COMPLETED'; end if;

  select * into v_incident
  from public.service_job_incidents
  where payment_record_id = v_payment.id;
  if found then
    return jsonb_build_object(
      'ok', true, 'incident_id', v_incident.id,
      'case_number', v_incident.case_number, 'status', v_incident.status,
      'already_open', true, 'mica_summary', v_incident.mica_summary
    );
  end if;

  v_details := concat_ws(E'\n',
    'Qué ocurrió: ' || v_occurred,
    'Intentos de contacto: ' || v_contact_attempts,
    'Impacto: ' || v_impact,
    'Evidencia informada: ' || v_evidence,
    'Resolución solicitada: ' || v_resolution
  );
  v_summary := concat_ws(' ',
    case p_category
      when 'provider_no_show' then 'MICA: el cliente informa que el prestador no se presentó.'
      when 'work_not_completed' then 'MICA: el cliente informa que el trabajo no se realizó o quedó incompleto.'
      else 'MICA: el cliente solicita revisión humana de un problema con el servicio.'
    end,
    'Momento/contexto:', v_occurred || '.',
    'Contacto:', v_contact_attempts || '.',
    'Impacto:', v_impact || '.',
    'Evidencia:', v_evidence || '.',
    'Solicita:', v_resolution || '.'
  );

  v_case_number := 'SY-' || to_char(now(), 'YYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.service_job_incidents (
    case_number, payment_record_id, chat_id, reporter_id, provider_id,
    category, details, mica_summary, status, intake, requested_resolution,
    intake_completed_at
  ) values (
    v_case_number, v_payment.id, v_payment.chat_id, auth.uid(),
    v_payment.provider_id, p_category, left(v_details, 4000), left(v_summary, 4000),
    'escalated', jsonb_build_object(
      'occurred', v_occurred,
      'contactAttempts', v_contact_attempts,
      'impact', v_impact,
      'evidence', v_evidence,
      'requestedResolution', v_resolution,
      'version', 1
    ), v_resolution, now()
  ) returning * into v_incident;

  update public.service_confirmation_payments
  set job_status = 'disputed'
  where id = v_payment.id;

  insert into public.notificaciones (receptor_id, emisor_id, mensaje, estado, leido)
  values (
    v_payment.provider_id, auth.uid(),
    'Se abrió un reclamo del servicio. El equipo operativo revisará el caso.',
    'service_incident_opened', false
  );

  return jsonb_build_object(
    'ok', true, 'incident_id', v_incident.id,
    'case_number', v_incident.case_number, 'status', v_incident.status,
    'already_open', false, 'mica_summary', v_incident.mica_summary
  );
end;
$$;

revoke all on function public.submit_service_incident_intake(uuid, text, jsonb) from public;
grant execute on function public.submit_service_incident_intake(uuid, text, jsonb) to authenticated, service_role;
