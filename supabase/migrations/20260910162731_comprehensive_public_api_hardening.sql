-- Cierra el Data API por defecto y abre solo los recursos que usa la app.
-- También elimina secretos embebidos en triggers y expone un perfil público
-- separado de la fila privada de cada usuario.

-- usuarios.id es el identificador de Auth usado por toda la app. La clave
-- compuesta histórica permitía duplicarlo. Conservamos la fila cuyo email
-- coincide con Auth y retiramos cualquier duplicado huérfano equivalente.
delete from public.usuarios candidate
using auth.users auth_user
where candidate.id = auth_user.id
  and candidate.email is distinct from auth_user.email
  and exists (
    select 1
    from public.usuarios canonical
    where canonical.id = candidate.id
      and canonical.email = auth_user.email
  );

do $$
begin
  if exists (
    select 1 from public.usuarios group by id having count(*) > 1
  ) then
    raise exception 'DUPLICATE_USUARIOS_ID_REQUIRES_MANUAL_REVIEW';
  end if;
end;
$$;

alter table public.usuarios drop constraint if exists usuarios_pkey;
alter table public.usuarios add constraint usuarios_pkey primary key (id);

create table if not exists public.user_public_profiles (
  id uuid primary key references public.usuarios(id) on delete cascade,
  nombre text,
  apellido text,
  edad integer,
  foto_perfil text,
  provincia text,
  ciudad text,
  barrio text,
  rol public.user_role not null default 'user',
  categoria text[],
  horarios text,
  precio text,
  descripcion text,
  experiencia text,
  experiencia_academica text,
  verificado boolean,
  suscriptor boolean,
  antiguedad integer,
  perfil_publico boolean not null default false,
  creado_en timestamp without time zone,
  updated_at timestamptz not null default now()
);

create or replace function public.sync_user_public_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.user_public_profiles where id = old.id;
    return old;
  end if;

  insert into public.user_public_profiles (
    id, nombre, apellido, edad, foto_perfil, provincia, ciudad, barrio, rol,
    categoria, horarios, precio, descripcion, experiencia,
    experiencia_academica, verificado, suscriptor, antiguedad,
    perfil_publico, creado_en, updated_at
  ) values (
    new.id, new.nombre, new.apellido, new.edad, new.foto_perfil,
    new.provincia, new.ciudad, new.barrio, new.rol, new.categoria,
    new.horarios, new.precio, new.descripcion, new.experiencia,
    new.experiencia_academica, new.verificado, new.suscriptor,
    new.antiguedad, new."perfilPublico", new.creado_en, now()
  )
  on conflict (id) do update set
    nombre = excluded.nombre,
    apellido = excluded.apellido,
    edad = excluded.edad,
    foto_perfil = excluded.foto_perfil,
    provincia = excluded.provincia,
    ciudad = excluded.ciudad,
    barrio = excluded.barrio,
    rol = excluded.rol,
    categoria = excluded.categoria,
    horarios = excluded.horarios,
    precio = excluded.precio,
    descripcion = excluded.descripcion,
    experiencia = excluded.experiencia,
    experiencia_academica = excluded.experiencia_academica,
    verificado = excluded.verificado,
    suscriptor = excluded.suscriptor,
    antiguedad = excluded.antiguedad,
    perfil_publico = excluded.perfil_publico,
    creado_en = excluded.creado_en,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists sync_user_public_profile on public.usuarios;
create trigger sync_user_public_profile
after insert or update or delete on public.usuarios
for each row execute function public.sync_user_public_profile();

insert into public.user_public_profiles (
  id, nombre, apellido, edad, foto_perfil, provincia, ciudad, barrio, rol,
  categoria, horarios, precio, descripcion, experiencia,
  experiencia_academica, verificado, suscriptor, antiguedad,
  perfil_publico, creado_en
)
select
  id, nombre, apellido, edad, foto_perfil, provincia, ciudad, barrio, rol,
  categoria, horarios, precio, descripcion, experiencia,
  experiencia_academica, verificado, suscriptor, antiguedad,
  "perfilPublico", creado_en
