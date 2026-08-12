-- Agenda operativa posterior al pago: hasta tres opciones y reprogramaciones aceptadas.

alter table public.service_confirmation_payments
  add column if not exists schedule_status text not null default 'not_ready',
  add column if not exists schedule_round integer not null default 0,
  add column if not exists scheduled_start timestamptz,
  add column if not exists scheduled_end timestamptz,
  add column if not exists scheduled_timezone text,
  add column if not exists schedule_proposed_by uuid references auth.users(id) on delete set null,
  add column if not exists scheduled_at timestamptz;

alter table public.service_confirmation_payments
  drop constraint if exists service_confirmation_payments_schedule_status_check,
  add constraint service_confirmation_payments_schedule_status_check
    check (schedule_status in ('not_ready', 'awaiting_provider_options', 'awaiting_selection', 'scheduled'));

update public.service_confirmation_payments
set schedule_status = 'awaiting_provider_options'
where status = 'approved' and job_status = 'confirmed' and schedule_status = 'not_ready';

create table if not exists public.service_schedule_proposals (
  id uuid primary key default gen_random_uuid(),
  payment_record_id uuid not null references public.service_confirmation_payments(id) on delete restrict,
  chat_id uuid not null references public.chats(id) on delete restrict,
  round integer not null check (round > 0),
  proposed_by uuid not null references auth.users(id) on delete restrict,
  reason text not null check (reason in ('initial', 'reschedule')),
  status text not null default 'pending' check (status in ('pending', 'selected', 'superseded', 'cancelled')),
  created_at timestamptz not null default now(),
  selected_at timestamptz,
  unique (payment_record_id, round)
);

create table if not exists public.service_schedule_slots (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.service_schedule_proposals(id) on delete cascade,
  position integer not null check (position between 1 and 3),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null default 'America/Buenos_Aires',
  selected boolean not null default false,
  created_at timestamptz not null default now(),
  unique (proposal_id, position),
  check (ends_at > starts_at)
);

alter table public.service_schedule_proposals
  add column if not exists selected_slot_id uuid references public.service_schedule_slots(id) on delete set null;

create index if not exists service_schedule_proposals_payment_idx
  on public.service_schedule_proposals (payment_record_id, round desc);
create index if not exists service_schedule_slots_starts_idx
  on public.service_schedule_slots (starts_at);

alter table public.service_schedule_proposals enable row level security;
alter table public.service_schedule_slots enable row level security;

drop policy if exists service_schedule_proposals_participants_read on public.service_schedule_proposals;
create policy service_schedule_proposals_participants_read
  on public.service_schedule_proposals for select to authenticated
  using (exists (
    select 1 from public.service_confirmation_payments p
    where p.id = payment_record_id and auth.uid() in (p.payer_id, p.provider_id)
  ));

drop policy if exists service_schedule_slots_participants_read on public.service_schedule_slots;
create policy service_schedule_slots_participants_read
  on public.service_schedule_slots for select to authenticated
  using (exists (
    select 1
    from public.service_schedule_proposals proposal
    join public.service_confirmation_payments p on p.id = proposal.payment_record_id
    where proposal.id = proposal_id and auth.uid() in (p.payer_id, p.provider_id)
  ));

drop policy if exists service_schedule_proposals_service_role_all on public.service_schedule_proposals;
create policy service_schedule_proposals_service_role_all
  on public.service_schedule_proposals for all to service_role
  using (true) with check (true);
drop policy if exists service_schedule_slots_service_role_all on public.service_schedule_slots;
create policy service_schedule_slots_service_role_all
  on public.service_schedule_slots for all to service_role
  using (true) with check (true);

grant select on public.service_schedule_proposals, public.service_schedule_slots to authenticated;
grant all on public.service_schedule_proposals, public.service_schedule_slots to service_role;

