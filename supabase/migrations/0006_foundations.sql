-- Foundations for the eight bets: analytics events, the per-move ledger, and profile fields
-- shared by Promise, Evening, Anchors, Letters, Test Set and Health credit.

-- ---------- analytics ----------
create table if not exists events (
  id bigserial primary key,
  user_id uuid references profiles(id) on delete cascade,
  name text not null,
  props jsonb not null default '{}',
  at timestamptz not null default now()
);
create index if not exists events_user_at on events(user_id, at desc);
create index if not exists events_name_at on events(name, at desc);
alter table events enable row level security;
-- the client writes through track_event only; nobody reads events from the client
create or replace function track_event(p_name text, p_props jsonb default '{}') returns void language sql security definer set search_path = public as $$
  insert into events (user_id, name, props) values (auth.uid(), p_name, coalesce(p_props, '{}'::jsonb))
$$;
grant execute on function track_event(text, jsonb) to authenticated;
revoke all on function track_event(text, jsonb) from anon;

-- ---------- the ledger: one row per user, movement and day ----------
create table if not exists move_daily (
  user_id uuid not null references profiles(id) on delete cascade,
  movement text not null,
  date date not null,
  achieved integer not null,
  target integer not null,
  test boolean not null default false,
  primary key (user_id, movement, date)
);
alter table move_daily enable row level security;
create policy "ledger read own" on move_daily for select to authenticated using (user_id = auth.uid());

-- filled when a set is marked done (complete_set updates sets.status); keeps the best number of the day
create or replace function ledger_from_set() returns trigger language plpgsql security definer set search_path = public as $$
declare e jsonb;
begin
  if new.status <> 'done' or (old.status = 'done') then return new; end if;
  for e in select * from jsonb_array_elements(new.moves) loop
    if coalesce((e->>'achieved')::int, 0) > 0 then
      insert into move_daily (user_id, movement, date, achieved, target, test)
      values (new.user_id, e->>'movement', new.date, (e->>'achieved')::int, (e->>'target')::int, coalesce((e->>'test')::boolean, false))
      on conflict (user_id, movement, date) do update set achieved = greatest(move_daily.achieved, excluded.achieved), target = excluded.target;
    end if;
  end loop;
  return new;
end $$;
drop trigger if exists ledger_from_set on sets;
create trigger ledger_from_set after update of status on sets for each row execute function ledger_from_set();

create or replace function my_ledger(p_since date default current_date - 90) returns setof move_daily language sql stable security definer set search_path = public as $$
  select * from move_daily where user_id = auth.uid() and date >= p_since order by date
$$;
grant execute on function my_ledger(date) to authenticated;

-- ---------- profile fields ----------
alter table profiles
  add column if not exists promise_days smallint not null default 4 check (promise_days between 3 and 7),
  add column if not exists promise_weeks_kept integer not null default 0,
  add column if not exists promise_week_start date,
  add column if not exists rescue_at time not null default '21:00',
  add column if not exists anchor text not null default 'time' check (anchor in ('time','home','tag')),
  add column if not exists home_lat double precision,
  add column if not exists home_lng double precision,
  add column if not exists tag_code text unique,
  add column if not exists note_recorded_at timestamptz,
  add column if not exists note_text text,
  add column if not exists birth_year smallint,
  add column if not exists sex text check (sex in ('f','m')),
  add column if not exists health_connected boolean not null default false;

-- a day can be "moved": credited from outside the app; streak-safe, no XP
alter table day_log drop constraint if exists day_log_kind_check;
alter table day_log add constraint day_log_kind_check check (kind in ('perfect','done','rest','missed','frozen','moved'));

-- the monthly test move
insert into movements (id, name, track, difficulty, env, unit, cue, flags)
values ('chair_stand_30s', 'Chair stands', 'legs', 1, '{home,gym,travel}', 'reps', 'Arms crossed. Stand all the way up, sit all the way down. Count every full stand in 30 seconds.', '{}')
on conflict (id) do nothing;

-- custom (prescribed) moves are not in the catalog
alter table set_results drop constraint if exists set_results_movement_fkey;

-- profile upsert from the client may now carry the new fields; generic patch RPC keeps RLS simple
create or replace function patch_profile(p jsonb) returns void language plpgsql security definer set search_path = public as $$
begin
  update profiles set
    promise_days = coalesce((p->>'promise_days')::smallint, promise_days),
    promise_weeks_kept = coalesce((p->>'promise_weeks_kept')::int, promise_weeks_kept),
    promise_week_start = coalesce((p->>'promise_week_start')::date, promise_week_start),
    rescue_at = coalesce((p->>'rescue_at')::time, rescue_at),
    anchor = coalesce(p->>'anchor', anchor),
    home_lat = coalesce((p->>'home_lat')::double precision, home_lat),
    home_lng = coalesce((p->>'home_lng')::double precision, home_lng),
    note_recorded_at = coalesce((p->>'note_recorded_at')::timestamptz, note_recorded_at),
    note_text = coalesce(p->>'note_text', note_text),
    birth_year = coalesce((p->>'birth_year')::smallint, birth_year),
    sex = coalesce(p->>'sex', sex),
    health_connected = coalesce((p->>'health_connected')::boolean, health_connected)
  where id = auth.uid();
end $$;
grant execute on function patch_profile(jsonb) to authenticated;
revoke all on function patch_profile(jsonb) from anon;

create or replace function my_profile_extras() returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('promise_days', promise_days, 'promise_weeks_kept', promise_weeks_kept, 'promise_week_start', promise_week_start,
    'rescue_at', rescue_at, 'anchor', anchor, 'home_lat', home_lat, 'home_lng', home_lng, 'tag_code', tag_code,
    'note_recorded_at', note_recorded_at, 'note_text', note_text, 'birth_year', birth_year, 'sex', sex, 'health_connected', health_connected)
  from profiles where id = auth.uid()
$$;
grant execute on function my_profile_extras() to authenticated;

-- a day credited from outside the app (Health). Streak-safe; no XP, crowns or league.
create or replace function credit_moved(p_date date, p_source text) returns boolean language plpgsql security definer set search_path = public as $$
declare st streaks%rowtype;
begin
  if exists (select 1 from day_log where user_id = auth.uid() and date = p_date and kind in ('perfect','done','rest')) then return false; end if;
  insert into day_log (user_id, date, kind) values (auth.uid(), p_date, 'moved') on conflict (user_id, date) do update set kind = 'moved' where day_log.kind in ('missed','frozen');
  select * into st from streaks where user_id = auth.uid() for update;
  if st.last_counted_date is distinct from p_date then
    update streaks set current = case when last_counted_date = p_date - 1 or last_counted_date is null then current + 1 else 1 end,
      longest = greatest(longest, case when last_counted_date = p_date - 1 or last_counted_date is null then current + 1 else 1 end),
      last_counted_date = p_date where user_id = auth.uid();
  end if;
  perform track_event('day_moved', jsonb_build_object('source', p_source));
  return true;
end $$;
grant execute on function credit_moved(date, text) to authenticated;