from public.usuarios
on conflict (id) do update set
  nombre = excluded.nombre,
  apellido = excluded.apellido,
  edad = excluded.edad,
  foto_perfil = excluded.foto_perfil,
  provincia = excluded.provincia,
  ciudad = excluded.ciudad,
  barrio = excluded.barrio,
  rol = excluded.rol,
  categoria = excluded.categoria,
  horarios = excluded.horarios,
  precio = excluded.precio,
  descripcion = excluded.descripcion,
  experiencia = excluded.experiencia,
  experiencia_academica = excluded.experiencia_academica,
  verificado = excluded.verificado,
  suscriptor = excluded.suscriptor,
  antiguedad = excluded.antiguedad,
  perfil_publico = excluded.perfil_publico,
  creado_en = excluded.creado_en,
  updated_at = now();

-- RLS es obligatorio para toda tabla del schema expuesto.
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
  loop
    execute format(
      'alter table %I.%I enable row level security',
      target.schema_name,
      target.table_name
    );
  end loop;
end;
$$;

-- Ninguna tabla queda abierta por los grants históricos del schema.
revoke all privileges on all tables in schema public from anon, authenticated;
revoke all privileges on all sequences in schema public from anon, authenticated;

-- Catálogos y publicaciones públicas de marketplace.
grant select on public.categorias, public.cities, public.servicios,
  public.user_public_profiles to anon, authenticated;
grant select on public.servicios_with_coords to anon, authenticated;

drop policy if exists categorias_public_read on public.categorias;
create policy categorias_public_read on public.categorias
for select to anon, authenticated using (true);

drop policy if exists cities_public_read on public.cities;
create policy cities_public_read on public.cities
for select to anon, authenticated using (true);

drop policy if exists user_public_profiles_authenticated_read
  on public.user_public_profiles;
create policy user_public_profiles_authenticated_read
on public.user_public_profiles for select to authenticated using (true);

drop policy if exists user_public_profiles_anon_read
  on public.user_public_profiles;
create policy user_public_profiles_anon_read
on public.user_public_profiles for select to anon
using (perfil_publico and rol::text = 'worker');

-- La fila privada de usuarios solo es visible/modificable por su dueño o admin.
grant select, insert, update on public.usuarios to authenticated;

drop policy if exists usuarios_select_own_or_admin on public.usuarios;
create policy usuarios_select_own_or_admin on public.usuarios
for select to authenticated
using (
  id = (select auth.uid())
  or (select public.is_operational_admin())
);

drop policy if exists usuarios_insert_own on public.usuarios;
create policy usuarios_insert_own on public.usuarios
for insert to authenticated
with check (id = (select auth.uid()));

drop policy if exists usuarios_update_own_or_admin on public.usuarios;
create policy usuarios_update_own_or_admin on public.usuarios
for update to authenticated
using (
  id = (select auth.uid())
  or (select public.is_operational_admin())
)
with check (
  id = (select auth.uid())
  or (select public.is_operational_admin())
);

-- Servicios: lectura pública y mutaciones solo del prestador propietario.
grant insert, update, delete on public.servicios to authenticated;

drop policy if exists servicios_public_read on public.servicios;
create policy servicios_public_read on public.servicios
for select to anon, authenticated using (true);

drop policy if exists servicios_insert_owner on public.servicios;
create policy servicios_insert_owner on public.servicios
for insert to authenticated
with check (
  coalesce(usuario_id::text, user_id) = (select auth.uid())::text
);

drop policy if exists servicios_update_owner_or_admin on public.servicios;
create policy servicios_update_owner_or_admin on public.servicios
for update to authenticated
using (
  coalesce(usuario_id::text, user_id) = (select auth.uid())::text
  or (select public.is_operational_admin())
)
with check (
  coalesce(usuario_id::text, user_id) = (select auth.uid())::text
  or (select public.is_operational_admin())
);

drop policy if exists servicios_delete_owner_or_admin on public.servicios;
create policy servicios_delete_owner_or_admin on public.servicios
for delete to authenticated
using (
  coalesce(usuario_id::text, user_id) = (select auth.uid())::text
  or (select public.is_operational_admin())
);

-- Disponibilidad: el prestador gestiona su fila; solo se publica una sesión activa.
grant select on public.workers to anon, authenticated;
grant insert, update, delete on public.workers to authenticated;

