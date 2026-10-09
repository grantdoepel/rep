-- Real social loop: invite links, friend feed, league board, Duo pairing, presence, and push delivery.

create extension if not exists pg_net with schema extensions;

-- ---------- invites ----------
alter table profiles add column if not exists invite_code text unique default encode(gen_random_bytes(4), 'hex');
update profiles set invite_code = encode(gen_random_bytes(4), 'hex') where invite_code is null;

-- Accept an invite link: creates a symmetric accepted friendship. Returns the new friend's public card.
create or replace function accept_invite(p_code text) returns json language plpgsql security definer set search_path = public as $$
declare f profiles%rowtype;
begin
  select * into f from profiles where invite_code = lower(trim(p_code));
  if not found then raise exception 'invalid invite'; end if;
  if f.id = auth.uid() then raise exception 'that is your own link'; end if;
  insert into friendships (user_id, friend_id, status) values (auth.uid(), f.id, 'accepted'), (f.id, auth.uid(), 'accepted')
    on conflict (user_id, friend_id) do update set status = 'accepted';
  return json_build_object('id', f.id, 'username', f.username, 'display_name', f.display_name);
end $$;

create or replace function my_invite_code() returns text language sql stable security definer set search_path = public as $$
  select invite_code from profiles where id = auth.uid()
$$;

-- ---------- friend feed ----------
create or replace function get_friends() returns table (
  id uuid, username text, display_name text, streak integer, xp_week integer,
  done_today boolean, at_risk boolean, moving_now boolean, is_duo boolean, is_crew boolean
) language sql stable security definer set search_path = public as $$
  with ws as (select date_trunc('week', now())::date as d),
  f as (
    select friend_id as fid from friendships where user_id = auth.uid() and status = 'accepted'
    union
    select user_id from friendships where friend_id = auth.uid() and status = 'accepted'
  )
  select p.id, p.username, p.display_name,
    coalesce(st.current, 0),
    coalesce((select lm.xp from league_members lm join leagues l on l.id = lm.league_id where lm.user_id = p.id and l.week_start = (select d from ws) limit 1), 0),
    coalesce(st.last_counted_date = (now() at time zone p.timezone)::date, false),
    coalesce(st.current, 0) > 0 and coalesce(st.last_counted_date <> (now() at time zone p.timezone)::date, true),
    exists (select 1 from presence pr where pr.user_id = p.id and pr.updated_at > now() - interval '15 minutes'),
    exists (select 1 from duo_quests d where d.week_start = (select d from ws) and d.status = 'active'
            and ((d.user_a = auth.uid() and d.user_b = p.id) or (d.user_b = auth.uid() and d.user_a = p.id))),
    same_crew(auth.uid(), p.id)
  from f join profiles p on p.id = f.fid
  left join streaks st on st.user_id = p.id
  order by p.display_name
$$;

-- ---------- league board ----------
create or replace function get_league() returns table (
  user_id uuid, display_name text, goal_tier text, sets integer, xp integer, perfect integer,
  is_you boolean, is_friend boolean, tier text, week_start date
) language sql stable security definer set search_path = public as $$
  with cur as (select max(week_start) as w from leagues),
  mine as (select lm.league_id from league_members lm join leagues l on l.id = lm.league_id where lm.user_id = auth.uid() and l.week_start = (select w from cur) limit 1)
  select lm.user_id, p.display_name, p.goal_tier::text, lm.sets::integer, lm.xp, lm.perfect::integer,
    lm.user_id = auth.uid(), are_friends(auth.uid(), lm.user_id), l.tier::text, l.week_start
  from league_members lm join leagues l on l.id = lm.league_id join profiles p on p.id = lm.user_id
  where lm.league_id = (select league_id from mine)
  order by lm.xp desc, p.display_name
$$;

-- ---------- Duo ----------
create or replace function get_duo() returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'partnerId', case when d.user_a = auth.uid() then d.user_b else d.user_a end,
    'partnerName', p.display_name,
    'targetXp', d.target_xp,
    'yourXp', case when d.user_a = auth.uid() then d.xp_a else d.xp_b end,
    'partnerXp', case when d.user_a = auth.uid() then d.xp_b else d.xp_a end,
    'wagerYou', case when d.user_a = auth.uid() then d.wager_a else d.wager_b end,
    'wagerPartner', case when d.user_a = auth.uid() then d.wager_b else d.wager_a end,
    'weekStart', d.week_start,
    'status', d.status)
  from duo_quests d join profiles p on p.id = (case when d.user_a = auth.uid() then d.user_b else d.user_a end)
  where (d.user_a = auth.uid() or d.user_b = auth.uid()) and d.week_start = date_trunc('week', now())::date
  limit 1
