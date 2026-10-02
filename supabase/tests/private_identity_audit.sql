-- Configuration metadata only. Never select user files or personal records.
select json_build_object(
  'bucket', (select row_to_json(b) from (
    select id, public, file_size_limit, allowed_mime_types
    from storage.buckets where id = 'animarket-ids'
  ) b),
  'policies', (select coalesce(json_agg(p), '[]'::json) from (
    select policyname, permissive, roles, cmd, qual, with_check
    from pg_policies where schemaname = 'storage' and tablename = 'objects'
  ) p),
  'rlsEnabled', (select relrowsecurity from pg_class where oid = 'storage.objects'::regclass)
) as storage_security;