drop policy if exists workers_read_available_or_own on public.workers;
create policy workers_read_available_or_own on public.workers
for select to anon, authenticated
using (
  (
    status::text = 'ONLINE'
    and (
      available_until is null
      or available_until > now()
    )
  )
  or user_id = (select auth.uid())
);

drop policy if exists workers_insert_own on public.workers;
create policy workers_insert_own on public.workers
for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists workers_update_own on public.workers;
create policy workers_update_own on public.workers
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists workers_delete_own on public.workers;
create policy workers_delete_own on public.workers
for delete to authenticated
using (user_id = (select auth.uid()));

-- Contrataciones y notificaciones quedan privadas a sus participantes.
grant select, insert on public.servicios_contratados to authenticated;
drop policy if exists servicios_contratados_participants_read
  on public.servicios_contratados;
create policy servicios_contratados_participants_read
on public.servicios_contratados for select to authenticated
using (
  contratante_id = (select auth.uid())
  or contratado_id = (select auth.uid())
  or (select public.is_operational_admin())
);

drop policy if exists servicios_contratados_client_insert
  on public.servicios_contratados;
create policy servicios_contratados_client_insert
on public.servicios_contratados for insert to authenticated
with check (
  contratante_id = (select auth.uid())
  and exists (
    select 1
    from public.servicios s
    where s.id = servicios_contratados.servicio_id
      and coalesce(s.usuario_id::text, s.user_id) = servicios_contratados.contratado_id::text
  )
);

grant select, insert, update, delete on public.notificaciones to authenticated;
drop policy if exists notificaciones_recipient_read on public.notificaciones;
create policy notificaciones_recipient_read on public.notificaciones
for select to authenticated
using (receptor_id = (select auth.uid())::text);

drop policy if exists notificaciones_recipient_update on public.notificaciones;
create policy notificaciones_recipient_update on public.notificaciones
for update to authenticated
using (receptor_id = (select auth.uid())::text)
with check (receptor_id = (select auth.uid())::text);

drop policy if exists notificaciones_recipient_delete on public.notificaciones;
create policy notificaciones_recipient_delete on public.notificaciones
for delete to authenticated
using (receptor_id = (select auth.uid())::text);

drop policy if exists notificaciones_valid_service_request_insert
  on public.notificaciones;
create policy notificaciones_valid_service_request_insert
on public.notificaciones for insert to authenticated
with check (
  emisor_id = (select auth.uid())::text
  and servicio_id ~ '^[0-9]+$'
  and exists (
    select 1
    from public.servicios_contratados sc
    where sc.servicio_id = notificaciones.servicio_id::bigint
      and sc.contratante_id = (select auth.uid())
      and sc.contratado_id::text = notificaciones.receptor_id
  )
);

-- Logros: lectura propia; el único alta directa permitida es completar el perfil.
grant select, insert, update on public.user_achievements to authenticated;
drop policy if exists user_achievements_read_own on public.user_achievements;
create policy user_achievements_read_own on public.user_achievements
for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists user_achievements_insert_profile_completion
  on public.user_achievements;
create policy user_achievements_insert_profile_completion
on public.user_achievements for insert to authenticated
with check (
  user_id = (select auth.uid())
  and achievement_key = 'profile_completed'
  and exists (
    select 1 from public.usuarios u
    where u.id = (select auth.uid()) and u.perfil_completo
  )
);

drop policy if exists user_achievements_update_profile_completion
  on public.user_achievements;
create policy user_achievements_update_profile_completion
on public.user_achievements for update to authenticated
using (
  user_id = (select auth.uid())
  and achievement_key = 'profile_completed'
)
with check (
  user_id = (select auth.uid())
  and achievement_key = 'profile_completed'
);

-- Perfiles/pedidos del bridge: elimina las políticas PUBLIC históricas.
drop policy if exists "Perfiles are visible to everyone" on public.sy_perfiles;
drop policy if exists "Public profiles are viewable by everyone" on public.sy_perfiles;
drop policy if exists "Users can insert their own profile" on public.sy_perfiles;
drop policy if exists "Users can insert/update their own profile" on public.sy_perfiles;
drop policy if exists "Users can update own profile" on public.sy_perfiles;

