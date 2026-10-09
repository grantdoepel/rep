-- Sweatmates-inspired additions: proof shots, Duo wagers, Pinky Promise, Treat Yourself, gym reminder, crew awards.
-- Mirrors the live migrations rep_sweatmates_features + rep_policy_helper_grants.

alter table profiles
  add column if not exists treat_text text,
  add column if not exists treat_milestone smallint,
  add column if not exists gym_lat double precision,
  add column if not exists gym_lng double precision,
  add column if not exists gym_name text;

alter table duo_quests
  add column if not exists wager_a text,
  add column if not exists wager_b text,
  add column if not exists settled_by uuid references profiles(id);

create table if not exists proof_shots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  set_id uuid references sets(id) on delete set null,
  storage_path text not null,
  date date not null,
  expires_at timestamptz not null default now() + interval '24 hours',
  created_at timestamptz not null default now()
);
create index if not exists proof_shots_user_date on proof_shots (user_id, date desc);
alter table proof_shots enable row level security;
create policy "proof write" on proof_shots for insert to authenticated with check (user_id = auth.uid());
create policy "proof read" on proof_shots for select to authenticated
  using (user_id = auth.uid() or ((are_friends(auth.uid(), user_id) or same_crew(auth.uid(), user_id)) and expires_at > now()));

create table if not exists pinky_promises (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references profiles(id) on delete cascade,
  voucher_id uuid not null references profiles(id) on delete cascade,
  date date not null,
  status text not null default 'pending' check (status in ('pending','vouched','declined')),
  created_at timestamptz not null default now(),
  unique (requester_id, date)
);
alter table pinky_promises enable row level security;
create policy "pinky read" on pinky_promises for select to authenticated using (requester_id = auth.uid() or voucher_id = auth.uid());
create policy "pinky request" on pinky_promises for insert to authenticated with check (requester_id = auth.uid() and are_friends(auth.uid(), voucher_id));

create or replace function pinky_quota_ok() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from pinky_promises where requester_id = new.requester_id and created_at >= date_trunc('month', now())) >= 2 then
    raise exception 'pinky promise limit is 2 per month';
  end if;
  return new;
end $$;
create trigger pinky_quota before insert on pinky_promises for each row execute function pinky_quota_ok();

create or replace function resolve_pinky(p_id uuid, p_ok boolean) returns boolean language plpgsql security definer set search_path = public as $$
declare pp pinky_promises%rowtype; st streaks%rowtype;
begin
  select * into pp from pinky_promises where id = p_id and voucher_id = auth.uid() and status = 'pending' for update;
  if not found then return false; end if;
  update pinky_promises set status = case when p_ok then 'vouched' else 'declined' end where id = p_id;
  if p_ok then
    select * into st from streaks where user_id = pp.requester_id for update;
    if st.last_counted_date is distinct from pp.date and (st.last_counted_date is null or st.last_counted_date < pp.date) then
      update streaks set current = case when last_counted_date = pp.date - 1 or last_counted_date is null then current + 1 else 1 end,
                         longest = greatest(longest, current + 1), last_counted_date = pp.date
       where user_id = pp.requester_id;
    end if;
    insert into day_log (user_id, date, kind) values (pp.requester_id, pp.date, 'done')
      on conflict (user_id, date) do update set kind = 'done' where day_log.kind in ('missed','frozen');
  end if;
  return true;
end $$;

create or replace function set_wager(p_text text) returns boolean language plpgsql security definer set search_path = public as $$
begin
  update duo_quests set wager_a = p_text where user_a = auth.uid() and status = 'active';
  update duo_quests set wager_b = p_text where user_b = auth.uid() and status = 'active';
  return found;
end $$;

create table if not exists crew_awards (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references crews(id) on delete cascade,
  week_start date not null,
  user_id uuid not null references profiles(id) on delete cascade,
  award text not null,
  blurb text,
  unique (crew_id, week_start, award)
);
alter table crew_awards enable row level security;
create policy "awards read" on crew_awards for select to authenticated
  using (exists (select 1 from crew_members m where m.crew_id = crew_awards.crew_id and m.user_id = auth.uid()));

-- Lockdown: only the RPCs the app calls are executable by signed-in users; policy helpers must stay callable.
revoke all on function resolve_pinky(uuid, boolean), set_wager(text), pinky_quota_ok() from public, anon;
grant execute on function resolve_pinky(uuid, boolean), set_wager(text), pinky_quota_ok() to authenticated;
grant execute on function are_friends(uuid, uuid), same_league(uuid, uuid), same_crew(uuid, uuid) to authenticated;
