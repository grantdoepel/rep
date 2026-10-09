-- Nightly and weekly jobs run in SQL via pg_cron so they need no external scheduler.

-- close_day: for every user whose local time just passed midnight, evaluate yesterday.
-- Runs hourly; each user is processed once per local day.
create table if not exists job_runs (user_id uuid, job text, run_for date, primary key (user_id, job, run_for));

create or replace function close_day() returns integer language plpgsql security definer set search_path = public as $$
declare p record; st streaks%rowtype; yday date; n int := 0;
begin
  for p in select id, timezone from profiles loop
    yday := (now() at time zone p.timezone)::date - 1;
    if exists (select 1 from job_runs where user_id = p.id and job = 'close_day' and run_for = yday) then continue; end if;
    if extract(hour from (now() at time zone p.timezone)) < 0 then continue; end if; -- always true past midnight; kept for clarity
    select * into st from streaks where user_id = p.id for update;
    if st.last_counted_date is not null and st.last_counted_date < yday then
      if st.freezes > 0 then
        update streaks set freezes = freezes - 1, last_counted_date = yday where user_id = p.id;
        insert into day_log (user_id, date, kind) values (p.id, yday, 'frozen') on conflict do nothing;
      else
        update streaks set current = 0 where user_id = p.id;
        insert into day_log (user_id, date, kind) values (p.id, yday, 'missed') on conflict do nothing;
      end if;
    end if;
    -- monthly freeze refill
    if st.freezes_reset_on < date_trunc('month', now())::date then update streaks set freezes = 2, freezes_reset_on = date_trunc('month', now())::date where user_id = p.id; end if;
    -- mark expired planned sets
    update sets set status = 'planned' where user_id = p.id and date < yday and status = 'active';
    insert into job_runs values (p.id, 'close_day', yday);
    n := n + 1;
  end loop;
  return n;
end $$;

-- close_week: Monday 00:00 UTC. Rank leagues, promote/demote, settle Duo Quests, seed new leagues.
create or replace function close_week() returns integer language plpgsql security definer set search_path = public as $$
declare prev date := (select max(week_start) from leagues); nxt date := date_trunc('week', now())::date; l record; m record; i int; sz int; n int := 0;
  tiers league_tier_t[] := array['bronze','silver','gold','sapphire','diamond']; newtier league_tier_t; pending record; lid uuid; cnt int;
begin
  if prev = nxt then return 0; end if;
  -- 1. rank and mark outcomes
  if prev is not null then
    for l in select * from leagues where week_start = prev loop
      i := 0; sz := (select count(*) from league_members where league_id = l.id);
      for m in select * from league_members where league_id = l.id order by xp_normalized desc, xp desc loop
        i := i + 1;
        update league_members set rank = i, outcome = case when i <= 7 and l.tier <> 'diamond' then 'promoted' when i > sz - 5 and l.tier <> 'bronze' then 'demoted' else 'held' end where league_id = l.id and user_id = m.user_id;
      end loop;
    end loop;
    -- duo quests
    update duo_quests set status = case when xp_a + xp_b >= target_xp then 'cleared' else 'failed' end where week_start = prev and status = 'active';
    update profiles pr set gems = gems + 200 from duo_quests d where d.week_start = prev and d.status = 'cleared' and pr.id in (d.user_a, d.user_b);
    insert into gem_ledger (user_id, delta, reason) select user_a, 200, 'duo_quest' from duo_quests where week_start = prev and status = 'cleared'
      union all select user_b, 200, 'duo_quest' from duo_quests where week_start = prev and status = 'cleared';
  end if;
  -- 2. seed new leagues: each active user goes to a tier based on last outcome (default bronze), cohorts of 30
  for pending in
    select pr.id as user_id,
      coalesce((select case lm.outcome when 'promoted' then tiers[array_position(tiers, l.tier) + 1] when 'demoted' then tiers[array_position(tiers, l.tier) - 1] else l.tier end
                from league_members lm join leagues l on l.id = lm.league_id where lm.user_id = pr.id and l.week_start = prev), 'bronze') as tier
    from profiles pr where exists (select 1 from sets s where s.user_id = pr.id and s.status = 'done' and s.date >= nxt - 14)
    order by 2, random()
  loop
    newtier := pending.tier;
    select id, (select count(*) from league_members where league_id = leagues.id) into lid, cnt from leagues where week_start = nxt and tier = newtier order by created_at desc limit 1;
    if lid is null or cnt >= 30 then insert into leagues (week_start, tier) values (nxt, newtier) returning id into lid; end if;
    insert into league_members (league_id, user_id) values (lid, pending.user_id) on conflict do nothing;
    n := n + 1;
  end loop;
  return n;
end $$;

-- generate_set: nightly planned Set per user for their local tomorrow is done client-side from the same rules;
-- server keeps the record when the client reports it. (Placeholder so the cron job list is complete.)

select cron.schedule('rep_close_day', '5 * * * *', $$select close_day()$$);
select cron.schedule('rep_close_week', '0 0 * * 1', $$select close_week()$$);

-- RLS policies call these SECURITY DEFINER helpers; the calling role must be able to execute them
-- (the lockdown revoke-from-public above would otherwise 403 every profile/set write).
grant execute on function public.are_friends(uuid, uuid) to authenticated;
grant execute on function public.same_league(uuid, uuid) to authenticated;
grant execute on function public.same_crew(uuid, uuid) to authenticated;
