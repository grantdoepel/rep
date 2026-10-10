// PRD 1 · The Promise. One number: how many days a week you said you'd move.
// Pure helpers over the local log; the store persists the result through patchProfile.
import type { DayLog, Profile } from "./types";
import { addDays, dayOfWeek, weekStart } from "./rules";

export const PROMISE_DEFAULT = 4;
export const PROMISE_MIN = 3;
export const PROMISE_MAX = 7;
/** Day kinds that count toward the promise. A moved day (credited from outside) counts too. */
export const KEPT_KINDS: DayLog["kind"][] = ["perfect", "done", "rest", "moved"];

export function promiseDays(p: Pick<Profile, "promiseDays">): number {
  const n = Math.round(p.promiseDays ?? PROMISE_DEFAULT);
  return Math.min(PROMISE_MAX, Math.max(PROMISE_MIN, Number.isFinite(n) ? n : PROMISE_DEFAULT));
}

/** Days kept in the Mon–Sun week starting at `ws`. One per date, kinds in KEPT_KINDS. */
export function keptDays(log: DayLog[], ws: string): number {
  const end = addDays(ws, 6);
  const dates = new Set<string>();
  for (const l of log) if (l.date >= ws && l.date <= end && KEPT_KINDS.includes(l.kind)) dates.add(l.date);
  return dates.size;
}

export interface PromiseState {
  P: number;            // promised days
  K: number;            // kept so far this week
  N: number;            // week number (weeks kept + 1)
  weekStart: string;
  remaining: number;    // days still available this week (today counts if not yet kept)
  kept: boolean;        // K >= P
  atRisk: boolean;      // remaining < P − K
  headline: string;     // the Home display line
}

export function promiseState(log: DayLog[], profile: Pick<Profile, "promiseDays" | "promiseWeeksKept">, today: string): PromiseState {
  const P = promiseDays(profile);
  const ws = weekStart(today);
  const K = keptDays(log, ws);
  const N = (profile.promiseWeeksKept ?? 0) + 1;
  const idx = (dayOfWeek(today) + 6) % 7;   // Mon=0 … Sun=6
  const todayKept = log.some((l) => l.date === today && KEPT_KINDS.includes(l.kind));
  const remaining = 6 - idx + (todayKept ? 0 : 1);
  const kept = K >= P;
  const atRisk = !kept && remaining < P - K;
  const headline = kept ? `Week ${N} kept` : atRisk ? "Promise at risk" : `Week ${N} · ${K} of ${P} kept`;
  return { P, K, N, weekStart: ws, remaining, kept, atRisk, headline };
}

export interface WeekReview {
  weekStart: string;    // the Mon of the week reviewed (last week)
  weekNo: number;       // the number of that week
  P: number;            // the target that week (shrunk for a partial first week)
  K: number;
  kept: boolean;
  patch?: Pick<Profile, "promiseWeeksKept" | "promiseWeekStart">;   // what to persist; absent if already rolled
}

/**
 * Monday rollover. Reviews the week that just ended; returns the profile patch to persist (once per week).
 * A first week that started mid-week is judged against the days that were actually available.
 */
export function reviewLastWeek(log: DayLog[], profile: Pick<Profile, "promiseDays" | "promiseWeeksKept" | "promiseWeekStart" | "createdAt">, today: string): WeekReview {
  const thisWs = weekStart(today);
  const lastWs = addDays(thisWs, -7);
  const lastEnd = addDays(lastWs, 6);
  const fullP = promiseDays(profile);
  const created = (profile.createdAt || "").slice(0, 10);
  const available = created && created > lastWs ? Math.max(1, 7 - ((dayOfWeek(created) + 6) % 7)) : 7;
  const P = Math.min(fullP, available);
  const K = keptDays(log, lastWs);
  const kept = K >= P;
  const already = profile.promiseWeekStart === thisWs;
  const weeksKept = profile.promiseWeeksKept ?? 0;
  // weekNo: the week just reviewed. If already rolled, the stored count includes it when kept.
  const weekNo = already ? (kept ? Math.max(1, weeksKept) : weeksKept + 1) : weeksKept + 1;
  const nothingToReview = created && created > lastEnd;   // onboarded this week; no last week to judge
  const patch = already || nothingToReview ? undefined : { promiseWeeksKept: kept ? weeksKept + 1 : 0, promiseWeekStart: thisWs };
  return { weekStart: lastWs, weekNo, P, K, kept, patch };
}
