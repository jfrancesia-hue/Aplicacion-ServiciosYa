-- Evidencia versionada de aceptación de términos y privacidad.

create table if not exists public.user_legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  document_set text not null,
  terms_version text not null,
  privacy_version text not null,
  source text not null check (
    source in (
      'client_registration',
      'provider_registration',
      'profile_completion',
      'account_update'
    )
  ),
  accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, document_set)
);

create index if not exists user_legal_acceptances_user_idx
  on public.user_legal_acceptances (user_id, accepted_at desc);

alter table public.user_legal_acceptances enable row level security;

drop policy if exists user_legal_acceptances_own_read
  on public.user_legal_acceptances;
create policy user_legal_acceptances_own_read
  on public.user_legal_acceptances for select to authenticated
  using (auth.uid() = user_id or public.is_operational_admin());

drop policy if exists user_legal_acceptances_service_role_all
  on public.user_legal_acceptances;
create policy user_legal_acceptances_service_role_all
  on public.user_legal_acceptances for all to service_role
  using (true) with check (true);

grant select on public.user_legal_acceptances to authenticated;
grant all on public.user_legal_acceptances to service_role;

create or replace function public.accept_current_legal_documents(
  p_document_set text,
  p_terms_version text,
  p_privacy_version text,
  p_source text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_acceptance public.user_legal_acceptances%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_document_set <> 'legal-2026-08-12-v1'
    or p_terms_version <> 'terms-2026-08-12-v1'
    or p_privacy_version <> 'privacy-2026-08-12-v1' then
    raise exception 'LEGAL_VERSION_INVALID';
  end if;
  if p_source not in (
    'client_registration',
    'provider_registration',
    'profile_completion',
    'account_update'
  ) then raise exception 'LEGAL_SOURCE_INVALID'; end if;

  insert into public.user_legal_acceptances (
    user_id,
    document_set,
    terms_version,
    privacy_version,
    source
  ) values (
    auth.uid(),
    p_document_set,
    p_terms_version,
    p_privacy_version,
    p_source
  )
  on conflict (user_id, document_set) do update
  set terms_version = excluded.terms_version,
      privacy_version = excluded.privacy_version,
      source = excluded.source
  returning * into v_acceptance;

  return jsonb_build_object(
    'ok', true,
    'acceptance_id', v_acceptance.id,
    'document_set', v_acceptance.document_set,
    'accepted_at', v_acceptance.accepted_at
  );
end;
$$;

revoke all on function public.accept_current_legal_documents(text, text, text, text)
  from public;
grant execute on function public.accept_current_legal_documents(text, text, text, text)
  to authenticated, service_role;
