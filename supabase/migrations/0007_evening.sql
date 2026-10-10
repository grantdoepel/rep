-- PRD 2 · The Evening.
-- 1. compute_rescue_at(): nightly, per user, the median local start time of the last 14 done Sets minus 40 minutes,
--    clamped 18:00–22:30; 21:00 when there are fewer than 7 Sets. Mirrors src/lib/evening.ts computeRescueAt.
-- 2. The evening push runs every 10 minutes and fires for users whose local clock just crossed rescue_at
--    (the window test lives in the notify edge function).

create or replace function compute_rescue_at() returns integer language plpgsql security definer set search_path = public as $$
declare n integer := 0;
begin
  with recent as (
    select s.user_id, s.started_at, p.timezone,
           row_number() over (partition by s.user_id order by s.started_at desc) as rn
    from sets s
    join profiles p on p.id = s.user_id
    where s.status = 'done' and s.started_at is not null and s.kind <> 'placement'
  ),
  med as (
    select user_id, count(*) as cnt,
           percentile_cont(0.5) within group (order by extract(epoch from (started_at at time zone timezone)::time)) as med_secs
    from recent
    where rn <= 14
    group by user_id
  ),
  calc as (
    select user_id,
           case when cnt < 7 then time '21:00'
                else least(time '22:30', greatest(time '18:00', (make_interval(secs => med_secs) - interval '40 minutes')::time))
           end as rescue
    from med
  )
  update profiles p set rescue_at = c.rescue
  from calc c
  where c.user_id = p.id and p.rescue_at is distinct from c.rescue;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function compute_rescue_at() from public, anon, authenticated;

-- nightly at 03:00 UTC
select cron.unschedule('rep_rescue_at') where exists (select 1 from cron.job where jobname = 'rep_rescue_at');
select cron.schedule('rep_rescue_at', '0 3 * * *', $$select compute_rescue_at()$$);

-- the evening push: hourly → every 10 minutes, so each user is caught within [rescue_at, rescue_at + 10min)
select cron.unschedule('rep_evening') where exists (select 1 from cron.job where jobname = 'rep_evening');
select cron.unschedule('rep_evening10') where exists (select 1 from cron.job where jobname = 'rep_evening10');
select cron.schedule('rep_evening10', '*/10 * * * *', $$select notify_call('{"kind":"evening"}'::jsonb)$$);