create policy sy_perfiles_read_own_or_admin on public.sy_perfiles
for select to authenticated
using (id = (select auth.uid()) or (select public.is_operational_admin()));
create policy sy_perfiles_insert_own on public.sy_perfiles
for insert to authenticated with check (id = (select auth.uid()));
create policy sy_perfiles_update_own_or_admin on public.sy_perfiles
for update to authenticated
using (id = (select auth.uid()) or (select public.is_operational_admin()))
with check (id = (select auth.uid()) or (select public.is_operational_admin()));

drop policy if exists "Admins can view all pedidos" on public.sy_pedidos;
drop policy if exists "Anyone can insert a pedido" on public.sy_pedidos;
drop policy if exists "Clientes can view their own pedidos" on public.sy_pedidos;
drop policy if exists "Prestadores can view assigned pedidos" on public.sy_pedidos;
drop policy if exists sy_pedidos_insert_anon_or_owner on public.sy_pedidos;
drop policy if exists sy_pedidos_select_owner on public.sy_pedidos;
drop policy if exists sy_pedidos_update_owner on public.sy_pedidos;

create policy sy_pedidos_participants_read on public.sy_pedidos
for select to authenticated
using (
  cliente_id = (select auth.uid())
  or prestador_id = (select auth.uid())
  or (select public.is_operational_admin())
);
create policy sy_pedidos_client_insert on public.sy_pedidos
for insert to authenticated
with check (cliente_id = (select auth.uid()) and estado = 'pendiente');
create policy sy_pedidos_participants_update on public.sy_pedidos
for update to authenticated
using (
  cliente_id = (select auth.uid())
  or prestador_id = (select auth.uid())
  or (select public.is_operational_admin())
)
with check (
  cliente_id = (select auth.uid())
  or prestador_id = (select auth.uid())
  or (select public.is_operational_admin())
);

grant select, insert, update on public.sy_perfiles to authenticated;
grant select, insert, update on public.sy_pedidos to authenticated;

-- Grants mínimos para el resto de tablas que la app consulta directamente.
grant select, insert, update, delete on public.chats to authenticated;
grant select, insert, update on public.mensajes to authenticated;
grant select on public.chat_quotes to authenticated;
grant select, insert, delete on public.user_blocks to authenticated;
grant select, insert on public.profile_reports to authenticated;
grant select on public.user_legal_acceptances to authenticated;
grant select on public.app_contact_visibility_rules,
  public.contact_unlocks,
  public.client_job_reviews,
  public.consumer_right_requests,
  public.marketplace_events,
  public.provider_communication_preferences,
  public.provider_profile_reminders,
  public.service_cancellation_requests,
  public.service_confirmation_payments,
  public.service_job_incidents,
  public.service_job_reviews,
  public.service_schedule_proposals,
  public.service_schedule_slots,
  public.urgent_service_candidates,
  public.urgent_service_requests,
  public.urgent_work_alerts,
  public.urgent_work_discipline_events,
  public.urgent_work_misses,
  public.urgent_work_policy,
  public.urgent_work_policy_audit,
  public.worker_urgent_discipline
to authenticated;

-- Corrige políticas antiguas que usaban PUBLIC/auth.role().
drop policy if exists app_contact_visibility_rules_service_role_all
  on public.app_contact_visibility_rules;
drop policy if exists contact_unlocks_service_role_all
  on public.contact_unlocks;
drop policy if exists urgent_work_alerts_service_role_all
  on public.urgent_work_alerts;

-- La vista respeta ahora RLS de servicios.
alter view public.servicios_with_coords set (security_invoker = true);

