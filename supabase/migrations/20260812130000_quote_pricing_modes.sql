-- Modalidades de presupuesto y total auditable usado para la comisión del 10%.

alter table public.presupuestos
  add column if not exists pricing_mode text not null default 'project',
  add column if not exists unit_rate numeric,
  add column if not exists estimated_units numeric,
  add column if not exists reference_total_type text not null default 'fixed';

update public.presupuestos
set unit_rate = coalesce(unit_rate, monto),
    estimated_units = coalesce(estimated_units, 1)
where unit_rate is null or estimated_units is null;

alter table public.presupuestos
  drop constraint if exists presupuestos_pricing_mode_check,
  add constraint presupuestos_pricing_mode_check
    check (pricing_mode in ('project', 'hour', 'day')),
  drop constraint if exists presupuestos_reference_total_type_check,
  add constraint presupuestos_reference_total_type_check
    check (reference_total_type in ('fixed', 'estimate', 'cap')),
  drop constraint if exists presupuestos_pricing_values_check,
  add constraint presupuestos_pricing_values_check
    check (
      monto is null or monto = 0 or (
        unit_rate > 0 and estimated_units > 0
        and abs(monto - round((unit_rate * estimated_units)::numeric, 2)) < 0.01
      )
    ) not valid;

alter table public.service_confirmation_payments
  add column if not exists pricing_mode text,
  add column if not exists unit_rate numeric,
  add column if not exists estimated_units numeric,
  add column if not exists reference_total_type text;

alter table public.service_confirmation_payments
  drop constraint if exists service_confirmation_payments_pricing_mode_check,
  add constraint service_confirmation_payments_pricing_mode_check
    check (pricing_mode is null or pricing_mode in ('project', 'hour', 'day')),
  drop constraint if exists service_confirmation_payments_reference_type_check,
  add constraint service_confirmation_payments_reference_type_check
    check (reference_total_type is null or reference_total_type in ('fixed', 'estimate', 'cap'));

create or replace function public.validate_structured_quote_pricing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payload jsonb;
  v_mode text;
  v_reference_type text;
  v_rate numeric;
  v_units numeric;
  v_amount numeric;
  v_expected numeric;
begin
  if left(coalesce(new.contenido, ''), 15) <> ('__TOO' || 'RI_QUOTE__') then
    return new;
  end if;

  begin
    v_payload := substring(new.contenido from 16)::jsonb;
  exception when others then
    raise exception 'CHAT_QUOTE_INVALID';
  end;

  -- Los presupuestos anteriores a esta versión siguen siendo válidos como proyecto cerrado.
  if not (v_payload ? 'pricingMode') then return new; end if;

  v_mode := v_payload->>'pricingMode';
  v_reference_type := v_payload->>'referenceType';
  begin
    v_rate := (v_payload->>'unitRate')::numeric;
    v_units := (v_payload->>'estimatedUnits')::numeric;
    v_amount := (v_payload->>'amount')::numeric;
  exception when others then
    raise exception 'CHAT_QUOTE_PRICING_INVALID';
  end;

  if v_mode not in ('project', 'hour', 'day')
    or v_reference_type not in ('fixed', 'estimate', 'cap')
    or v_rate <= 0 or v_units <= 0 or v_amount <= 0 then
    raise exception 'CHAT_QUOTE_PRICING_INVALID';
  end if;
  if v_mode = 'project' and (v_units <> 1 or v_reference_type <> 'fixed') then
    raise exception 'CHAT_QUOTE_PROJECT_INVALID';
  end if;
  if v_mode <> 'project' and v_reference_type = 'fixed' then
    raise exception 'CHAT_QUOTE_REFERENCE_INVALID';
  end if;

  v_expected := round(v_rate * v_units, 2);
  if abs(v_amount - v_expected) >= 0.01 then
    raise exception 'CHAT_QUOTE_TOTAL_MISMATCH';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_structured_quote_pricing on public.mensajes;
create trigger validate_structured_quote_pricing
before insert or update of contenido on public.mensajes
for each row execute function public.validate_structured_quote_pricing();
