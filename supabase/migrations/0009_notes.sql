-- 0009 · PRD 5 · Letters from past-you
-- One private recording per user in Storage: bucket `notes`, object path `${auth.uid()}/current.<webm|mp4>`.
-- Profile columns note_recorded_at / note_text already exist (0006) and are written through patch_profile.

insert into storage.buckets (id, name, public) values ('notes', 'notes', false) on conflict do nothing;

-- A user may only touch objects under their own folder (first path segment = their uid).
drop policy if exists "notes read own" on storage.objects;
drop policy if exists "notes insert own" on storage.objects;
drop policy if exists "notes update own" on storage.objects;
drop policy if exists "notes delete own" on storage.objects;

create policy "notes read own" on storage.objects for select to authenticated
  using (bucket_id = 'notes' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "notes insert own" on storage.objects for insert to authenticated
  with check (bucket_id = 'notes' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "notes update own" on storage.objects for update to authenticated
  using (bucket_id = 'notes' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'notes' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "notes delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'notes' and (storage.foldername(name))[1] = auth.uid()::text);

-- Deleting a note. patch_profile keeps a column on null and ''::timestamptz does not cast, so note_recorded_at
-- cannot be cleared through it; this small RPC nulls both note columns for the caller and nothing else.
create or replace function clear_note() returns void language sql security definer set search_path = public as $$
  update profiles set note_recorded_at = null, note_text = null where id = auth.uid();
$$;
grant execute on function clear_note() to authenticated;
revoke all on function clear_note() from anon;
