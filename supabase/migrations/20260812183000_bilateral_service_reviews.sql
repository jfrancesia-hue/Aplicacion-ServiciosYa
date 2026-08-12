-- Reputación bilateral: el cliente califica al prestador y, una vez cerrado el trabajo,
-- el prestador puede calificar al cliente. Las reseñas no disparan sanciones automáticas.

create table if not exists public.client_job_reviews (
  id uuid primary key default gen_random_uuid(),
  payment_record_id uuid not null unique
    references public.service_confirmation_payments(id) on delete restrict,
  chat_id uuid not null references public.chats(id) on delete restrict,
  reviewer_id uuid not null references auth.users(id) on delete restrict,
  client_id uuid not null references auth.users(id) on delete restrict,
  rating smallint not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 800),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_job_reviews_not_self check (reviewer_id <> client_id)
);

create index if not exists client_job_reviews_client_idx
  on public.client_job_reviews (client_id, created_at desc);
alter table public.client_job_reviews enable row level security;
drop policy if exists client_job_reviews_participants_read on public.client_job_reviews;
create policy client_job_reviews_participants_read
  on public.client_job_reviews for select to authenticated
  using (auth.uid() in (reviewer_id, client_id) or public.is_operational_admin());
drop policy if exists client_job_reviews_service_role_all on public.client_job_reviews;
create policy client_job_reviews_service_role_all
  on public.client_job_reviews for all to service_role using (true) with check (true);
grant select on public.client_job_reviews to authenticated;
grant all on public.client_job_reviews to service_role;

create or replace function public.submit_client_job_review(
  p_payment_record_id uuid,
  p_rating smallint,
  p_comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.service_confirmation_payments%rowtype;
  v_review public.client_job_reviews%rowtype;
  v_comment text := nullif(trim(coalesce(p_comment, '')), '');
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then raise exception 'INVALID_RATING'; end if;
  if v_comment is not null and char_length(v_comment) > 800 then raise exception 'COMMENT_TOO_LONG'; end if;

  select * into v_payment
  from public.service_confirmation_payments
  where id = p_payment_record_id for update;
  if not found then raise exception 'PAYMENT_NOT_FOUND'; end if;
  if v_payment.provider_id <> auth.uid() then raise exception 'ONLY_PROVIDER_CAN_REVIEW_CLIENT'; end if;
  if v_payment.status <> 'approved' or v_payment.job_status <> 'completed' then
    raise exception 'JOB_NOT_COMPLETED';
  end if;

  insert into public.client_job_reviews (
    payment_record_id, chat_id, reviewer_id, client_id, rating, comment
  ) values (
    v_payment.id, v_payment.chat_id, auth.uid(), v_payment.payer_id, p_rating, v_comment
  )
  on conflict (payment_record_id) do update
  set rating = excluded.rating, comment = excluded.comment, updated_at = now()
  returning * into v_review;

  return jsonb_build_object('ok', true, 'review_id', v_review.id, 'rating', v_review.rating);
end;
$$;

revoke all on function public.submit_client_job_review(uuid, smallint, text) from public;
grant execute on function public.submit_client_job_review(uuid, smallint, text) to authenticated, service_role;

create or replace view public.client_trust_summary as
select
  u.id as client_id,
  count(r.id)::integer as completed_reviews,
  round(avg(r.rating)::numeric, 2) as average_rating
from public.usuarios u
left join public.client_job_reviews r on r.client_id = u.id
group by u.id;
revoke all on public.client_trust_summary from anon, authenticated;
grant select on public.client_trust_summary to service_role;

create or replace function public.get_chat_job_status(p_chat_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_result jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;

  select jsonb_build_object(
    'payment_record_id', payment.id,
    'status', payment.status,
    'job_status', payment.job_status,
    'amount_total', payment.amount_total,
    'currency', payment.currency,
    'provider_id', payment.provider_id,
    'payer_id', payment.payer_id,
    'is_payer', payment.payer_id = auth.uid(),
    'can_review', payment.payer_id = auth.uid() and payment.status = 'approved'
      and payment.job_status = 'confirmed' and provider_review.id is null,
    'can_review_client', payment.provider_id = auth.uid() and payment.status = 'approved'
      and payment.job_status = 'completed' and client_review.id is null,
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
  ) into v_result
  from public.service_confirmation_payments payment
  left join public.service_job_reviews provider_review
    on provider_review.payment_record_id = payment.id
  left join public.client_job_reviews client_review
    on client_review.payment_record_id = payment.id
  left join public.client_trust_summary client_summary
    on client_summary.client_id = payment.payer_id
  left join public.service_job_incidents incident
    on incident.payment_record_id = payment.id
  where payment.chat_id = p_chat_id
    and payment.status = 'approved'
    and auth.uid() in (payment.payer_id, payment.provider_id)
  order by payment.approved_at desc nulls last, payment.created_at desc
  limit 1;

  return coalesce(v_result, '{}'::jsonb);
end;
$$;

revoke all on function public.get_chat_job_status(uuid) from public;
grant execute on function public.get_chat_job_status(uuid) to authenticated, service_role;

