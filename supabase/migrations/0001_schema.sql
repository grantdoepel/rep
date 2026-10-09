-- Rep schema. Everything the client can read is gated by RLS; XP, gems, crowns and streaks
-- are written only by SECURITY DEFINER functions / edge functions, never by the client.

create extension if not exists pgcrypto;
create extension if not exists pg_cron;

-- ---------- enums ----------
create type track_t as enum ('push','pull','legs','core','cardio','mobility');
create type env_t as enum ('home','gym','travel');
create type tier_t as enum ('foundation','standard','advanced');
create type goal_t as enum ('casual','regular','serious');
create type set_kind_t as enum ('normal','rescue','rest','placement','event');
create type set_status_t as enum ('planned','active','done');
create type league_tier_t as enum ('bronze','silver','gold','sapphire','diamond');
create type friendship_status_t as enum ('pending','accepted','blocked');
create type duo_status_t as enum ('active','cleared','failed');

-- ---------- catalog (read-only to users) ----------
create table movements (
  id text primary key,
  name text not null,
  track track_t not null,
  difficulty smallint not null check (difficulty between 1 and 5),
  env env_t[] not null,
  unit text not null check (unit in ('reps','seconds')),
  cue text not null,
  regression text references movements(id),
  progression text references movements(id),
  flags text[] not null default '{}',
  seated boolean not null default false,
  video_url text
);

create table crown_levels (
  track track_t not null,
  level smallint not null check (level between 1 and 5),
  requirements jsonb not null,   -- [{movement, target}] home variant
  gym jsonb not null,            -- [{movement, target}] gym variant
  primary key (track, level)
);

-- ---------- users ----------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null,
  goal_tier goal_t not null default 'regular',
  environment env_t not null default 'home',
  difficulty_tier tier_t not null default 'standard',
  timezone text not null default 'America/New_York',
  rest_days smallint[] not null default '{0}',
  injury_flags text[] not null default '{}',
  accessibility_flags text[] not null default '{}',
  why_text text,
  why_who text,
  avatar_config jsonb not null default '{}',
  xp_total integer not null default 0,
  gems integer not null default 0,
  created_at timestamptz not null default now()
);

create table user_crowns (
  user_id uuid references profiles(id) on delete cascade,
  track track_t not null,
  level smallint not null default 1,
  clears smallint not null default 0,
  misses smallint not null default 0,
  last_clear_date date,
  primary key (user_id, track)
);

create table streaks (
  user_id uuid primary key references profiles(id) on delete cascade,
  current integer not null default 0,
  longest integer not null default 0,
  last_counted_date date,
  freezes smallint not null default 2,
  freezes_reset_on date not null default date_trunc('month', now())::date
);

create table sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  date date not null,
  kind set_kind_t not null default 'normal',
  status set_status_t not null default 'planned',
  tracks track_t[] not null,
  moves jsonb not null,            -- [{movement, target, unit, achieved}]
  planned_minutes smallint not null,
  xp integer,
  perfect boolean,
  verified boolean not null default false,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);
create index sets_user_date on sets(user_id, date desc);

create table set_results (
  id bigserial primary key,
  set_id uuid not null references sets(id) on delete cascade,
  movement text not null references movements(id),
  target integer not null,
  achieved integer not null,
  xp integer not null
);

create table day_log (
  user_id uuid references profiles(id) on delete cascade,
  date date not null,
  kind text not null check (kind in ('perfect','done','rest','missed','frozen')),
  primary key (user_id, date)
);

