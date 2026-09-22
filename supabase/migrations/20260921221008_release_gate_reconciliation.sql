-- Reconciliación posterior a la primera aplicación del release gate.

begin;

update public.usuarios usuario
set suscriptor = false
where coalesce(usuario.suscriptor, false)
  and not coalesce(usuario.suscripcion_activa_hasta > now(), false)
  and not exists (
    select 1
    from public.suscriptores suscripcion
    where suscripcion.id_suscriptor = usuario.id
  );

alter view public.servicios_with_coords set (security_invoker = true);

commit;
