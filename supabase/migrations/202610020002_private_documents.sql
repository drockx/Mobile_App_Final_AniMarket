-- Vaccination documents stay private; only the verified Edge backend handles them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('animarket-documents', 'animarket-documents', false, 5242880, array['image/jpeg', 'image/png', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
