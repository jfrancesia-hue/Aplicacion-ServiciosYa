-- Cancelación de reservas, revisión de casos y devolución total del cargo.

alter table public.service_confirmation_payments
  drop constraint if exists service_confirmation_payments_status_check;

alter table public.service_confirmation_payments
  add constraint service_confirmation_payments_status_check
  check (
    status in (
      'creating',
      'pending',
      'approved',
      'rejected',
      'cancelled',
      'error',
      'refunded'
    )
  );

alter table public.service_confirmation_payments
  add column if not exists cancellation_status text not null default 'not_requested',
  add column if not exists cancelled_by uuid references auth.users(id) on delete set null,
  add column if not exists cancellation_reason text,
  add column if not exists refund_id text,
  add column if not exists refund_amount numeric(14, 2),
  add column if not exists refunded_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'service_confirmation_payments_cancellation_status_check'
      and conrelid = 'public.service_confirmation_payments'::regclass
  ) then
    alter table public.service_confirmation_payments
      add constraint service_confirmation_payments_cancellation_status_check
      check (
        cancellation_status in (
          'not_requested',
          'refund_pending',
          'review_required',
          'refunded',
          'refund_failed',
          'review_rejected'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'service_confirmation_payments_refund_amount_check'
      and conrelid = 'public.service_confirmation_payments'::regclass
  ) then
    alter table public.service_confirmation_payments
      add constraint service_confirmation_payments_refund_amount_check
      check (refund_amount is null or refund_amount > 0);
  end if;
end
$$;

create table if not exists public.service_cancellation_requests (
  id uuid primary key default gen_random_uuid(),
  request_code text not null unique,
  payment_record_id uuid not null
    references public.service_confirmation_payments(id) on delete restrict,
  chat_id uuid not null references public.chats(id) on delete restrict,
  requested_by uuid not null references auth.users(id) on delete restrict,
  requester_role text not null
    check (requester_role in ('client', 'provider', 'system')),
  reason_code text not null
    check (
      reason_code in (
        'client_changed_mind',
        'provider_cancelled',
        'provider_no_show',
        'scheduling_issue',
        'external_refund',
        'other'
      )
    ),
  reason_detail text,
  status text not null
    check (
      status in (
        'refund_pending',
        'review_required',
        'refunded',
        'refund_failed',
        'review_rejected'
      )
    ),
  auto_refund boolean not null default false,
  refund_id text,
  refund_amount numeric(14, 2),
  provider_status text,
  error_message text,
  resolution_note text,
  resolved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint service_cancellation_requests_detail_length check (
    reason_detail is null or char_length(reason_detail) <= 800
  ),
  constraint service_cancellation_requests_error_length check (
    error_message is null or char_length(error_message) <= 1000
  ),
  constraint service_cancellation_requests_resolution_note_length check (
    resolution_note is null or char_length(resolution_note) <= 800
  ),
  constraint service_cancellation_requests_refund_amount_check check (
    refund_amount is null or refund_amount > 0
  )
);

create index if not exists service_cancellation_requests_chat_idx
  on public.service_cancellation_requests (chat_id, created_at desc);

create index if not exists service_cancellation_requests_payment_idx
  on public.service_cancellation_requests (payment_record_id, created_at desc);

alter table public.service_cancellation_requests enable row level security;

drop policy if exists service_cancellation_requests_participants_read
  on public.service_cancellation_requests;
create policy service_cancellation_requests_participants_read
  on public.service_cancellation_requests
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.service_confirmation_payments payment
      where payment.id = service_cancellation_requests.payment_record_id
        and auth.uid() in (payment.payer_id, payment.provider_id)
    )
  );

drop policy if exists service_cancellation_requests_service_role_all
  on public.service_cancellation_requests;
create policy service_cancellation_requests_service_role_all
  on public.service_cancellation_requests
  for all
  to service_role
  using (true)
  with check (true);

grant select on public.service_cancellation_requests to authenticated;
grant all on public.service_cancellation_requests to service_role;

create or replace function public.touch_service_cancellation_request()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists service_cancellation_requests_touch
  on public.service_cancellation_requests;
