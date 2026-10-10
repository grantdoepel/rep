# Shared brief for the eight-bets feature builds

You are building one feature of the uvu app (Duolingo-style 3-minute daily movement habit app, "you vs. you").
Repo: Next.js 16 app router, React 19, Tailwind 4, PWA; local-first store in localStorage key `rep.v1` with
Supabase sync when signed in (`s.online`). Read `AGENTS.md` first: this Next.js version differs from training data.

## Setup in your worktree
- `ln -s /home/claude/rep/node_modules node_modules && cp /home/claude/rep/.env.local .env.local`
- Typecheck: `npx tsc --noEmit -p . 2>&1 | grep -v .next/types`. Build: `npx next build`.
- QA: start `npx next dev -p <your port>` in a separate Bash call (nohup … &), then screenshot at 375×812 with
  Playwright (`node_modules/playwright`, `chromium.launch({ executablePath: "/opt/pw-browsers/chromium" })`).
  Put scripts in your worktree root as `.qa-*.mjs` and delete them before committing. Seed state by setting
  `localStorage["rep.v1"]` in `page.addInitScript` (a JSON State with `onboarded: true, hydrated: false`).
- Commit on your own branch `feat/<name>` (git checkout -b). Do NOT push. Do NOT apply migrations to Supabase
  (write the SQL file only; the integrator applies it). Do NOT touch files outside your ownership list, except
  `src/lib/types.ts` (add-only, keep existing fields) and your own new files.
- Attribution lines at the end of commit messages:
  `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and
  `Claude-Session: https://claude.ai/code/session_01Q5H2uXrtwmp9TtoC8A4NvV`.

## Design system ("The Ledger") — use it, don't invent
- Colors: Night `#0C0D11` ground (`bg-ink`), surfaces `bg-ink-3` / `bg-ink-4`, text Bone `text-text` / `text-text-2`,
  greys `text-muted` (#A0A6B4) / `text-muted-2`, Lime `bg-lime` / `text-lime` (#C8FF3D) the ONLY accent,
  Coral `bg-coral` / `text-coral` (#FF6B4A) ONLY for streak/promise-at-risk and the mascot, Blue `bg-blue` for the duo partner.
- Type: `.display` + `.t-hero/.t-h1/.t-h2/.t-h3` (Outfit 800), `.t-num` (tabular numerals), `.t-body/.t-small/.t-micro`
  (DM Sans; `.t-micro` is the uppercase eyebrow).
- Motion: `.press` on tappables, `.a-rise`, `.a-grow`, `.a-blink`, `.a-bob`; reduced-motion is handled in CSS.
- Components in `src/components/ui.tsx`: `Section({title,right,children,className})`, `Surface`, `Button`,
  `Avatar({initials,color,fg,size})`, `Icon.*`, `Ring({value,size,width,color,children})`, `Pulse`, `TopBar({title,back,right})`,
  `Mascot({line,mood})`, `Confetti`, `CountUp`, `haptic()`, `useMounted()`. Mascot SVG: `Vee` in `src/components/Vee.tsx`
  (`size`, `mood: neutral|happy|proud|worried|sleepy|sweaty`, `bob`).
- Tap targets ≥ 44px; everything works at 375px wide; no red; no new fonts; no emoji in UI copy.
- Copy voice: short, specific, second person, no exclamation marks, no shame. "Three minutes" not "workout".

## Store API (`src/lib/store.tsx`)
- `const s = useStore()`; state fields: `profile`, `streak`, `log: DayLog[]` (kinds perfect|done|rest|missed|frozen|moved),
  `today`, `active`, `lastDone`, `recent` (last number per movement), `ledger: LedgerRow[]` (server move_daily, pulled when online),
  `friends`, `crew?`, `plan?`, `online`, `userId`, `inviteCode`, `toast`, plus feature slots `notePlayedOn`, `testSkippedOn`, `lastHealthCheck`.
- Actions: `startSet(kind?, via?)`, `recordMove`, `finishSet`, `useFreeze`, `nudge(id)`, `updateProfile(p)` (core profile),
  `patchProfile(p)` (the extras: promiseDays, promiseWeeksKept, promiseWeekStart, rescueAt "HH:MM", anchor, homeLat/Lng,
  noteRecordedAt, noteText, birthYear, sex, healthConnected — synced to Supabase via `patch_profile`),
  `patch(fn)` (generic partial state update for your slots), `markMondaySeen`, `refresh()` (re-pull from server).
- Analytics: `import { track } from "@/lib/analytics"; track("event_name", {props})`.
- Supabase client: `import { supabase } from "@/lib/supabase"` (returns client or null). RPCs via `sb.rpc(name, args)`.
- Dates: `localDate(new Date(), s.profile.timezone)` → "YYYY-MM-DD"; `weekStart`, `addDays`, `dayOfWeek` in `src/lib/rules.ts`.
  Never call `new Date()` during render of a prerendered client component without a mounted guard (`useMounted()` or state set in useEffect).

## Server conventions
- Migrations in `supabase/migrations/NNNN_<name>.sql` (your number is assigned). RLS on every table; writes through
  SECURITY DEFINER RPCs with `set search_path = public`; `grant execute … to authenticated; revoke … from anon`.
  Helper functions used inside RLS policies need EXECUTE granted to authenticated (see 0004's `rep_policy_helper_grants`).
- Existing: `profiles`, `streaks`, `sets` (moves jsonb), `day_log`, `move_daily` (ledger), `events` + `track_event`,
  `friendships`, `nudges` (+ trigger `nudge_push` → edge fn `notify`), `crews(id,name,captain_id,weekly_goal_per_member,invite_code)`,
  `crew_members(crew_id,user_id)`, `push_subscriptions`, `notify_call(jsonb)` posts to the notify edge function.
- Edge function `supabase/functions/notify/index.ts` handles kinds `nudge` and `evening`.

## Slot components (already wired; fill the one(s) you own, keep the export name and signature loose)
`src/components/bets/`: CrewCard (Home, props {daysLeft}), CrewDoneLine (Done), NoteOffer (Done, {perfect}),
NotePlayback (not yet wired; the Evening feature renders it), NoteSettings, TestSetCard (Home, {today}), TestResult (Done),
TestSettings, MovedNote (Home, {today}), HealthSettings, AnchorSettings (Settings), PlanBadge (Home).
Settings page is `src/app/rest-days/page.tsx`; slots render between "Gym arrival reminder" and "Account".

## Definition of done
Typecheck and build clean; the feature QA'd with screenshots at 375px in the states the PRD names; events tracked;
a short final report: branch name, files touched, migration file (if any), what works, what is stubbed, screenshots paths.