-- Contratación atómica, sin exponer tokens push ni permitir notificaciones arbitrarias.
create or replace function public.hire_service(p_service_id bigint)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_provider_id uuid;
  v_title text;
  v_hire_id uuid;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select
    coalesce(s.usuario_id, nullif(s.user_id, '')::uuid),
    s.titulo
  into v_provider_id, v_title
  from public.servicios s
  where s.id = p_service_id;

  if v_provider_id is null then
    raise exception 'SERVICE_NOT_FOUND';
  end if;
  if v_provider_id = v_user_id then
    raise exception 'CANNOT_HIRE_OWN_SERVICE';
  end if;

  select sc.id into v_hire_id
  from public.servicios_contratados sc
  where sc.servicio_id = p_service_id
    and sc.contratante_id = v_user_id
  limit 1;

  if v_hire_id is not null then
    raise exception 'SERVICE_ALREADY_HIRED';
  end if;

  insert into public.servicios_contratados (
    servicio_id, contratante_id, contratado_id
  ) values (
    p_service_id, v_user_id, v_provider_id
  ) returning id into v_hire_id;

  insert into public.notificaciones (
    receptor_id, emisor_id, mensaje, servicio_id
  ) values (
    v_provider_id::text,
    v_user_id::text,
    'Un cliente solicitó tu servicio: ' || coalesce(v_title, 'Servicio'),
    p_service_id::text
  );

  return v_hire_id;
end;
$$;

create or replace function public.enqueue_service_hire_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text;
begin
  select titulo into v_title
  from public.servicios
  where id = new.servicio_id;

  perform public.enqueue_transactional_notification(
    'service_hired:' || new.id::text,
    new.contratado_id,
    'service_hired',
    'Nueva solicitud de servicio',
    'Un cliente solicitó tu servicio: ' || coalesce(v_title, 'Servicio'),
    'MisServicios',
    jsonb_build_object('screen', 'Solicitudes', 'serviceId', new.servicio_id),
    now(),
    jsonb_build_object('hireId', new.id, 'serviceId', new.servicio_id)
  );

  return new;
end;
$$;

-- Elimina el webhook histórico que guardaba un service-role JWT en el trigger.
drop trigger if exists "HiredService" on public.servicios_contratados;
drop trigger if exists enqueue_service_hire_notification
  on public.servicios_contratados;
create trigger enqueue_service_hire_notification
after insert on public.servicios_contratados
for each row execute function public.enqueue_service_hire_notification();

-- Elimina el token de Expo embebido en la función y usa la cola transaccional.
create or replace function public.notify_on_new_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_chat public.chats%rowtype;
  v_recipient_id uuid;
  v_sender_name text;
begin
  select * into v_chat from public.chats where id = new.chat_id;
  if not found then return new; end if;

  v_recipient_id := case
    when v_chat.participant_a = new.remitente_id then v_chat.participant_b
    else v_chat.participant_a
  end;

  select nombre into v_sender_name
  from public.usuarios where id = new.remitente_id;

  perform public.enqueue_transactional_notification(
    'chat_message:' || new.id::text,
    v_recipient_id,
    'chat_message',
    case
      when nullif(trim(coalesce(v_sender_name, '')), '') is not null
        then 'Nuevo mensaje de ' || v_sender_name
      else 'Nuevo mensaje'
    end,
    left(coalesce(new.contenido, 'Nuevo mensaje'), 1000),
    'ChatIndividual',
    jsonb_build_object(
      'chatId', new.chat_id::text,
      'usuarioId1', v_chat.participant_a::text,
      'usuarioId2', v_chat.participant_b::text
    ),
    now(),
    jsonb_build_object('messageId', new.id)
  );

  return new;
end;
$$;

