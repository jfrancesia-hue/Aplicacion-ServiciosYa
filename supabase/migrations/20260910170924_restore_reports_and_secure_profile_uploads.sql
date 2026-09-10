-- Restaura reportes de servicios con autoría verificable.
grant select, insert, update on public.reports to authenticated;

drop policy if exists reports_insert_own on public.reports;
create policy reports_insert_own
on public.reports for insert to authenticated
with check (
  reporter_user_id = (select auth.uid())
  and status = 'pending'
  and exists (
    select 1 from public.servicios servicio
    where servicio.id = reports.service_id
  )
);

drop policy if exists reports_select_own_or_admin on public.reports;
create policy reports_select_own_or_admin
on public.reports for select to authenticated
using (
  reporter_user_id = (select auth.uid())
  or (select public.is_operational_admin())
);

drop policy if exists reports_update_admin on public.reports;
create policy reports_update_admin
on public.reports for update to authenticated
using ((select public.is_operational_admin()))
with check ((select public.is_operational_admin()));

-- Los buckets históricos de documentos de identidad dejan de ser públicos.
update storage.buckets
set public = false
where id in ('dni', 'dni-images');

update storage.buckets
set
  file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']::text[]
where id in ('imagenes', 'fotos-perfil');

drop policy if exists public_profile_images_owner_insert on storage.objects;
create policy public_profile_images_owner_insert
on storage.objects for insert to authenticated
with check (
  bucket_id in ('imagenes', 'fotos-perfil')
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists public_profile_images_owner_update on storage.objects;
create policy public_profile_images_owner_update
on storage.objects for update to authenticated
using (
  bucket_id in ('imagenes', 'fotos-perfil')
  and owner_id = (select auth.uid())::text
)
with check (
  bucket_id in ('imagenes', 'fotos-perfil')
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists public_profile_images_owner_delete on storage.objects;
create policy public_profile_images_owner_delete
on storage.objects for delete to authenticated
using (
  bucket_id in ('imagenes', 'fotos-perfil')
  and owner_id = (select auth.uid())::text
);
