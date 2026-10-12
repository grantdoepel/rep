# uvu — you vs. you

Keep your Rep. A Duolingo-style fitness habit game: five minutes a day, a streak worth protecting, friends who notice.

Next.js 16 PWA · Tailwind 4 · Supabase (Postgres, Auth, Edge Functions, pg_cron) · Vercel.

## Run it

```bash
npm i
npm run dev        # http://localhost:3000
```

With no env vars the app runs **local-first**: every screen works, state lives in `localStorage`. Add Supabase keys to sync.

## Backend (Supabase)

1. Create a project (US East recommended).
2. Apply migrations in order from `supabase/migrations/` (SQL editor or `supabase db push`):
   - `0001_schema.sql` tables, RLS, `complete_set` / `send_nudge` / `use_freeze` RPCs, new-user trigger
   - `0002_seed.sql` 61 movements + 30 crown levels (generated: `npx tsx scripts/gen-seed.ts`)
   - `0003_jobs.sql` `close_day` (hourly) and `close_week` (Monday) via pg_cron
3. Deploy edge functions: `supabase functions deploy complete_set` and `notify`.
4. Set secrets for `notify`: `JOB_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`.
5. Enable Apple + Google providers in Auth, set redirect to `https://<your-domain>/auth/callback`.
6. Copy `.env.example` → `.env.local` and fill `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

## iOS app

`ios/` is a Capacitor shell around the deployed app (Apple Health, camera, push). `npm run ios` opens it in Xcode. Full steps: [docs/APP_STORE.md](docs/APP_STORE.md).

## Fuel (fasting + meals)

`src/lib/fasting.ts` builds fasting plans from stats and the training week inside fixed safety rails. Meal photos go to the `food_vision` edge function (secret `ANTHROPIC_API_KEY`; migration `0012_food_scans.sql`). Screens: `/fast`, `/fast/setup`, `/fast/meal`.

## Rules live in one place

`src/lib/rules.ts` is the game: Set generator, XP, crown clears, streaks and freezes, adaptive targets, league normalization, mascot lines. `complete_set()` in `0001_schema.sql` mirrors the scoring so the server never trusts client XP.

## Layout

```
src/app            screens (Home, Set, Done, Tree, League, Friends, Profile, Start, Rest days, Monday, Live, Crew)
src/lib/content.ts movement catalog + crown levels (single source of truth, seeds the DB)
src/lib/rules.ts   game rules, pure functions
src/lib/store.tsx  local-first state + Supabase sync
supabase/          migrations, edge functions
```
