-- Live policy test; temporary metadata only, no image uploads or real accounts.
-- Every test row is rolled back at the end of this transaction.
begin;
do $$ begin
  if not exists (select 1 from storage.buckets where id = 'animarket-ids'
    and public = false and file_size_limit = 5242880
    and allowed_mime_types = array['image/jpeg', 'image/png']) then
    raise exception 'Private ID bucket configuration is incorrect';
  end if;
end $$;

insert into storage.objects(bucket_id, name) values
  ('animarket-ids', 'animarket-policy-owner/probe-owner.jpg'),
  ('animarket-ids', 'animarket-policy-other/probe-other.jpg');

set local role authenticated;
set local request.jwt.claims = '{"iss":"https://securetoken.google.com/animarket-87354","aud":"animarket-87354","sub":"animarket-policy-owner","role":"authenticated"}';
do $$ declare changed integer; begin
  if (select count(*) from storage.objects where bucket_id = 'animarket-ids'
    and name in ('animarket-policy-owner/probe-owner.jpg', 'animarket-policy-other/probe-other.jpg')) <> 1 then
    raise exception 'Owner isolation failed';
  end if;
  begin
    insert into storage.objects(bucket_id, name) values ('animarket-ids', 'animarket-policy-owner/probe-upload.jpg');
    raise exception 'A client bypassed the trusted ID upload endpoint';
  exception when insufficient_privilege then null; end;
  begin
    insert into storage.objects(bucket_id, name) values ('animarket-ids', 'animarket-policy-other/probe-forbidden.jpg');
    raise exception 'Cross-account upload was allowed';
  exception when insufficient_privilege then null; end;
  update storage.objects set metadata = '{"altered":true}' where bucket_id = 'animarket-ids' and name = 'animarket-policy-owner/probe-owner.jpg';
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'ID overwrite was allowed'; end if;
  begin
    delete from storage.objects where bucket_id = 'animarket-ids' and name = 'animarket-policy-owner/probe-owner.jpg';
    get diagnostics changed = row_count;
    if changed <> 0 then raise exception 'Direct ID deletion was allowed'; end if;
  exception when insufficient_privilege then null; -- Supabase also protects raw SQL deletion.
  end;
end $$;

set local request.jwt.claims = '{"iss":"https://securetoken.google.com/another-project","aud":"another-project","sub":"animarket-policy-owner","role":"authenticated"}';
do $$ begin
  if exists (select 1 from storage.objects where bucket_id = 'animarket-ids'
    and name like 'animarket-policy-%/probe-%.jpg') then raise exception 'Another Firebase project could read IDs'; end if;
  begin
    insert into storage.objects(bucket_id, name) values ('animarket-ids', 'animarket-policy-owner/probe-wrong-project.jpg');
    raise exception 'Another Firebase project could upload IDs';
  exception when insufficient_privilege then null; end;
end $$;

set local request.jwt.claims = '{"iss":"https://securetoken.google.com/animarket-87354","aud":"wrong-audience","sub":"animarket-policy-owner","role":"authenticated"}';
do $$ begin
  if exists (select 1 from storage.objects where bucket_id = 'animarket-ids'
    and name like 'animarket-policy-%/probe-%.jpg') then raise exception 'Wrong audience could read IDs'; end if;
end $$;

set local role anon;
set local request.jwt.claims = '{}';
do $$ begin
  if exists (select 1 from storage.objects where bucket_id = 'animarket-ids'
    and name like 'animarket-policy-%/probe-%.jpg') then raise exception 'Anonymous ID access was allowed'; end if;
  begin
    insert into storage.objects(bucket_id, name) values ('animarket-ids', 'animarket-policy-owner/probe-anonymous.jpg');
    raise exception 'Anonymous ID upload was allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'Private ID policies passed: privacy/limits, owner read, server-only upload, account isolation, immutable files, project/audience checks and anonymous denial. Test rows rolled back.' as result;
