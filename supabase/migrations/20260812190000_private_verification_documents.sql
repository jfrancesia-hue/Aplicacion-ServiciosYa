-- Documentos de identidad y credenciales en bucket privado.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'verification-documents',
  'verification-documents',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'application/pdf']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists verification_documents_owner_insert on storage.objects;
create policy verification_documents_owner_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'verification-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists verification_documents_owner_read on storage.objects;
create policy verification_documents_owner_read
  on storage.objects for select to authenticated
  using (
    bucket_id = 'verification-documents'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_operational_admin()
    )
  );

drop policy if exists verification_documents_owner_update on storage.objects;
create policy verification_documents_owner_update
  on storage.objects for update to authenticated
  using (
    bucket_id = 'verification-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'verification-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists verification_documents_owner_delete on storage.objects;
create policy verification_documents_owner_delete
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'verification-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
