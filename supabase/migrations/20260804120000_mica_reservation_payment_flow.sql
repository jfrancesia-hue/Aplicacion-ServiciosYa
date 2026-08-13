-- Unifica la seleccion de presupuestos de MICA con el cobro seguro existente.
-- Es aditiva: conserva los pagos por mensajes de chat y no modifica importes
-- historicos. Los nuevos pagos pueden originarse en un presupuesto de MICA y
-- crear el chat recien despues de la aprobacion de Mercado Pago.

alter table public.service_confirmation_payments
  add column if not exists origin text not null default 'chat_quote',
  add column if not exists offer_id bigint references public."nuevaOferta"(id) on delete restrict,
  add column if not exists budget_id bigint references public.presupuestos(id) on delete restrict;
alter table public.service_confirmation_payments
  alter column chat_id drop not null,
  alter column quote_message_id drop not null;
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'service_confirmation_payments_origin_check'
      and conrelid = 'public.service_confirmation_payments'::regclass
  ) then
    alter table public.service_confirmation_payments
      add constraint service_confirmation_payments_origin_check
      check (origin in ('chat_quote', 'mica_budget'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'service_confirmation_payments_source_check'
      and conrelid = 'public.service_confirmation_payments'::regclass
  ) then
    alter table public.service_confirmation_payments
      add constraint service_confirmation_payments_source_check
      check (
        (
          origin = 'chat_quote'
          and chat_id is not null
          and quote_message_id is not null
          and offer_id is null
          and budget_id is null
        )
        or
        (
          origin = 'mica_budget'
          and offer_id is not null
          and budget_id is not null
        )
      );
  end if;
end $$;
create unique index if not exists service_confirmation_payments_mica_budget_unique_idx
  on public.service_confirmation_payments (payer_id, budget_id)
  where budget_id is not null;
create index if not exists service_confirmation_payments_offer_idx
  on public.service_confirmation_payments (offer_id, created_at desc)
  where offer_id is not null;