$$;

create or replace function set_duo(p_partner uuid) returns json language plpgsql security definer set search_path = public as $$
declare ws date := date_trunc('week', now())::date; my_xp int; their_xp int;
begin
  if not are_friends(auth.uid(), p_partner) then raise exception 'not friends'; end if;
  if exists (select 1 from duo_quests where week_start = ws and status = 'active' and (auth.uid() in (user_a, user_b) or p_partner in (user_a, user_b))) then
    raise exception 'one of you already has a Duo this week';
  end if;
  select coalesce((select lm.xp from league_members lm join leagues l on l.id = lm.league_id where lm.user_id = auth.uid() and l.week_start = ws), 0) into my_xp;
  select coalesce((select lm.xp from league_members lm join leagues l on l.id = lm.league_id where lm.user_id = p_partner and l.week_start = ws), 0) into their_xp;
  insert into duo_quests (week_start, user_a, user_b, xp_a, xp_b) values (ws, auth.uid(), p_partner, my_xp, their_xp);
  return get_duo();
end $$;

-- ---------- presence (live "moving now") ----------
create or replace function set_presence(p_set_id uuid, p_move smallint) returns void language sql security definer set search_path = public as $$
  insert into presence (user_id, set_id, move_index, started_at, updated_at) values (auth.uid(), p_set_id, p_move, now(), now())
  on conflict (user_id) do update set set_id = excluded.set_id, move_index = excluded.move_index, updated_at = now()
$$;

-- ---------- push: nudges call the notify function through pg_net ----------
-- The job secret lives in Vault; the same value is set as the JOB_SECRET edge-function secret.
create or replace function private_job_secret() returns text language sql stable security definer set search_path = public as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'job_secret' limit 1
$$;
revoke all on function private_job_secret() from public, anon, authenticated;

create or replace function notify_call(p_body jsonb) returns void language plpgsql security definer set search_path = public as $$
declare secret text := private_job_secret();
begin
  if secret is null then return; end if;
  perform net.http_post(
    url := 'https://kwsyubyfsxjifsulofxa.supabase.co/functions/v1/notify',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-job-secret', secret),
    body := p_body,
    timeout_milliseconds := 8000);
end $$;
revoke all on function notify_call(jsonb) from public, anon, authenticated;

create or replace function nudge_push() returns trigger language plpgsql security definer set search_path = public as $$
declare from_name text;
begin
  select display_name into from_name from profiles where id = new.from_id;
  perform notify_call(jsonb_build_object('kind', 'nudge', 'to', new.to_id, 'from', from_name));
  return new;
end $$;
drop trigger if exists nudge_push on nudges;
create trigger nudge_push after insert on nudges for each row execute function nudge_push();

-- evening reminders: hourly; the function picks users whose local hour is 19 or 21 and who haven't moved
select cron.unschedule('rep_evening') where exists (select 1 from cron.job where jobname = 'rep_evening');
select cron.schedule('rep_evening', '2 * * * *', $$select notify_call('{"kind":"evening"}'::jsonb)$$);

-- ---------- grants ----------
grant execute on function accept_invite(text), my_invite_code(), get_friends(), get_league(), get_duo(), set_duo(uuid), set_presence(uuid, smallint) to authenticated;
revoke all on function accept_invite(text), my_invite_code(), get_friends(), get_league(), get_duo(), set_duo(uuid), set_presence(uuid, smallint) from anon;

-- ---------- push secrets (Vault) ----------
-- vault secrets 'job_secret', 'vapid_public', 'vapid_private' are created once per project (see README).
create or replace function private_push_config() returns json language sql stable security definer set search_path = public as $$
  select json_object_agg(name, decrypted_secret) from vault.decrypted_secrets where name in ('job_secret', 'vapid_public', 'vapid_private')
$$;
revoke all on function private_push_config() from public, anon, authenticated;
grant execute on function private_push_config() to service_role;
grant execute on function private_job_secret() to service_role;

create or replace function vapid_public_key() returns text language sql stable security definer set search_path = public as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'vapid_public' limit 1
$$;
revoke all on function vapid_public_key() from public;
grant execute on function vapid_public_key() to anon, authenticated;

create or replace function save_push_subscription(p_endpoint text, p_keys jsonb) returns void language sql security definer set search_path = public as $$
  insert into push_subscriptions (user_id, endpoint, keys) values (auth.uid(), p_endpoint, p_keys)
  on conflict (user_id, endpoint) do update set keys = excluded.keys
$$;
grant execute on function save_push_subscription(text, jsonb) to authenticated;
revoke all on function save_push_subscription(text, jsonb) from anon;
