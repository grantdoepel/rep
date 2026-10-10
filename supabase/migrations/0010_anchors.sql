-- 0010 · PRD 6 Anchors: the tag code.
-- profiles.tag_code (unique, nullable) exists since 0006. It is server-generated and read-only
-- for the client (comes back through my_profile_extras). This RPC mints it on first use.
-- The /go?t=<code> route validates the code on the client against the profile's own code, so no
-- start_via_tag RPC is needed: starting a Set stays a local action, synced like any other.

create or replace function ensure_tag_code() returns text language plpgsql security definer set search_path = public as $$
declare code text;
begin
  if auth.uid() is null then return null; end if;
  select tag_code into code from profiles where id = auth.uid();
  if code is null then
    -- 5 random bytes = 10 hex chars; loop on the (astronomically unlikely) unique collision
    loop
      code := encode(extensions.gen_random_bytes(5), 'hex');
      begin
        update profiles set tag_code = code where id = auth.uid() and tag_code is null;
        exit;
      exception when unique_violation then
        -- try another
      end;
    end loop;
    -- a concurrent call may have won the race; read back whatever landed
    select tag_code into code from profiles where id = auth.uid();
  end if;
  return code;
end $$;
grant execute on function ensure_tag_code() to authenticated;
revoke all on function ensure_tag_code() from anon;
