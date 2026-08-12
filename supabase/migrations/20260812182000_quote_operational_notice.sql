-- Evidencia de que el cliente vio el resumen operativo antes de iniciar el pago.

alter table public.service_confirmation_payments
  add column if not exists operational_notice_version text,
  add column if not exists operational_notice_accepted_at timestamptz;

