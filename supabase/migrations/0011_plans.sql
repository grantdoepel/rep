-- PRD 8 · Prescribed Sets: a prescriber (clinic, PT, coach) writes a 3-5 move plan and hands the patient a link.
-- The patient joins with the code; their Set becomes the plan's moves; the prescriber sees adherence by day and move.
-- Clients never write these tables directly: everything goes through the SECURITY DEFINER RPCs below.

-- ---------- tables ----------
create table if not exists prescriber (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references profiles(id) on delete cascade,
  org_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists plan (
  id uuid primary key default gen_random_uuid(),
  prescriber_id uuid not null references prescriber(id) on delete cascade,
  name text not null,
  moves jsonb not null,                      -- [{id,name,target,unit,cue?}] × 3..5
  weeks smallint not null check (weeks between 1 and 12),
  days_per_week smallint not null check (days_per_week between 1 and 7),
  code text unique not null default encode(gen_random_bytes(5), 'hex'),
  created_at timestamptz not null default now()
);
create index if not exists plan_prescriber on plan(prescriber_id);

create table if not exists plan_member (
  plan_id uuid not null references plan(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  primary key (plan_id, user_id)
);
create index if not exists plan_member_user_active on plan_member(user_id) where ended_at is null;

-- ---------- RLS ----------
alter table prescriber enable row level security;
alter table plan enable row level security;
alter table plan_member enable row level security;

-- helper used inside policies (needs EXECUTE for authenticated, see 0004)
create or replace function my_prescriber_id() returns uuid language sql stable security definer set search_path = public as $$
  select id from prescriber where user_id = auth.uid()
$$;
grant execute on function my_prescriber_id() to authenticated;
revoke all on function my_prescriber_id() from anon;

create policy "prescriber read own" on prescriber for select to authenticated using (user_id = auth.uid());
create policy "plan read own or member" on plan for select to authenticated
  using (prescriber_id = my_prescriber_id() or exists (select 1 from plan_member m where m.plan_id = id and m.user_id = auth.uid()));
create policy "plan member read own or prescriber" on plan_member for select to authenticated
  using (user_id = auth.uid() or exists (select 1 from plan p where p.id = plan_id and p.prescriber_id = my_prescriber_id()));
-- no insert/update/delete policies: writes go through the RPCs

-- ---------- RPCs ----------

-- A signed-in user becomes (or renames themselves as) a prescriber. Returns the prescriber id.
create or replace function become_prescriber(p_org text) returns uuid language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if coalesce(trim(p_org), '') = '' then raise exception 'organisation name required'; end if;
  insert into prescriber (user_id, org_name) values (auth.uid(), trim(p_org))
    on conflict (user_id) do update set org_name = excluded.org_name
    returning id into pid;
  return pid;
end $$;
grant execute on function become_prescriber(text) to authenticated;
revoke all on function become_prescriber(text) from anon;

-- Create a plan. Validates 3-5 moves, weeks 1-12, days 1-7. Custom moves (no catalog id, or id starting with
-- "custom") get ids `custom:<plan id>:<n>` here so the ledger can tell one clinic's "heel raise" from another's.
create or replace function create_plan(p_name text, p_moves jsonb, p_weeks int, p_days int) returns text language plpgsql security definer set search_path = public as $$
declare
  pid uuid; new_id uuid; new_code text; n int; i int := 0; e jsonb; mv jsonb; out_moves jsonb := '[]'::jsonb; mid text; mname text; munit text; mtarget int;
begin
  select id into pid from prescriber where user_id = auth.uid();
  if pid is null then raise exception 'not a prescriber'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'plan name required'; end if;
  if p_weeks is null or p_weeks < 1 or p_weeks > 12 then raise exception 'weeks must be 1-12'; end if;
  if p_days is null or p_days < 1 or p_days > 7 then raise exception 'days per week must be 1-7'; end if;
  if p_moves is null or jsonb_typeof(p_moves) <> 'array' then raise exception 'moves must be a list'; end if;
  n := jsonb_array_length(p_moves);
  if n < 3 or n > 5 then raise exception 'a plan has 3 to 5 moves'; end if;

  new_id := gen_random_uuid();
  for e in select * from jsonb_array_elements(p_moves) loop
    i := i + 1;
    mid := nullif(trim(coalesce(e->>'id', '')), '');
    mname := nullif(trim(coalesce(e->>'name', '')), '');
    munit := coalesce(e->>'unit', 'reps');
    mtarget := coalesce((e->>'target')::int, 0);
    if munit not in ('reps', 'seconds') then raise exception 'unit must be reps or seconds'; end if;
    if mtarget < 1 or mtarget > 600 then raise exception 'target must be 1-600'; end if;
    if mid is not null and exists (select 1 from movements m where m.id = mid) then
      if mname is null then select name into mname from movements where id = mid; end if;
    else
      if mname is null then raise exception 'custom move % needs a name', i; end if;
      mid := 'custom:' || new_id::text || ':' || i::text;
    end if;
    mv := jsonb_build_object('id', mid, 'name', mname, 'target', mtarget, 'unit', munit);
    if coalesce(e->>'cue', '') <> '' then mv := mv || jsonb_build_object('cue', left(e->>'cue', 200)); end if;
    out_moves := out_moves || jsonb_build_array(mv);
  end loop;

  insert into plan (id, prescriber_id, name, moves, weeks, days_per_week) values (new_id, pid, trim(p_name), out_moves, p_weeks, p_days)
    returning code into new_code;
  perform track_event('plan_created', jsonb_build_object('plan_id', new_id, 'moves', n, 'weeks', p_weeks, 'days', p_days));
  return new_code;
end $$;
grant execute on function create_plan(text, jsonb, int, int) to authenticated;
revoke all on function create_plan(text, jsonb, int, int) from anon;

-- What a patient sees before consenting: who it is from and how long it runs. No member data.
-- Also callable by anon: the consent screen names the clinic before sign-in ("Sign in to join Northside Physio").
-- The code is the only input and it reveals nothing about any patient.
create or replace function plan_preview(p_code text) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('clinic', pr.org_name, 'name', p.name, 'weeks', p.weeks, 'days', p.days_per_week, 'moves', jsonb_array_length(p.moves))
  from plan p join prescriber pr on pr.id = p.prescriber_id
  where p.code = lower(trim(p_code))
$$;
grant execute on function plan_preview(text) to authenticated, anon;

-- Join a plan by code. One active plan at a time: any current membership is ended first.
create or replace function join_plan(p_code text) returns jsonb language plpgsql security definer set search_path = public as $$
declare p plan%rowtype; clinic text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into p from plan where code = lower(trim(p_code));
  if p.id is null then raise exception 'no plan with that code'; end if;
  update plan_member set ended_at = now() where user_id = auth.uid() and ended_at is null and plan_id <> p.id;
  insert into plan_member (plan_id, user_id, started_at, ended_at) values (p.id, auth.uid(), now(), null)
    on conflict (plan_id, user_id) do update set started_at = case when plan_member.ended_at is null then plan_member.started_at else now() end, ended_at = null;
  select org_name into clinic from prescriber where id = p.prescriber_id;
  perform track_event('plan_joined', jsonb_build_object('plan_id', p.id, 'clinic', clinic));
  return jsonb_build_object('clinic', clinic, 'name', p.name);
end $$;
grant execute on function join_plan(text) to authenticated;
revoke all on function join_plan(text) from anon;

-- Leave the active plan (the prescriber keeps the history up to today).
create or replace function end_plan() returns boolean language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update plan_member set ended_at = now() where user_id = auth.uid() and ended_at is null;
  get diagnostics n = row_count;
  if n > 0 then perform track_event('plan_ended', '{}'::jsonb); end if;
  return n > 0;
end $$;
grant execute on function end_plan() to authenticated;
revoke all on function end_plan() from anon;

-- The caller's active plan, shaped for the client's Plan type. Null when there is none.
create or replace function my_plan() returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', p.id, 'clinic', pr.org_name, 'name', p.name, 'moves', p.moves, 'weeks', p.weeks, 'days_per_week', p.days_per_week, 'started_at', m.started_at)
  from plan_member m join plan p on p.id = m.plan_id join prescriber pr on pr.id = p.prescriber_id
  where m.user_id = auth.uid() and m.ended_at is null
  order by m.started_at desc limit 1
$$;
grant execute on function my_plan() to authenticated;
revoke all on function my_plan() from anon;

-- Prescriber-only: one row per member per day they did a Set (or had one credited), from started_at on,
-- limited to the plan's own movements. Patients are labelled "First L." and never by email or id.
create or replace function plan_adherence(p_plan_id uuid) returns table (user_label text, week int, day date, kind text, moves jsonb, start_day date)
language plpgsql security definer set search_path = public as $$
declare p plan%rowtype;
begin
  select * into p from plan where id = p_plan_id;
  if p.id is null or p.prescriber_id is distinct from (select id from prescriber where user_id = auth.uid()) then raise exception 'not your plan'; end if;
  return query
    with members as (
      select m.user_id, (m.started_at at time zone coalesce(pf.timezone, 'UTC'))::date as start_day, coalesce(m.ended_at, now()) as ended_at, pf.display_name, pf.timezone
      from plan_member m join profiles pf on pf.id = m.user_id where m.plan_id = p.id
    ),
    ids as (select e->>'id' as id, e->>'name' as name from jsonb_array_elements(p.moves) e),
    days as (
      select mb.user_id, mb.display_name, mb.start_day, d.date, d.kind
      from members mb join day_log d on d.user_id = mb.user_id
      where d.date >= mb.start_day and d.date <= (mb.ended_at at time zone coalesce(mb.timezone, 'UTC'))::date and d.kind in ('perfect','done','rest','moved')
    )
    select
      split_part(dy.display_name, ' ', 1) || case when split_part(dy.display_name, ' ', 2) <> '' then ' ' || left(split_part(dy.display_name, ' ', 2), 1) || '.' else '' end as user_label,
      ((dy.date - dy.start_day) / 7 + 1)::int as week,
      dy.date as day,
      dy.kind,
      coalesce((select jsonb_agg(jsonb_build_object('id', md.movement, 'name', ids.name, 'achieved', md.achieved, 'target', md.target) order by md.movement)
                from move_daily md join ids on ids.id = md.movement where md.user_id = dy.user_id and md.date = dy.date), '[]'::jsonb) as moves,
      dy.start_day
    from days dy
    order by dy.display_name, dy.date;
end $$;
grant execute on function plan_adherence(uuid) to authenticated;
revoke all on function plan_adherence(uuid) from anon;

-- Prescriber-only: every plan with member count and adherence so far.
-- adherence = done days / prescribed days so far, summed across active members (null when nothing is due yet).
create or replace function my_plans() returns table (id uuid, name text, code text, moves jsonb, weeks int, days_per_week int, created_at timestamptz, members int, adherence numeric, last_done date,
  patients jsonb)
language sql stable security definer set search_path = public as $$
  with mine as (select p.* from plan p where p.prescriber_id = my_prescriber_id()),
  mem as (
    select m.plan_id, m.user_id, m.ended_at,
      (m.started_at at time zone coalesce(pf.timezone, 'UTC'))::date as start_day,
      (coalesce(m.ended_at, now()) at time zone coalesce(pf.timezone, 'UTC'))::date as end_day,
      split_part(pf.display_name, ' ', 1) || case when split_part(pf.display_name, ' ', 2) <> '' then ' ' || left(split_part(pf.display_name, ' ', 2), 1) || '.' else '' end as label,
      pl.weeks, pl.days_per_week
    from plan_member m join mine pl on pl.id = m.plan_id join profiles pf on pf.id = m.user_id
  ),
  per as (
    select mem.plan_id, mem.user_id, mem.label, mem.ended_at,
      least(mem.weeks * 7, (mem.end_day - mem.start_day) + 1) as elapsed_days,
      least(mem.weeks, (mem.end_day - mem.start_day) / 7 + 1) as week,
      (select count(*) from day_log d where d.user_id = mem.user_id and d.date between mem.start_day and least(mem.end_day, mem.start_day + mem.weeks * 7 - 1) and d.kind in ('perfect','done','rest','moved')) as done_days,
      (select max(d.date) from day_log d where d.user_id = mem.user_id and d.date >= mem.start_day and d.kind in ('perfect','done','rest','moved')) as last_done,
      mem.weeks, mem.days_per_week
    from mem
  ),
  per2 as (
    select *, greatest(1, ceil(elapsed_days::numeric * days_per_week / 7.0))::int as due_days from per
  )
  select pl.id, pl.name, pl.code, pl.moves, pl.weeks::int, pl.days_per_week::int, pl.created_at,
    (select count(*) from per2 where per2.plan_id = pl.id and per2.ended_at is null)::int as members,
    (select round(100.0 * sum(least(done_days, due_days)) / nullif(sum(due_days), 0)) from per2 where per2.plan_id = pl.id and per2.ended_at is null) as adherence,
    (select max(last_done) from per2 where per2.plan_id = pl.id) as last_done,
    coalesce((select jsonb_agg(jsonb_build_object('label', label, 'week', week, 'done', done_days, 'due', due_days, 'last_done', last_done, 'ended', ended_at is not null) order by label) from per2 where per2.plan_id = pl.id), '[]'::jsonb) as patients
  from mine pl
  order by pl.created_at desc
$$;
grant execute on function my_plans() to authenticated;
revoke all on function my_plans() from anon;

-- What the signed-in user is as a prescriber (null when they are not one yet).
create or replace function my_prescriber() returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', id, 'org_name', org_name) from prescriber where user_id = auth.uid()
$$;
grant execute on function my_prescriber() to authenticated;
revoke all on function my_prescriber() from anon;