-- El borrado de cuenta solo puede hacerlo la propia sesión o un admin real.
create or replace function public.delete_user(uid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if auth.uid() <> uid and not public.is_operational_admin() then
    raise exception 'FORBIDDEN';
  end if;

  delete from auth.users where id = uid;
end;
$$;

-- Los RPC de logros validan la sesión y no dependen de acceso abierto a usuarios.
create or replace function public.award_referred_achievement(
  referral_code_input text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_referrer_id uuid;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;

  select id into v_referrer_id
  from public.usuarios
  where referral_code = referral_code_input;

  if v_referrer_id is null then
    return jsonb_build_object('status', 'error', 'message', 'Código inválido.');
  end if;
  if v_referrer_id = v_user_id then
    return jsonb_build_object('status', 'error', 'message', 'No podés usar tu propio código.');
  end if;

  insert into public.user_achievements (
    user_id, achievement_key, completed, completed_at
  ) values (
    v_user_id, 'refer_friend', true, now()
  ) on conflict (user_id, achievement_key) do nothing;

  return jsonb_build_object(
    'status', case when found then 'success' else 'no_change' end
  );
end;
$$;

create or replace function public.check_hirer_achievements()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_hire_count integer;
  v_awarded text[] := array[]::text[];
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;

  select count(*) into v_hire_count
  from public.servicios_contratados
  where contratante_id = v_user_id;

  if v_hire_count >= 1 then
    insert into public.user_achievements (
      user_id, achievement_key, completed, completed_at
    ) values (v_user_id, 'first_service', true, now())
    on conflict (user_id, achievement_key) do nothing;
    if found then v_awarded := array_append(v_awarded, 'first_service'); end if;
  end if;

  if v_hire_count >= 5 then
    insert into public.user_achievements (
      user_id, achievement_key, completed, completed_at
    ) values (v_user_id, 'power_user', true, now())
    on conflict (user_id, achievement_key) do nothing;
    if found then v_awarded := array_append(v_awarded, 'power_user'); end if;
  end if;

  return jsonb_build_object(
    'status', case
      when cardinality(v_awarded) > 0 then 'success'
      when v_hire_count = 0 then 'ineligible'
      else 'no_change'
    end,
    'awarded', v_awarded
  );
end;
$$;

-- Todas las funciones empiezan cerradas. Solo se reabren los RPC necesarios.
do $$
declare
  target record;
  auth_functions constant text[] := array[
    'accept_current_legal_documents',
    'award_referred_achievement',
    'cancel_service_request',
    'check_hirer_achievements',
    'count_active_by_category',
    'count_services_by_status_in_radius',
    'create_manual_service_request',
    'create_mica_app_request',
    'create_urgent_work_alert',
    'delete_user',
    'get_chat_job_status',
    'get_chat_schedule',
    'get_mica_app_requests_for_worker',
    'get_my_service_jobs',
    'get_my_service_requests',
    'get_services_by_category_in_radius',
    'get_servicios_with_online_workers',
    'get_servicios_with_worker_status',
    'hire_service',
    'is_operational_admin',
    'propose_service_schedule',
    'propose_service_visit',
    'report_service_job_incident',
    'request_chat_quote_changes',
    'respond_service_visit',
    'respond_to_urgent_work_alert',
    'select_service_schedule_slot',
    'send_chat_quote',
    'submit_client_job_review',
    'submit_consumer_right_request',
    'submit_service_incident_intake',
    'submit_service_job_review',
    'test_get_servicios_with_worker_status',
    'track_marketplace_event'
  ];
  anon_functions constant text[] := array[
    'count_active_by_category',
    'count_services_by_status_in_radius',
    'get_services_by_category_in_radius',
    'get_servicios_with_online_workers',
    'get_servicios_with_worker_status',
    'test_get_servicios_with_worker_status'
  ];
begin
  for target in
    select
      p.proname,
      n.nspname,
      pg_get_function_identity_arguments(p.oid) as identity_arguments
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  loop
    execute format(
      'revoke execute on function %I.%I(%s) from public, anon, authenticated',
      target.nspname,
      target.proname,
      target.identity_arguments
    );
    execute format(
      'grant execute on function %I.%I(%s) to service_role',
      target.nspname,
      target.proname,
      target.identity_arguments
    );

    if target.proname = any(auth_functions) then
      execute format(
        'grant execute on function %I.%I(%s) to authenticated',
        target.nspname,
        target.proname,
        target.identity_arguments
      );
    end if;
    if target.proname = any(anon_functions) then
      execute format(
        'grant execute on function %I.%I(%s) to anon',
        target.nspname,
        target.proname,
        target.identity_arguments
      );
    end if;
  end loop;
end;
$$;

-- Los nuevos objetos también nacen cerrados por defecto.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema public
  grant all on tables to service_role;
alter default privileges for role postgres in schema public
  grant execute on functions to service_role;

-- Corrige el cron nocturno que todavía usaba chats.creado_en.
do $$
begin
  if exists (
    select 1 from cron.job where jobname = 'cleanup-expired-chats'
  ) then
    perform cron.unschedule('cleanup-expired-chats');
  end if;
  perform cron.schedule(
    'cleanup-expired-chats',
    '0 0 * * *',
    $job$delete from public.chats
      where created_at <= now() - interval '15 days'$job$
  );
end;
$$;
