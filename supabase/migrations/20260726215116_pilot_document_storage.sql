insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pilot-documents',
  'pilot-documents',
  false,
  15728640,
  array['application/pdf','image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "pilot documents read own" on storage.objects;
create policy "pilot documents read own" on storage.objects
for select to authenticated
using (bucket_id = 'pilot-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "pilot documents upload own" on storage.objects;
create policy "pilot documents upload own" on storage.objects
for insert to authenticated
with check (bucket_id = 'pilot-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "pilot documents update own" on storage.objects;
create policy "pilot documents update own" on storage.objects
for update to authenticated
using (bucket_id = 'pilot-documents' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'pilot-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "pilot documents delete own" on storage.objects;
create policy "pilot documents delete own" on storage.objects
for delete to authenticated
using (bucket_id = 'pilot-documents' and (storage.foldername(name))[1] = auth.uid()::text);