-- ---------- social ----------
create table friendships (
  user_id uuid references profiles(id) on delete cascade,
  friend_id uuid references profiles(id) on delete cascade,
  status friendship_status_t not null default 'pending',
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

create table nudges (
  from_id uuid references profiles(id) on delete cascade,
  to_id uuid references profiles(id) on delete cascade,
  date date not null default current_date,
  primary key (from_id, to_id, date)
);

create table presence (
  user_id uuid primary key references profiles(id) on delete cascade,
  set_id uuid references sets(id) on delete set null,
  move_index smallint not null default 0,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table duo_quests (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  user_a uuid not null references profiles(id) on delete cascade,
  user_b uuid not null references profiles(id) on delete cascade,
  target_xp integer not null default 2000,
  xp_a integer not null default 0,
  xp_b integer not null default 0,
  status duo_status_t not null default 'active',
  unique (week_start, user_a),
  unique (week_start, user_b)
);

create table crews (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  captain_id uuid not null references profiles(id),
  weekly_goal_per_member smallint not null default 6,
  invite_code text unique not null default encode(gen_random_bytes(4), 'hex'),
  created_at timestamptz not null default now()
);
create table crew_members (
  crew_id uuid references crews(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (crew_id, user_id)
);
create table streak_saves (
  id bigserial primary key,
  saver_id uuid not null references profiles(id),
  saved_id uuid not null references profiles(id),
  set_id uuid references sets(id),
  week_start date not null,
  created_at timestamptz not null default now()
);

-- ---------- leagues ----------
create table leagues (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  tier league_tier_t not null,
  created_at timestamptz not null default now()
);
create table league_members (
  league_id uuid references leagues(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  xp integer not null default 0,
  xp_normalized integer not null default 0,
  sets smallint not null default 0,
  perfect smallint not null default 0,
  rank smallint,
  outcome text check (outcome in ('promoted','held','demoted')),
  primary key (league_id, user_id)
);
create index league_members_user on league_members(user_id);

create table gem_ledger (
  id bigserial primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  delta integer not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create table push_subscriptions (
  user_id uuid references profiles(id) on delete cascade,
  endpoint text not null,
  keys jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, endpoint)
);

-- ---------- helpers ----------
create or replace function are_friends(a uuid, b uuid) returns boolean language sql stable security definer as $$
  select exists (select 1 from friendships where status = 'accepted' and ((user_id = a and friend_id = b) or (user_id = b and friend_id = a)));
$$;

create or replace function same_league(a uuid, b uuid) returns boolean language sql stable security definer as $$
  select exists (
    select 1 from league_members la join league_members lb on la.league_id = lb.league_id
    join leagues l on l.id = la.league_id
    where la.user_id = a and lb.user_id = b and l.week_start = (select max(week_start) from leagues)
  );
$$;

create or replace function same_crew(a uuid, b uuid) returns boolean language sql stable security definer as $$
  select exists (select 1 from crew_members ca join crew_members cb on ca.crew_id = cb.crew_id where ca.user_id = a and cb.user_id = b);
$$;

-- ---------- RLS ----------
alter table movements enable row level security;
alter table crown_levels enable row level security;
alter table profiles enable row level security;
alter table user_crowns enable row level security;
alter table streaks enable row level security;
alter table sets enable row level security;
alter table set_results enable row level security;
alter table day_log enable row level security;
alter table friendships enable row level security;
alter table nudges enable row level security;
alter table presence enable row level security;
alter table duo_quests enable row level security;
alter table crews enable row level security;
alter table crew_members enable row level security;
alter table streak_saves enable row level security;
alter table leagues enable row level security;
alter table league_members enable row level security;
alter table gem_ledger enable row level security;
alter table push_subscriptions enable row level security;

create policy "catalog read" on movements for select to authenticated using (true);
create policy "catalog read" on crown_levels for select to authenticated using (true);

create policy "own profile" on profiles for select to authenticated using (id = auth.uid() or are_friends(auth.uid(), id) or same_league(auth.uid(), id) or same_crew(auth.uid(), id));
create policy "own profile write" on profiles for insert to authenticated with check (id = auth.uid());
create policy "own profile update" on profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "crowns read" on user_crowns for select to authenticated using (user_id = auth.uid() or are_friends(auth.uid(), user_id));
create policy "streaks read" on streaks for select to authenticated using (user_id = auth.uid() or are_friends(auth.uid(), user_id) or same_crew(auth.uid(), user_id));
create policy "sets own" on sets for select to authenticated using (user_id = auth.uid() or are_friends(auth.uid(), user_id));
create policy "sets insert" on sets for insert to authenticated with check (user_id = auth.uid());
create policy "sets update own planned" on sets for update to authenticated using (user_id = auth.uid() and status <> 'done') with check (user_id = auth.uid());
create policy "results read" on set_results for select to authenticated using (exists (select 1 from sets s where s.id = set_id and s.user_id = auth.uid()));
create policy "daylog read" on day_log for select to authenticated using (user_id = auth.uid() or are_friends(auth.uid(), user_id));

create policy "friendships read" on friendships for select to authenticated using (user_id = auth.uid() or friend_id = auth.uid());
create policy "friendships insert" on friendships for insert to authenticated with check (user_id = auth.uid());
create policy "friendships update" on friendships for update to authenticated using (friend_id = auth.uid() or user_id = auth.uid());
create policy "nudges read" on nudges for select to authenticated using (from_id = auth.uid() or to_id = auth.uid());
create policy "presence read" on presence for select to authenticated using (user_id = auth.uid() or are_friends(auth.uid(), user_id) or same_crew(auth.uid(), user_id));
create policy "presence write" on presence for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "duo read" on duo_quests for select to authenticated using (user_a = auth.uid() or user_b = auth.uid());
create policy "crews read" on crews for select to authenticated using (exists (select 1 from crew_members m where m.crew_id = id and m.user_id = auth.uid()));
create policy "crews insert" on crews for insert to authenticated with check (captain_id = auth.uid());
create policy "crew members read" on crew_members for select to authenticated using (same_crew(auth.uid(), user_id) or user_id = auth.uid());
create policy "crew members join" on crew_members for insert to authenticated with check (user_id = auth.uid());
create policy "saves read" on streak_saves for select to authenticated using (saver_id = auth.uid() or saved_id = auth.uid());
create policy "leagues read" on leagues for select to authenticated using (exists (select 1 from league_members m where m.league_id = id and m.user_id = auth.uid()));
create policy "league members read" on league_members for select to authenticated using (exists (select 1 from league_members me where me.league_id = league_members.league_id and me.user_id = auth.uid()));
create policy "gems read" on gem_ledger for select to authenticated using (user_id = auth.uid());
create policy "push own" on push_subscriptions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- bootstrap a new user ----------
create or replace function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare uname text;
begin
  uname := lower(regexp_replace(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1), 'rep'), '[^a-z0-9_]', '', 'g'));
  if length(uname) < 3 then uname := 'rep_' || substr(new.id::text, 1, 6); end if;
  if exists (select 1 from profiles where username = uname) then uname := uname || '_' || substr(new.id::text, 1, 4); end if;
  insert into profiles (id, username, display_name) values (new.id, uname, coalesce(new.raw_user_meta_data->>'display_name', initcap(split_part(uname, '_', 1))));
  insert into streaks (user_id) values (new.id);
  insert into user_crowns (user_id, track) select new.id, t from unnest(enum_range(null::track_t)) t;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- ---------- scoring: the only way XP is written ----------
-- Mirrors src/lib/rules.ts scoreSet / applyCrownProgress / countDay.
create or replace function complete_set(p_set_id uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s sets%rowtype; p profiles%rowtype; st streaks%rowtype;
  mv jsonb; completed int := 0; v_perfect boolean := true; v_xp int; first_of_day boolean; crown_ups track_t[] := '{}';
  t track_t; c user_crowns%rowtype; lvl crown_levels%rowtype; reqs jsonb; hit boolean; relevant int; r jsonb; today date;
begin
  select * into s from sets where id = p_set_id and user_id = auth.uid() for update;
  if not found then raise exception 'set not found'; end if;
  if s.status = 'done' then return jsonb_build_object('xp', s.xp, 'perfect', s.perfect, 'already', true); end if;
  select * into p from profiles where id = s.user_id;
  select * into st from streaks where user_id = s.user_id for update;
  today := (now() at time zone p.timezone)::date;

  for mv in select * from jsonb_array_elements(s.moves) loop
    if coalesce((mv->>'achieved')::int, 0) > 0 then completed := completed + 1; end if;
    if coalesce((mv->>'achieved')::int, 0) < (mv->>'target')::int then v_perfect := false; end if;
  end loop;
  v_perfect := v_perfect and jsonb_array_length(s.moves) > 0;
  first_of_day := not exists (select 1 from sets x where x.user_id = s.user_id and x.date = s.date and x.status = 'done' and x.kind <> 'placement');

  -- crowns
  foreach t in array s.tracks loop
    if t = 'mobility' and s.kind not in ('rest','rescue') then continue; end if;
    select * into c from user_crowns where user_id = s.user_id and track = t for update;
    select * into lvl from crown_levels where track = t and level = c.level;
    reqs := case when p.environment = 'gym' then lvl.gym else lvl.requirements end;
    hit := true; relevant := 0; mv := null;
    for r in select * from jsonb_array_elements(reqs) loop
      mv := null;
      select e into mv from jsonb_array_elements(s.moves) e where e->>'movement' = r->>'movement' limit 1;
      if mv is not null then relevant := relevant + 1; if coalesce((mv->>'achieved')::int,0) < (mv->>'target')::int then hit := false; end if; end if;
    end loop;
    if relevant = 0 then continue; end if;
    if hit then
      c.misses := 0;
      if c.last_clear_date is distinct from s.date then c.clears := c.clears + 1; c.last_clear_date := s.date; end if;
      if c.clears >= 3 and c.level < 5 then c.level := c.level + 1; c.clears := 0; crown_ups := crown_ups || t; end if;
    else c.misses := c.misses + 1; end if;
    update user_crowns set level = c.level, clears = c.clears, misses = c.misses, last_clear_date = c.last_clear_date where user_id = s.user_id and track = t;
  end loop;

  v_xp := completed * 10;
  if first_of_day then v_xp := v_xp * 2; end if;
  if array_length(crown_ups, 1) > 0 then v_xp := round(v_xp * 1.5); end if;
  if v_perfect then v_xp := v_xp + 25; end if;
  if s.kind = 'rescue' then v_xp := round(v_xp * 0.5); end if;

  -- streak
  if st.last_counted_date is distinct from s.date then
    if st.last_counted_date = s.date - 1 or st.last_counted_date is null then st.current := st.current + 1; else st.current := 1; end if;
    st.longest := greatest(st.longest, st.current); st.last_counted_date := s.date;
    update streaks set current = st.current, longest = st.longest, last_counted_date = st.last_counted_date where user_id = s.user_id;
  end if;

  update sets set status = 'done', xp = v_xp, perfect = v_perfect, finished_at = now() where id = s.id;
  insert into set_results (set_id, movement, target, achieved, xp) select s.id, e->>'movement', (e->>'target')::int, coalesce((e->>'achieved')::int,0), 10 from jsonb_array_elements(s.moves) e;
  insert into day_log (user_id, date, kind) values (s.user_id, s.date, case when s.kind in ('rest','rescue') then 'rest' when v_perfect then 'perfect' else 'done' end)
    on conflict (user_id, date) do update set kind = excluded.kind where day_log.kind in ('missed','frozen');
  update profiles set xp_total = xp_total + v_xp, gems = gems + (case when v_perfect then 10 else 0 end) + coalesce(array_length(crown_ups,1),0) * 25 where id = s.user_id;
  if v_perfect then insert into gem_ledger (user_id, delta, reason) values (s.user_id, 10, 'perfect_set'); end if;
  if array_length(crown_ups,1) > 0 then insert into gem_ledger (user_id, delta, reason) values (s.user_id, 25 * array_length(crown_ups,1), 'crown_up'); end if;
  update league_members lm set xp = lm.xp + v_xp, sets = lm.sets + (case when first_of_day then 1 else 0 end), perfect = lm.perfect + (case when v_perfect then 1 else 0 end),
    xp_normalized = round((lm.xp + v_xp)::numeric / (case p.goal_tier when 'casual' then 5 when 'regular' then 10 else 15 end) * 10)
    from leagues l where lm.league_id = l.id and lm.user_id = s.user_id and l.week_start = (select max(week_start) from leagues);
  update duo_quests set xp_a = xp_a + v_xp where user_a = s.user_id and status = 'active';
  update duo_quests set xp_b = xp_b + v_xp where user_b = s.user_id and status = 'active';
  delete from presence where user_id = s.user_id;
  return jsonb_build_object('xp', v_xp, 'perfect', v_perfect, 'crown_ups', to_jsonb(crown_ups), 'streak', st.current);
end $$;
revoke all on function complete_set(uuid) from public;
grant execute on function complete_set(uuid) to authenticated;

-- nudge: one per friend per day, +5 XP to sender, notification to receiver handled by edge fn
create or replace function send_nudge(p_to uuid) returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not are_friends(auth.uid(), p_to) and not same_crew(auth.uid(), p_to) then raise exception 'not friends'; end if;
  insert into nudges (from_id, to_id) values (auth.uid(), p_to) on conflict do nothing;
  if not found then return false; end if;
  update profiles set xp_total = xp_total + 5 where id = auth.uid();
  update league_members lm set xp = lm.xp + 5 from leagues l where lm.league_id = l.id and lm.user_id = auth.uid() and l.week_start = (select max(week_start) from leagues);
  return true;
end $$;
grant execute on function send_nudge(uuid) to authenticated;

-- use a freeze for today (manual) — nightly close_day also auto-applies
create or replace function use_freeze() returns boolean language plpgsql security definer set search_path = public as $$
declare p profiles%rowtype; st streaks%rowtype; today date;
begin
  select * into p from profiles where id = auth.uid();
  select * into st from streaks where user_id = auth.uid() for update;
  today := (now() at time zone p.timezone)::date;
  if st.freezes <= 0 or st.last_counted_date = today then return false; end if;
  update streaks set freezes = freezes - 1, last_counted_date = today, current = case when last_counted_date = today - 1 or last_counted_date is null then current + 1 else 1 end where user_id = auth.uid();
  insert into day_log (user_id, date, kind) values (auth.uid(), today, 'frozen') on conflict do nothing;
  return true;
end $$;
grant execute on function use_freeze() to authenticated;
