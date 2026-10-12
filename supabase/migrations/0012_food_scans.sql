-- Fuel · photo meal counting. One row per scan, used for the daily limit in the food_vision edge
-- function and for cost tracking. Photos are never stored; only the totals the model returned.
create table if not exists public.food_scans (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  kcal int not null default 0,
  item_count int not null default 0,
  confidence text not null default 'low' check (confidence in ('low', 'medium', 'high'))
);
create index if not exists food_scans_user_day on public.food_scans (user_id, created_at desc);

alter table public.food_scans enable row level security;
-- people can see their own scan history; only the edge function (service role) writes
drop policy if exists food_scans_own on public.food_scans;
create policy food_scans_own on public.food_scans for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.food_scans from anon, authenticated;
