-- Mantiene los RPC públicos como wrappers SECURITY INVOKER y mueve toda
-- implementación privilegiada a un schema no expuesto por PostgREST.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

do $migration$
declare
  target record;
  call_arguments text;
  call_sql text;
begin
  for target in
    select
      p.oid,
      p.proname,
      p.pronargs,
      p.proretset,
      pg_get_function_identity_arguments(p.oid) as identity_arguments,
      pg_get_function_arguments(p.oid) as function_arguments,
      pg_get_function_result(p.oid) as function_result
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and p.prosecdef
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')
    order by p.proname, p.oid
  loop
    select coalesce(string_agg('$' || position::text, ', '), '')
    into call_arguments
    from generate_series(1, target.pronargs) as position;

    execute format(
      'alter function public.%I(%s) set schema private',
      target.proname,
      target.identity_arguments
    );

    call_sql := case
      when target.proretset
        then format('select * from private.%I(%s)', target.proname, call_arguments)
      else format('select private.%I(%s)', target.proname, call_arguments)
    end;

    execute format(
      'create function public.%I(%s) returns %s language sql security invoker set search_path = '''' as $wrapper$ %s $wrapper$',
      target.proname,
      target.function_arguments,
      target.function_result,
      call_sql
    );

    execute format(
      'revoke execute on function private.%I(%s) from public, anon',
      target.proname,
      target.identity_arguments
    );
    execute format(
      'grant execute on function private.%I(%s) to authenticated, service_role',
      target.proname,
      target.identity_arguments
    );
    execute format(
      'revoke execute on function public.%I(%s) from public, anon',
      target.proname,
      target.identity_arguments
    );
    execute format(
      'grant execute on function public.%I(%s) to authenticated, service_role',
      target.proname,
      target.identity_arguments
    );
  end loop;
end;
$migration$;

-- Toda tabla cerrada sin políticas recibe una política denegatoria explícita.
-- Además de documentar la intención, evita que un grant futuro la abra por error.
do $$
declare
  target record;
begin
  for target in
    select n.nspname as schema_name, c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and c.relrowsecurity
      and not exists (
        select 1
        from pg_policy policy
        where policy.polrelid = c.oid
      )
  loop
    execute format(
      'create policy api_deny_all on %I.%I as restrictive for all to anon, authenticated using (false) with check (false)',
      target.schema_name,
      target.table_name
    );
  end loop;
end;
$$;

-- Fija el search_path de las funciones públicas restantes. Los wrappers
-- privilegiados ya usan search_path vacío; las funciones históricas necesitan
-- public para conservar sus referencias no calificadas.
do $$
declare
  target record;
begin
  for target in
    select
      p.proname,
      n.nspname,
      pg_get_function_identity_arguments(p.oid) as identity_arguments
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
  loop
    execute format(
      'alter function %I.%I(%s) set search_path = public, pg_temp',
      target.nspname,
      target.proname,
      target.identity_arguments
    );
  end loop;
end;
$$;