create or replace function public.propose_service_schedule(
  p_payment_record_id uuid,
  p_slots jsonb,
  p_reason text default 'initial'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.service_confirmation_payments%rowtype;
  v_proposal public.service_schedule_proposals%rowtype;
  v_slot jsonb;
  v_position integer;
  v_start timestamptz;
  v_end timestamptz;
  v_timezone text;
  v_recipient uuid;
  v_count integer;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if jsonb_typeof(p_slots) <> 'array' then raise exception 'SCHEDULE_SLOTS_INVALID'; end if;
  v_count := jsonb_array_length(p_slots);
  if v_count < 1 or v_count > 3 then raise exception 'SCHEDULE_SLOTS_LIMIT'; end if;

  select * into v_payment
  from public.service_confirmation_payments
  where id = p_payment_record_id
  for update;
  if not found then raise exception 'PAYMENT_NOT_FOUND'; end if;
  if auth.uid() not in (v_payment.payer_id, v_payment.provider_id) then
    raise exception 'PAYMENT_PARTICIPANT_REQUIRED';
  end if;
  if v_payment.status <> 'approved' or v_payment.job_status <> 'confirmed' then
    raise exception 'JOB_NOT_SCHEDULABLE';
  end if;
  if v_payment.schedule_status = 'awaiting_selection' and exists (
    select 1
    from public.service_schedule_proposals proposal
    join public.service_schedule_slots slot on slot.proposal_id = proposal.id
    where proposal.payment_record_id = v_payment.id
      and proposal.round = v_payment.schedule_round
      and proposal.status = 'pending' and slot.starts_at > now()
  ) then
    raise exception 'SCHEDULE_SELECTION_PENDING';
  end if;

  if v_payment.scheduled_start is null then
    if auth.uid() <> v_payment.provider_id then raise exception 'INITIAL_SCHEDULE_PROVIDER_ONLY'; end if;
    p_reason := 'initial';
  elsif p_reason <> 'reschedule' then
    raise exception 'RESCHEDULE_REASON_REQUIRED';
  end if;

  v_recipient := case when auth.uid() = v_payment.payer_id
    then v_payment.provider_id else v_payment.payer_id end;

  update public.service_schedule_proposals
  set status = 'superseded'
  where payment_record_id = v_payment.id and status = 'pending';

  insert into public.service_schedule_proposals (
    payment_record_id, chat_id, round, proposed_by, reason
  ) values (
    v_payment.id, v_payment.chat_id, v_payment.schedule_round + 1, auth.uid(), p_reason
  ) returning * into v_proposal;

  for v_slot, v_position in
    select value, ordinality::integer from jsonb_array_elements(p_slots) with ordinality
  loop
    begin
      v_start := (v_slot->>'startsAt')::timestamptz;
      v_end := coalesce(nullif(v_slot->>'endsAt', '')::timestamptz, v_start + interval '1 hour');
    exception when others then
      raise exception 'SCHEDULE_DATE_INVALID';
    end;
    v_timezone := coalesce(nullif(trim(v_slot->>'timezone'), ''), 'America/Buenos_Aires');
    if v_start < now() + interval '30 minutes' or v_start > now() + interval '365 days'
      or v_end <= v_start or v_end > v_start + interval '14 days' then
      raise exception 'SCHEDULE_DATE_OUT_OF_RANGE';
    end if;
    if exists (
      select 1 from public.service_schedule_slots s
      where s.proposal_id = v_proposal.id and s.starts_at = v_start
    ) then raise exception 'SCHEDULE_SLOT_DUPLICATE'; end if;

    insert into public.service_schedule_slots (
      proposal_id, position, starts_at, ends_at, timezone
    ) values (v_proposal.id, v_position, v_start, v_end, v_timezone);
  end loop;

  update public.service_confirmation_payments
  set schedule_status = 'awaiting_selection',
      schedule_round = v_proposal.round,
      schedule_proposed_by = auth.uid()
  where id = v_payment.id;

  insert into public.notificaciones (receptor_id, emisor_id, mensaje, estado, leido)
  values (
    v_recipient, auth.uid(),
    case when p_reason = 'initial'
      then 'Tenés nuevas opciones de fecha para elegir en el chat.'
      else 'Te propusieron nuevas opciones para reprogramar el trabajo.' end,
    'schedule_selection', false
  );

  return jsonb_build_object(
    'ok', true, 'proposal_id', v_proposal.id,
    'round', v_proposal.round, 'slot_count', v_count
  );
end;
$$;

create or replace function public.select_service_schedule_slot(
  p_proposal_id uuid,
  p_slot_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proposal public.service_schedule_proposals%rowtype;
  v_payment public.service_confirmation_payments%rowtype;
  v_slot public.service_schedule_slots%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_proposal
  from public.service_schedule_proposals
  where id = p_proposal_id for update;
  if not found or v_proposal.status <> 'pending' then raise exception 'SCHEDULE_PROPOSAL_NOT_PENDING'; end if;

  select * into v_payment
  from public.service_confirmation_payments
  where id = v_proposal.payment_record_id for update;
  if auth.uid() not in (v_payment.payer_id, v_payment.provider_id) then
    raise exception 'PAYMENT_PARTICIPANT_REQUIRED';
  end if;
  if auth.uid() = v_proposal.proposed_by then raise exception 'SCHEDULE_OTHER_PARTY_MUST_SELECT'; end if;

  select * into v_slot
  from public.service_schedule_slots
  where id = p_slot_id and proposal_id = v_proposal.id;
  if not found then raise exception 'SCHEDULE_SLOT_NOT_FOUND'; end if;
  if v_slot.starts_at <= now() then raise exception 'SCHEDULE_SLOT_EXPIRED'; end if;

  update public.service_schedule_slots set selected = (id = v_slot.id)
  where proposal_id = v_proposal.id;
  update public.service_schedule_proposals
  set status = 'selected', selected_slot_id = v_slot.id, selected_at = now()
  where id = v_proposal.id;
  update public.service_confirmation_payments
  set schedule_status = 'scheduled', scheduled_start = v_slot.starts_at,
      scheduled_end = v_slot.ends_at, scheduled_timezone = v_slot.timezone,
      scheduled_at = now()
  where id = v_payment.id;

  insert into public.notificaciones (receptor_id, emisor_id, mensaje, estado, leido)
  values (
    v_proposal.proposed_by, auth.uid(),
    'La fecha del trabajo fue confirmada. Revisala en el chat.',
    'schedule_confirmed', false
  );

  return jsonb_build_object(
    'ok', true, 'payment_record_id', v_payment.id,
    'starts_at', v_slot.starts_at, 'ends_at', v_slot.ends_at,
    'timezone', v_slot.timezone
  );
end;
$$;

create or replace function public.get_chat_schedule(p_chat_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;

  select jsonb_build_object(
    'payment_record_id', payment.id,
    'schedule_status', payment.schedule_status,
    'schedule_round', payment.schedule_round,
    'scheduled_start', payment.scheduled_start,
    'scheduled_end', payment.scheduled_end,
    'scheduled_timezone', payment.scheduled_timezone,
    'is_provider', auth.uid() = payment.provider_id,
    'is_payer', auth.uid() = payment.payer_id,
    'can_propose_initial', auth.uid() = payment.provider_id
      and payment.schedule_status = 'awaiting_provider_options',
    'can_propose_reschedule', payment.schedule_status = 'scheduled',
    'proposal_id', proposal.id,
    'proposal_reason', proposal.reason,
    'proposal_status', proposal.status,
    'proposed_by_me', proposal.proposed_by = auth.uid(),
    'can_select', proposal.status = 'pending' and proposal.proposed_by <> auth.uid(),
    'options_expired', proposal.status = 'pending' and not exists (
      select 1 from public.service_schedule_slots future_slot
      where future_slot.proposal_id = proposal.id and future_slot.starts_at > now()
    ),
    'can_replace_expired', proposal.status = 'pending'
      and proposal.proposed_by = auth.uid() and not exists (
        select 1 from public.service_schedule_slots future_slot
        where future_slot.proposal_id = proposal.id and future_slot.starts_at > now()
      ),
    'slots', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', slot.id, 'position', slot.position,
        'starts_at', slot.starts_at, 'ends_at', slot.ends_at,
        'timezone', slot.timezone, 'selected', slot.selected
      ) order by slot.position)
      from public.service_schedule_slots slot where slot.proposal_id = proposal.id
    ), '[]'::jsonb)
  ) into v_result
  from public.service_confirmation_payments payment
  left join public.service_schedule_proposals proposal
    on proposal.payment_record_id = payment.id and proposal.round = payment.schedule_round
  where payment.chat_id = p_chat_id and payment.status = 'approved'
    and payment.job_status = 'confirmed'
    and auth.uid() in (payment.payer_id, payment.provider_id)
  order by payment.approved_at desc nulls last, payment.created_at desc
  limit 1;

  return coalesce(v_result, '{}'::jsonb);
end;
$$;

revoke all on function public.propose_service_schedule(uuid, jsonb, text) from public;
revoke all on function public.select_service_schedule_slot(uuid, uuid) from public;
revoke all on function public.get_chat_schedule(uuid) from public;
grant execute on function public.propose_service_schedule(uuid, jsonb, text) to authenticated, service_role;
grant execute on function public.select_service_schedule_slot(uuid, uuid) to authenticated, service_role;
grant execute on function public.get_chat_schedule(uuid) to authenticated, service_role;
