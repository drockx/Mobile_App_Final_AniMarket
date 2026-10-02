-- Only the verified Edge backend can upload private documents and ID submissions.
drop policy if exists "animarket_id_owner_upload" on storage.objects;
drop policy if exists "animarket_documents_private" on storage.objects;
create policy "animarket_documents_private" on storage.objects as restrictive
for all to anon, authenticated
using (bucket_id <> 'animarket-documents') with check (bucket_id <> 'animarket-documents');