create trigger service_cancellation_requests_touch
before update on public.service_cancellation_requests
for each row execute function public.touch_service_cancellation_request();

alter table public.service_confirmation_payments
  add column if not exists cancellation_request_id uuid
    references public.service_cancellation_requests(id) on delete set null;

create or replace function public.request_service_cancellation_internal(
  p_payment_record_id uuid,
  p_requester_id uuid,
  p_reason_code text,
  p_reason_detail text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.service_confirmation_payments%rowtype;
  v_request public.service_cancellation_requests%rowtype;
  v_request_id uuid := gen_random_uuid();
  v_request_code text;
  v_requester_role text;
  v_reason_code text := lower(trim(coalesce(p_reason_code, '')));
  v_reason_detail text := nullif(trim(coalesce(p_reason_detail, '')), '');
  v_auto_refund boolean;
  v_status text;
  v_content text;
begin
  if p_requester_id is null then
    raise exception 'REQUESTER_REQUIRED';
  end if;
  if v_reason_code not in (
    'client_changed_mind',
    'provider_cancelled',
    'provider_no_show',
    'scheduling_issue',
    'other'
  ) then
    raise exception 'INVALID_CANCELLATION_REASON';
  end if;
  if v_reason_detail is not null and char_length(v_reason_detail) > 800 then
    raise exception 'CANCELLATION_DETAIL_TOO_LONG';
  end if;

  select * into v_payment
  from public.service_confirmation_payments
  where id = p_payment_record_id
  for update;

  if not found then
    raise exception 'PAYMENT_NOT_FOUND';
  end if;
  if p_requester_id not in (v_payment.payer_id, v_payment.provider_id) then
    raise exception 'CANCELLATION_FORBIDDEN';
  end if;

  if v_payment.cancellation_request_id is not null then
    select * into v_request
    from public.service_cancellation_requests
    where id = v_payment.cancellation_request_id
    for update;
  end if;

  if v_request.id is not null and v_request.status <> 'review_rejected' then
    return jsonb_build_object(
      'ok', true,
      'request_id', v_request.id,
      'request_code', v_request.request_code,
      'status', v_request.status,
      'action', case
        when v_request.status = 'refund_pending' then 'refund'
        when v_request.status = 'refunded' then 'refunded'
        else 'review'
      end,
      'payment_id', v_payment.payment_id,
      'refund_amount', v_payment.commission_amount
    );
  end if;

  if v_payment.status <> 'approved' or v_payment.job_status <> 'confirmed' then
    raise exception 'RESERVATION_NOT_CANCELLABLE';
  end if;
  if v_payment.cancellation_status not in ('not_requested', 'review_rejected') then
    raise exception 'CANCELLATION_ALREADY_REQUESTED';
  end if;

  v_requester_role := case
    when p_requester_id = v_payment.provider_id then 'provider'
    else 'client'
  end;

  if v_requester_role = 'provider' then
    v_reason_code := 'provider_cancelled';
  elsif v_reason_code = 'provider_cancelled' then
    raise exception 'INVALID_CANCELLATION_REASON';
  end if;

  v_auto_refund :=
    v_payment.payment_id is not null
    and (
      v_requester_role = 'provider'
      or (
        v_reason_code <> 'provider_no_show'
        and not (
          v_payment.visit_status = 'scheduled'
          and v_payment.visit_scheduled_for is not null
          and v_payment.visit_scheduled_for <= now()
        )
      )
    );
  v_status := case when v_auto_refund then 'refund_pending' else 'review_required' end;
  v_request_code := 'SY-' || upper(substr(replace(v_request_id::text, '-', ''), 1, 10));

  insert into public.service_cancellation_requests (
    id,
    request_code,
    payment_record_id,
    chat_id,
    requested_by,
    requester_role,
    reason_code,
    reason_detail,
    status,
    auto_refund
  ) values (
    v_request_id,
    v_request_code,
    v_payment.id,
    v_payment.chat_id,
    p_requester_id,
    v_requester_role,
    v_reason_code,
    v_reason_detail,
    v_status,
    v_auto_refund
  );

  update public.service_confirmation_payments
  set
    cancellation_status = v_status,
    cancellation_request_id = v_request_id,
    cancelled_by = p_requester_id,
    cancellation_reason = v_reason_code,
    job_status = 'disputed'
  where id = v_payment.id;

  v_content := '__SERVICIOSYA_SYSTEM_V1__:' || jsonb_build_object(
    'kind', case
      when v_auto_refund then 'cancellation_requested'
      else 'cancellation_review'
    end,
    'title', case
      when v_auto_refund then 'Cancelacion solicitada'
      else 'Cancelacion en revision'
    end,
    'text', case
      when v_auto_refund then
        'La solicitud ' || v_request_code || ' fue registrada. ServiciosYa esta procesando la devolucion total del cargo de reserva.'
      else
        'La solicitud ' || v_request_code || ' fue registrada para revision porque la visita pudo haber comenzado o requiere validar lo ocurrido.'
    end,
    'actorId', p_requester_id,
    'eventId', v_request_id
  )::text;

  insert into public.mensajes (chat_id, remitente_id, contenido)
  values (v_payment.chat_id, p_requester_id, v_content);

  update public.chats set updated_at = now() where id = v_payment.chat_id;

  return jsonb_build_object(
    'ok', true,
    'request_id', v_request_id,
    'request_code', v_request_code,
    'status', v_status,
    'action', case when v_auto_refund then 'refund' else 'review' end,
    'payment_id', v_payment.payment_id,
    'refund_amount', v_payment.commission_amount
  );
end;
$$;

revoke all on function public.request_service_cancellation_internal(
  uuid, uuid, text, text
) from public;
grant execute on function public.request_service_cancellation_internal(
  uuid, uuid, text, text
) to service_role;

create or replace function public.reconcile_service_reservation_refund(
  p_payment_record_id uuid,
  p_request_id uuid,
  p_payment_id text,
  p_refund_id text,
  p_refund_amount numeric,
  p_provider_status text default 'refunded'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.service_confirmation_payments%rowtype;
  v_request public.service_cancellation_requests%rowtype;
  v_request_id uuid;
  v_request_code text;
  v_now timestamptz := now();
  v_content text;
begin
  select * into v_payment
  from public.service_confirmation_payments
  where id = p_payment_record_id
  for update;

  if not found then
    raise exception 'PAYMENT_NOT_FOUND';
  end if;
  if trim(coalesce(p_payment_id, '')) <> coalesce(v_payment.payment_id, '') then
    raise exception 'REFUND_PAYMENT_MISMATCH';
  end if;
  if p_refund_amount is null
    or abs(p_refund_amount - v_payment.commission_amount) >= 0.01 then
    raise exception 'REFUND_AMOUNT_MISMATCH';
  end if;

  if v_payment.status = 'refunded'
    and v_payment.cancellation_status = 'refunded' then
    return jsonb_build_object(
      'ok', true,
      'refunded', true,
      'request_id', v_payment.cancellation_request_id,
      'refund_id', v_payment.refund_id
    );
  end if;

  if p_request_id is not null then
    select * into v_request
    from public.service_cancellation_requests
    where id = p_request_id
      and payment_record_id = v_payment.id
    for update;
  elsif v_payment.cancellation_request_id is not null then
    select * into v_request
    from public.service_cancellation_requests
    where id = v_payment.cancellation_request_id
    for update;
  end if;

  if v_request.id is not null then
    if p_request_id is not null and v_request.id <> p_request_id then
      raise exception 'REFUND_REQUEST_MISMATCH';
    end if;
    v_request_id := v_request.id;
    v_request_code := v_request.request_code;

    update public.service_cancellation_requests
    set
      status = 'refunded',
      refund_id = nullif(trim(coalesce(p_refund_id, '')), ''),
      refund_amount = p_refund_amount,
      provider_status = coalesce(nullif(trim(p_provider_status), ''), 'refunded'),
      error_message = null,
      resolved_at = v_now
    where id = v_request.id;
  else
    v_request_id := coalesce(p_request_id, gen_random_uuid());
    v_request_code := 'SY-' || upper(substr(replace(v_request_id::text, '-', ''), 1, 10));

    insert into public.service_cancellation_requests (
      id,
      request_code,
      payment_record_id,
      chat_id,
      requested_by,
      requester_role,
      reason_code,
      status,
      auto_refund,
      refund_id,
      refund_amount,
      provider_status,
      resolved_at
    ) values (
      v_request_id,
      v_request_code,
      v_payment.id,
      v_payment.chat_id,
      v_payment.payer_id,
      'system',
      'external_refund',
      'refunded',
      true,
      nullif(trim(coalesce(p_refund_id, '')), ''),
      p_refund_amount,
      coalesce(nullif(trim(p_provider_status), ''), 'refunded'),
      v_now
    );
  end if;

  update public.service_confirmation_payments
  set
    status = 'refunded',
    job_status = 'cancelled',
    visit_status = 'cancelled',
    cancellation_status = 'refunded',
    cancellation_request_id = v_request_id,
    refund_id = nullif(trim(coalesce(p_refund_id, '')), ''),
    refund_amount = p_refund_amount,
    refunded_at = v_now,
    provider_status = coalesce(nullif(trim(p_provider_status), ''), 'refunded')
  where id = v_payment.id;

  if v_payment.chat_quote_id is not null then
    update public.chat_quotes
    set status = 'cancelled'
    where id = v_payment.chat_quote_id;
  end if;

  update public.chats chat
  set
    acceso_contratado = exists (
      select 1
      from public.service_confirmation_payments active_payment
      where active_payment.chat_id = chat.id
        and active_payment.id <> v_payment.id
        and active_payment.status = 'approved'
        and active_payment.job_status in ('confirmed', 'completed')
    ),
    updated_at = v_now
  where chat.id = v_payment.chat_id;

  v_content := '__SERVICIOSYA_SYSTEM_V1__:' || jsonb_build_object(
    'kind', 'reservation_refunded',
    'title', 'Reserva cancelada y devuelta',
    'text', 'La devolucion total del cargo de reserva fue procesada. Codigo: ' || v_request_code || '. La acreditacion depende de los plazos del medio de pago.',
    'actorId', v_payment.payer_id,
    'eventId', v_request_id
  )::text;

  insert into public.mensajes (chat_id, remitente_id, contenido)
  values (v_payment.chat_id, v_payment.payer_id, v_content);

  return jsonb_build_object(
    'ok', true,
    'refunded', true,
    'request_id', v_request_id,
    'request_code', v_request_code,
    'refund_id', nullif(trim(coalesce(p_refund_id, '')), ''),
    'refund_amount', p_refund_amount
  );
end;
$$;

revoke all on function public.reconcile_service_reservation_refund(
  uuid, uuid, text, text, numeric, text
) from public;
grant execute on function public.reconcile_service_reservation_refund(
  uuid, uuid, text, text, numeric, text
) to service_role;

create or replace function public.fail_service_reservation_refund(
  p_request_id uuid,
  p_error_message text,
  p_provider_status text default 'refund_error'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.service_cancellation_requests%rowtype;
  v_payment public.service_confirmation_payments%rowtype;
  v_error text := left(coalesce(nullif(trim(p_error_message), ''), 'No se pudo procesar la devolucion'), 1000);
  v_content text;
begin
  select * into v_request
  from public.service_cancellation_requests
  where id = p_request_id;

  if not found then
    raise exception 'CANCELLATION_REQUEST_NOT_FOUND';
  end if;
  if v_request.status = 'refunded' then
    return jsonb_build_object('ok', true, 'status', 'refunded');
  end if;

  select * into v_payment
  from public.service_confirmation_payments
  where id = v_request.payment_record_id
  for update;

  select * into v_request
  from public.service_cancellation_requests
  where id = p_request_id
  for update;

  if v_request.status = 'refunded' then
    return jsonb_build_object('ok', true, 'status', 'refunded');
  end if;

  update public.service_cancellation_requests
  set
    status = 'refund_failed',
    provider_status = coalesce(nullif(trim(p_provider_status), ''), 'refund_error'),
    error_message = v_error
  where id = v_request.id;

  update public.service_confirmation_payments
  set
    cancellation_status = 'refund_failed',
    job_status = 'disputed'
  where id = v_payment.id;

  v_content := '__SERVICIOSYA_SYSTEM_V1__:' || jsonb_build_object(
    'kind', 'refund_failed',
    'title', 'Devolucion pendiente de revision',
    'text', 'No pudimos completar automaticamente la devolucion de la solicitud ' || v_request.request_code || '. El caso quedo registrado para revision.',
    'actorId', v_request.requested_by,
    'eventId', v_request.id
  )::text;

  insert into public.mensajes (chat_id, remitente_id, contenido)
  values (v_payment.chat_id, v_request.requested_by, v_content);

  update public.chats set updated_at = now() where id = v_payment.chat_id;

  return jsonb_build_object(
    'ok', true,
    'status', 'refund_failed',
    'request_id', v_request.id,
    'request_code', v_request.request_code
  );
end;
$$;

revoke all on function public.fail_service_reservation_refund(uuid, text, text)
  from public;
grant execute on function public.fail_service_reservation_refund(uuid, text, text)
  to service_role;

create or replace function public.prepare_service_cancellation_refund_internal(
  p_request_id uuid,
  p_resolved_by uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.service_cancellation_requests%rowtype;
  v_payment public.service_confirmation_payments%rowtype;
begin
  if not exists (
    select 1
    from public.usuarios
    where id = p_resolved_by
      and rol = 'admin'
  ) then
    raise exception 'CANCELLATION_REVIEWER_NOT_ADMIN';
  end if;

  select * into v_request
  from public.service_cancellation_requests
  where id = p_request_id;

  if not found then
    raise exception 'CANCELLATION_REQUEST_NOT_FOUND';
  end if;

  select * into v_payment
  from public.service_confirmation_payments
  where id = v_request.payment_record_id
  for update;

  select * into v_request
  from public.service_cancellation_requests
  where id = p_request_id
  for update;

  if v_request.status = 'refunded' then
    return jsonb_build_object(
      'ok', true,
      'already_refunded', true,
      'payment_record_id', v_payment.id,
      'payment_id', v_payment.payment_id,
      'refund_amount', v_payment.commission_amount
    );
  end if;
  if v_request.status not in (
    'review_required',
    'refund_failed',
    'refund_pending'
  ) then
    raise exception 'CANCELLATION_NOT_REVIEWABLE';
  end if;
  if v_payment.status <> 'approved' or v_payment.payment_id is null then
    raise exception 'PAYMENT_NOT_REFUNDABLE';
  end if;

  update public.service_cancellation_requests
  set
    status = 'refund_pending',
    error_message = null,
    resolution_note = null,
    resolved_by = p_resolved_by,
    resolved_at = null
  where id = v_request.id;

  update public.service_confirmation_payments
  set
    cancellation_status = 'refund_pending',
    cancellation_request_id = v_request.id,
    job_status = 'disputed'
  where id = v_payment.id;

  return jsonb_build_object(
    'ok', true,
    'already_refunded', false,
    'request_id', v_request.id,
    'request_code', v_request.request_code,
    'payment_record_id', v_payment.id,
    'payment_id', v_payment.payment_id,
    'refund_amount', v_payment.commission_amount
  );
end;
$$;

revoke all on function public.prepare_service_cancellation_refund_internal(
  uuid, uuid
)
  from public;
grant execute on function public.prepare_service_cancellation_refund_internal(
  uuid, uuid
)
  to service_role;

create or replace function public.reject_service_cancellation_review_internal(
  p_request_id uuid,
  p_resolved_by uuid,
  p_resolution_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.service_cancellation_requests%rowtype;
  v_payment public.service_confirmation_payments%rowtype;
  v_note text := left(
    coalesce(
      nullif(trim(p_resolution_note), ''),
      'La revision determino que no corresponde devolver el cargo de reserva.'
    ),
    800
  );
  v_content text;
begin
  if not exists (
    select 1
    from public.usuarios
    where id = p_resolved_by
      and rol = 'admin'
  ) then
    raise exception 'CANCELLATION_REVIEWER_NOT_ADMIN';
  end if;

  select * into v_request
  from public.service_cancellation_requests
  where id = p_request_id;

  if not found then
    raise exception 'CANCELLATION_REQUEST_NOT_FOUND';
  end if;
  if v_request.status = 'review_rejected' then
    return jsonb_build_object(
      'ok', true,
      'status', 'review_rejected',
      'request_id', v_request.id,
      'request_code', v_request.request_code
    );
  end if;
  select * into v_payment
  from public.service_confirmation_payments
  where id = v_request.payment_record_id
  for update;

  select * into v_request
  from public.service_cancellation_requests
  where id = p_request_id
  for update;

  if v_request.status <> 'review_required' or v_request.auto_refund then
    raise exception 'CANCELLATION_REJECTION_NOT_ALLOWED';
  end if;

  update public.service_cancellation_requests
  set
    status = 'review_rejected',
    resolution_note = v_note,
    resolved_by = p_resolved_by,
    error_message = null,
    resolved_at = now()
  where id = v_request.id;

  update public.service_confirmation_payments
  set
    cancellation_status = 'review_rejected',
    job_status = 'confirmed'
  where id = v_payment.id;

  v_content := '__SERVICIOSYA_SYSTEM_V1__:' || jsonb_build_object(
    'kind', 'cancellation_rejected',
    'title', 'Solicitud de cancelacion revisada',
    'text', 'La solicitud ' || v_request.request_code || ' fue revisada y no se aprobo la devolucion. La reserva vuelve a estar activa.',
    'actorId', v_request.requested_by,
    'eventId', v_request.id
  )::text;

  insert into public.mensajes (chat_id, remitente_id, contenido)
  values (v_payment.chat_id, v_request.requested_by, v_content);

  update public.chats set updated_at = now() where id = v_payment.chat_id;

  return jsonb_build_object(
    'ok', true,
    'status', 'review_rejected',
    'request_id', v_request.id,
    'request_code', v_request.request_code
  );
end;
$$;

revoke all on function public.reject_service_cancellation_review_internal(
  uuid, uuid, text
) from public;
grant execute on function public.reject_service_cancellation_review_internal(
  uuid, uuid, text
) to service_role;

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
    'provider_id', payment.provider_id,
    'payer_id', payment.payer_id,
    'is_payer', payment.payer_id = auth.uid(),
    'is_provider', payment.provider_id = auth.uid(),
    'can_review',
      payment.payer_id = auth.uid()
      and payment.status = 'approved'
      and payment.job_status = 'confirmed'
      and payment.cancellation_status in ('not_requested', 'review_rejected')
      and review.id is null,
    'can_cancel',
      auth.uid() in (payment.payer_id, payment.provider_id)
      and payment.status = 'approved'
      and payment.job_status = 'confirmed'
      and payment.cancellation_status in ('not_requested', 'review_rejected'),
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
    'rating', review.rating,
    'reviewed_at', review.created_at
  )
  into v_result
  from public.service_confirmation_payments as payment
  left join public.service_job_reviews as review
    on review.payment_record_id = payment.id
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
grant execute on function public.get_chat_job_status(uuid) to authenticated;
grant execute on function public.get_chat_job_status(uuid) to service_role;

create or replace function public.guard_service_visit_cancellation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.cancellation_status not in ('not_requested', 'review_rejected')
    and new.visit_status is distinct from old.visit_status
    and not (
      new.status = 'refunded'
      and new.job_status = 'cancelled'
      and new.visit_status = 'cancelled'
    ) then
    raise exception 'CANCELLATION_IN_PROGRESS';
  end if;
  return new;
end;
$$;

drop trigger if exists service_visit_cancellation_guard
  on public.service_confirmation_payments;
create trigger service_visit_cancellation_guard
before update of visit_status on public.service_confirmation_payments
for each row execute function public.guard_service_visit_cancellation();
