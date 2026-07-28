create table if not exists public.service_confirmation_payments (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete restrict,
  quote_message_id uuid not null references public.mensajes(id) on delete restrict,
  payer_id uuid not null references auth.users(id) on delete restrict,
  provider_id uuid not null references auth.users(id) on delete restrict,
  amount_total numeric(14, 2) not null check (amount_total > 0),
  commission_amount numeric(14, 2) not null check (commission_amount > 0),
  currency text not null default 'ARS' check (currency = 'ARS'),
  preference_id text unique,
  checkout_url text,
  payment_id text unique,
  status text not null default 'creating'
    check (status in ('creating', 'pending', 'approved', 'rejected', 'cancelled', 'error')),
  confirmation_message_id uuid references public.mensajes(id) on delete set null,
  provider_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz,
  unique (payer_id, quote_message_id)
);

create index if not exists service_confirmation_payments_chat_idx
  on public.service_confirmation_payments (chat_id, created_at desc);

create index if not exists service_confirmation_payments_participants_idx
  on public.service_confirmation_payments (payer_id, provider_id, status);

alter table public.service_confirmation_payments enable row level security;

drop policy if exists service_confirmation_payments_participants_read
  on public.service_confirmation_payments;
create policy service_confirmation_payments_participants_read
  on public.service_confirmation_payments
  for select
  to authenticated
  using (auth.uid() = payer_id or auth.uid() = provider_id);

drop policy if exists service_confirmation_payments_service_role_all
  on public.service_confirmation_payments;
create policy service_confirmation_payments_service_role_all
  on public.service_confirmation_payments
  for all
  to service_role
  using (true)
  with check (true);

grant select on public.service_confirmation_payments to authenticated;
grant all on public.service_confirmation_payments to service_role;

create or replace function public.touch_service_confirmation_payment()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists service_confirmation_payments_touch
  on public.service_confirmation_payments;
create trigger service_confirmation_payments_touch
before update on public.service_confirmation_payments
for each row execute function public.touch_service_confirmation_payment();
