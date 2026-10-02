begin;

-- All main app records remain in Firestore. Only file metadata lives here.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('animarket-ids', 'animarket-ids', false, 5242880, array['image/jpeg', 'image/png'])
on conflict (id) do update set public = false, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png'];

-- Firebase UIDs are strings, not the UUIDs returned by auth.uid().
-- Enable the Firebase third-party integration before these policies can be used.
drop policy if exists "animarket_id_owner_read" on storage.objects;
create policy "animarket_id_owner_read" on storage.objects
for select to authenticated using (
  bucket_id = 'animarket-ids'
  and (auth.jwt()->>'iss') = 'https://securetoken.google.com/animarket-87354'
  and (auth.jwt()->>'aud') = 'animarket-87354'
  and (storage.foldername(name))[1] = (auth.jwt()->>'sub')
);

drop policy if exists "animarket_id_owner_upload" on storage.objects;
create policy "animarket_id_owner_upload" on storage.objects
for insert to authenticated with check (
  bucket_id = 'animarket-ids'
  and (auth.jwt()->>'iss') = 'https://securetoken.google.com/animarket-87354'
  and (auth.jwt()->>'aud') = 'animarket-87354'
  and (storage.foldername(name))[1] = (auth.jwt()->>'sub')
);

-- Restrictive rules protect this bucket even if another bucket later adds
-- a permissive policy that accidentally applies to all storage objects.
drop policy if exists "animarket_id_isolation" on storage.objects;
create policy "animarket_id_isolation" on storage.objects as restrictive
for all to anon, authenticated
using (
  bucket_id <> 'animarket-ids' or (
    (auth.jwt()->>'iss') = 'https://securetoken.google.com/animarket-87354'
    and (auth.jwt()->>'aud') = 'animarket-87354'
    and (storage.foldername(name))[1] = (auth.jwt()->>'sub')
  )
)
with check (
  bucket_id <> 'animarket-ids' or (
    (auth.jwt()->>'iss') = 'https://securetoken.google.com/animarket-87354'
    and (auth.jwt()->>'aud') = 'animarket-87354'
    and (storage.foldername(name))[1] = (auth.jwt()->>'sub')
  )
);

drop policy if exists "animarket_id_immutable_update" on storage.objects;
create policy "animarket_id_immutable_update" on storage.objects as restrictive
for update to anon, authenticated
using (bucket_id <> 'animarket-ids') with check (bucket_id <> 'animarket-ids');
drop policy if exists "animarket_id_immutable_delete" on storage.objects;
create policy "animarket_id_immutable_delete" on storage.objects as restrictive
for delete to anon, authenticated using (bucket_id <> 'animarket-ids');

-- Review access, withdrawal and cleanup go through the trusted Edge Function.
-- Clients cannot replace a photo that a reviewer is examining.
commit;
