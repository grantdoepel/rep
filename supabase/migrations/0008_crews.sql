-- PRD 3 · Crews, smallest version: one crew per user, up to six members, one shared weekly XP target
-- (members × 300), Monday reset. Reuses crews + crew_members from 0001; adds crew_week and the RPCs.

-- ---------- the shared week ----------
create table if not exists crew_week (
  crew_id uuid not null references crews(id) on delete cascade,
  week_start date not null,
  xp integer not null default 0,
  kept boolean not null default false,
  primary key (crew_id, week_start)
);
alter table crew_week enable row level security;
create policy "crew week read" on crew_week for select to authenticated
  using (exists (select 1 from crew_members m where m.crew_id = crew_week.crew_id and m.user_id = auth.uid()));

-- XP target for a crew this week: members × 300
create or replace function crew_target_xp(p_crew uuid) returns integer language sql stable security definer set search_path = public as $$
  select (count(*) * 300)::integer from crew_members where crew_id = p_crew
$$;
grant execute on function crew_target_xp(uuid) to authenticated;
revoke all on function crew_target_xp(uuid) from anon;

-- A Set marked done adds its XP to the member's crew week (row created on first Set of the week).
-- Runs after ledger_from_set on the same status flip; the Monday rollover is implicit: a new week_start row.
create or replace function crew_week_from_set() returns trigger language plpgsql security definer set search_path = public as $$
declare cid uuid; ws date;
begin
  if new.status <> 'done' or old.status = 'done' then return new; end if;
  select crew_id into cid from crew_members where user_id = new.user_id limit 1;
  if cid is null then return new; end if;
  ws := date_trunc('week', new.date)::date;
  insert into crew_week (crew_id, week_start, xp) values (cid, ws, coalesce(new.xp, 0))
    on conflict (crew_id, week_start) do update set xp = crew_week.xp + excluded.xp;
  update crew_week set kept = kept or xp >= crew_target_xp(cid) where crew_id = cid and week_start = ws;
  return new;
end $$;
drop trigger if exists crew_week_from_set on sets;
create trigger crew_week_from_set after update of status on sets for each row execute function crew_week_from_set();

-- ---------- membership writes go through RPCs only ----------
drop policy if exists "crews insert" on crews;
drop policy if exists "crew members join" on crew_members;

-- Start a crew. Caller becomes captain; returns the invite code for the share link.
create or replace function create_crew(p_name text) returns text language plpgsql security definer set search_path = public as $$
declare nm text; c crews%rowtype;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  nm := trim(coalesce(p_name, ''));
  if length(nm) = 0 then raise exception 'name your crew'; end if;
  if length(nm) > 24 then raise exception 'name is too long'; end if;
  if exists (select 1 from crew_members where user_id = auth.uid()) then raise exception 'already in a crew'; end if;
  insert into crews (name, captain_id, weekly_goal_per_member) values (nm, auth.uid(), 300) returning * into c;
  insert into crew_members (crew_id, user_id) values (c.id, auth.uid());
  return c.invite_code;
end $$;
revoke all on function create_crew(text) from public, anon;
grant execute on function create_crew(text) to authenticated;

-- Join by code. Max six; one crew per person. Returns the crew name.
create or replace function join_crew(p_code text) returns text language plpgsql security definer set search_path = public as $$
declare c crews%rowtype; n integer;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  select * into c from crews where invite_code = lower(trim(coalesce(p_code, ''))) for update;
  if not found then raise exception 'that code is not a crew'; end if;
  if exists (select 1 from crew_members where crew_id = c.id and user_id = auth.uid()) then return c.name; end if;
  if exists (select 1 from crew_members where user_id = auth.uid()) then raise exception 'already in a crew'; end if;
  select count(*) into n from crew_members where crew_id = c.id;
  if n >= 6 then raise exception 'that crew is full'; end if;
  insert into crew_members (crew_id, user_id) values (c.id, auth.uid());
  return c.name;
end $$;
revoke all on function join_crew(text) from public, anon;
grant execute on function join_crew(text) to authenticated;

-- Leave. An empty crew is deleted; otherwise the captaincy passes to the longest-standing member.
create or replace function leave_crew() returns void language plpgsql security definer set search_path = public as $$
declare cid uuid; nxt uuid;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  select crew_id into cid from crew_members where user_id = auth.uid() limit 1;
  if cid is null then return; end if;
  delete from crew_members where crew_id = cid and user_id = auth.uid();
  select user_id into nxt from crew_members where crew_id = cid order by joined_at asc limit 1;
  if nxt is null then delete from crews where id = cid; return; end if;
  update crews set captain_id = nxt where id = cid and captain_id = auth.uid();
end $$;
revoke all on function leave_crew() from public, anon;
grant execute on function leave_crew() to authenticated;

-- The caller's crew for the Home card and /crew: null when not in one.
-- done_today: a day_log row of kind perfect|done|rest|moved for the member's local today.
-- done_at: the member's last Set finished today. streak: streaks.current.
create or replace function crew_state() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me profiles%rowtype; c crews%rowtype; today date; ws date; cw crew_week%rowtype; members jsonb;
begin
  if auth.uid() is null then return null; end if;
  select * into me from profiles where id = auth.uid();
  if not found then return null; end if;
  select cr.* into c from crews cr join crew_members m on m.crew_id = cr.id where m.user_id = auth.uid() limit 1;
  if not found then return null; end if;
  today := (now() at time zone me.timezone)::date;
  ws := date_trunc('week', today)::date;
  select * into cw from crew_week where crew_id = c.id and week_start = ws;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id,
      'display_name', p.display_name,
      'done_today', exists (select 1 from day_log d where d.user_id = p.id and d.date = (now() at time zone p.timezone)::date and d.kind in ('perfect','done','rest','moved')),
      'done_at', (select max(s.finished_at) from sets s where s.user_id = p.id and s.status = 'done' and s.date = (now() at time zone p.timezone)::date),
      'streak', coalesce(st.current, 0),
      'is_you', p.id = auth.uid(),
      'is_captain', p.id = c.captain_id
    ) order by m.joined_at), '[]'::jsonb) into members
  from crew_members m join profiles p on p.id = m.user_id left join streaks st on st.user_id = p.id
  where m.crew_id = c.id;
  return jsonb_build_object(
    'id', c.id, 'name', c.name, 'code', c.invite_code, 'created_at', c.created_at,
    'week_start', ws, 'xp', coalesce(cw.xp, 0), 'target_xp', crew_target_xp(c.id), 'kept', coalesce(cw.kept, false),
    'members', members);
end $$;
revoke all on function crew_state() from public, anon;
grant execute on function crew_state() to authenticated;

-- ---------- archive sweep (run separately) ----------
-- The integrator schedules this on its own: Mondays 04:00 UTC, drop crews where nobody has finished a Set
-- in 14 days (and the crew is old enough to have had the chance).
select cron.unschedule('crew_archive') where exists (select 1 from cron.job where jobname = 'crew_archive');
select cron.schedule('crew_archive', '0 4 * * 1', $$
  delete from crews c
  where c.created_at < now() - interval '14 days'
    and not exists (select 1 from sets s join crew_members m on m.user_id = s.user_id
                    where m.crew_id = c.id and s.status = 'done' and s.date >= current_date - 14)
$$);
