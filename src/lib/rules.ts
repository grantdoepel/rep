import { CROWN_LEVELS, GOAL_MINUTES, MOVEMENT_BY_ID, TIER_SCALE, TRACKS, crownLevel } from "./content";
import type { Crowns, DailySet, Environment, Flag, GoalTier, Profile, SetMove, Streak, Tier, Track } from "./types";

// ---------- dates ----------
export function localDate(d = new Date(), tz?: string): string {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
  return f.format(d); // YYYY-MM-DD
}
export function addDays(date: string, n: number): string {
  const d = new Date(date + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}
export function dayOfWeek(date: string): number { return new Date(date + "T12:00:00Z").getUTCDay(); }
export function weekStart(date: string): string { const dow = dayOfWeek(date); return addDays(date, -((dow + 6) % 7)); } // Monday

// ---------- XP ----------
export const XP = { perMove: 10, firstSetMultiplier: 2, crownUpMultiplier: 1.5, perfectBonus: 25, nudge: 5, streakSave: 25 };

export function scoreSet(moves: SetMove[], opts: { firstOfDay: boolean; crownUp: boolean; rescue?: boolean }): { xp: number; perfect: boolean } {
  const completed = moves.filter((m) => (m.achieved ?? 0) > 0).length;
  const perfect = moves.length > 0 && moves.every((m) => (m.achieved ?? 0) >= m.target);
  let xp = completed * XP.perMove;
  if (opts.firstOfDay) xp *= XP.firstSetMultiplier;
  if (opts.crownUp) xp = Math.round(xp * XP.crownUpMultiplier);
  if (perfect) xp += XP.perfectBonus;
  if (opts.rescue) xp = Math.round(xp * 0.5);
  return { xp, perfect };
}

// ---------- adaptive targets ----------
// Two misses on a track in a row → the next Set uses the regression (or 80% target), and a note.
export function adaptMove(move: SetMove, misses: number, env: Environment): { move: SetMove; adapted: boolean; note?: string } {
  if (misses < 2) return { move, adapted: false };
  const mv = MOVEMENT_BY_ID[move.movement];
  const reg = mv?.regression ? MOVEMENT_BY_ID[mv.regression] : undefined;
  if (reg && reg.env.includes(env)) {
    return { move: { movement: reg.id, target: Math.round(move.target * 1.25), unit: reg.unit }, adapted: true, note: `Two days short on ${mv.name}. Swapped to ${reg.name}; it steps back up after 3 clean days.` };
  }
  return { move: { ...move, target: Math.max(1, Math.round(move.target * 0.8)) }, adapted: true, note: `Two days short on ${mv?.name}. Target lowered; it steps back up after 3 clean days.` };
}

// ---------- Set generator ----------
function filterByProfile(ids: string[], flags: Flag[], env: Environment): string[] {
  return ids.filter((id) => { const mv = MOVEMENT_BY_ID[id]; if (!mv) return false; if (!mv.env.includes(env)) return false; if (flags.includes("seated") && !mv.seated) return false; return !mv.flags.some((f) => flags.includes(f)); });
}

export function generateSet(p: Pick<Profile, "goalTier" | "environment" | "tier" | "restDays" | "injuryFlags" | "accessibility">, crowns: Crowns, date: string, yesterdayTracks: Track[] = [], opts: { rescue?: boolean; placement?: boolean } = {}): DailySet {
  const flags = [...p.injuryFlags, ...p.accessibility];
  const isRest = p.restDays.includes(dayOfWeek(date));
  const minutes = opts.rescue ? 3 : isRest ? 3 : GOAL_MINUTES[p.goalTier];
  const scale = TIER_SCALE[p.tier];

  if (opts.placement) {
    const moves: SetMove[] = [{ movement: "knee_pushup", target: 8, unit: "reps" }, { movement: "bodyweight_squat", target: 12, unit: "reps" }, { movement: "plank", target: 20, unit: "seconds" }];
    return { id: `set_${date}_placement`, date, tracks: ["push", "legs", "core"], moves, plannedMinutes: 3, kind: "placement", status: "planned" };
  }

  if (isRest || opts.rescue) {
    const lvl = crownLevel("mobility", crowns.mobility?.level ?? 1);
    const avail = filterByProfile(lvl.requirements.map((r) => r.movement), flags, p.environment);
    const moves: SetMove[] = (avail.length ? lvl.requirements.filter((r) => avail.includes(r.movement)) : [{ movement: "neck_rolls", target: 6 }, { movement: "hip_hinge", target: 10 }, { movement: "wall_reach", target: 8 }])
      .slice(0, 3).map((r) => ({ movement: r.movement, target: Math.round(r.target * scale), unit: MOVEMENT_BY_ID[r.movement].unit }));
    return { id: `set_${date}`, date, tracks: ["mobility"], moves, plannedMinutes: 3, kind: opts.rescue ? "rescue" : "rest", status: "planned" };
  }

  // Pick 2 tracks (3 for serious): furthest from next crown, not yesterday's, mobility only as a filler.
  const candidates = TRACKS.map((t) => t.id).filter((t) => t !== "mobility" && !yesterdayTracks.includes(t));
  const ranked = candidates.sort((a, b) => ((crowns[a]?.clears ?? 0) - (crowns[b]?.clears ?? 0)) || ((crowns[a]?.level ?? 1) - (crowns[b]?.level ?? 1)));
  const tracks = ranked.slice(0, p.goalTier === "serious" ? 3 : 2) as Track[];
  const moves: SetMove[] = [];
  for (const t of tracks) {
    const lvl = crownLevel(t, crowns[t]?.level ?? 1);
    const reqs = p.environment === "gym" ? lvl.gym : lvl.requirements;
    const avail = filterByProfile(reqs.map((r) => r.movement), flags, p.environment);
    for (const r of reqs) {
      if (!avail.includes(r.movement)) continue;
      const base: SetMove = { movement: r.movement, target: Math.max(1, Math.round(r.target * scale)), unit: MOVEMENT_BY_ID[r.movement].unit };
      moves.push(adaptMove(base, crowns[t]?.misses ?? 0, p.environment).move);
    }
  }
  const cap = p.goalTier === "casual" ? 3 : p.goalTier === "regular" ? 4 : 6;
  return { id: `set_${date}`, date, tracks, moves: moves.slice(0, cap), plannedMinutes: minutes, kind: "normal", status: "planned" };
}

// ---------- crowns ----------
// A level clears when every requirement target is hit in 3 separate Sets on different days.
export function applyCrownProgress(crowns: Crowns, set: DailySet, env: Environment): { crowns: Crowns; crownUps: Track[] } {
  const next: Crowns = JSON.parse(JSON.stringify(crowns));
  const crownUps: Track[] = [];
  for (const t of set.tracks) {
    if (t === "mobility" && set.kind !== "rest" && set.kind !== "rescue") continue;
    const c = next[t] ?? (next[t] = { level: 1, clears: 0, misses: 0 });
    const lvl = crownLevel(t, c.level);
    const reqs = env === "gym" ? lvl.gym : lvl.requirements;
    const relevant = set.moves.filter((m) => reqs.some((r) => r.movement === m.movement));
    if (relevant.length === 0) continue;
    const hit = relevant.every((m) => (m.achieved ?? 0) >= m.target);
    if (hit) {
      c.misses = 0;
      if (c.lastClearDate !== set.date) { c.clears += 1; c.lastClearDate = set.date; }
      if (c.clears >= 3 && c.level < 5) { c.level += 1; c.clears = 0; crownUps.push(t); }
    } else {
      c.misses += 1;
    }
  }
  return { crowns: next, crownUps };
}

// ---------- streaks ----------
export function countDay(streak: Streak, date: string): Streak {
  if (streak.lastCountedDate === date) return streak;
  const consecutive = streak.lastCountedDate === addDays(date, -1);
  const current = consecutive || !streak.lastCountedDate ? streak.current + 1 : 1;
  return { ...streak, current, longest: Math.max(streak.longest, current), lastCountedDate: date };
}
// Nightly: if yesterday wasn't counted, spend a freeze or reset.
export function closeDay(streak: Streak, yesterday: string): { streak: Streak; froze: boolean; broke: boolean } {
  if (streak.lastCountedDate === yesterday || !streak.lastCountedDate) return { streak, froze: false, broke: false };
  if (streak.lastCountedDate === addDays(yesterday, -1) || streak.lastCountedDate > yesterday) return { streak, froze: false, broke: false };
  if (streak.freezes > 0) return { streak: { ...streak, freezes: streak.freezes - 1, lastCountedDate: yesterday }, froze: true, broke: false };
  return { streak: { ...streak, current: 0, lastCountedDate: undefined }, froze: false, broke: true };
}

// ---------- leagues ----------
// XP per planned minute of the user's goal tier, so Casual and Serious compete fairly.
export function normalizedXp(xp: number, goalTier: GoalTier): number { return Math.round(xp / GOAL_MINUTES[goalTier] * 10); }
export const PROMOTE_TOP = 7, DEMOTE_BOTTOM = 5, LEAGUE_SIZE = 30;

// ---------- mascot ----------
export function mascotLine(ctx: { hour: number; doneToday: boolean; streak: number; atRiskFriend?: string; aheadFriend?: { name: string; by: number }; restDay?: boolean; whyText?: string; dayMilestone?: number }): string {
  if (ctx.dayMilestone === 30 && ctx.whyText) return `A month ago you wrote: "${ctx.whyText}". Thirty days. I'm not going to make this a whole thing.`;
  if (ctx.restDay) return "Rest day. I mean it. Three minutes of stretching and then go sit down. You earned the sitting.";
  if (ctx.doneToday && ctx.atRiskFriend) return `You're done. ${ctx.atRiskFriend} isn't. Their streak ends at midnight. Just saying.`;
  if (ctx.doneToday) return "Done. Nothing else to do here. Go live your life.";
  if (ctx.hour >= 21) return `${ctx.streak} days. Three minutes. I swapped today's Set for something you can do in socks.`;
  if (ctx.hour >= 19) return "It's getting late. Not late late. Late enough that I'm mentioning it.";
  if (ctx.aheadFriend) return `${ctx.aheadFriend.name} is ${ctx.aheadFriend.by} XP ahead of you and it's ${["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][new Date().getDay()]}. I'm just saying.`;
  if (ctx.streak === 0) return "Day one is the only day that's ever hard. Five minutes.";
  return "Today's Set is already picked. One tap. I'll wait.";
}

export function tierFromScore(pushups: number, squats: number, plankSec: number): Crowns {
  const lvl = (n: number, a: number, b: number, c: number) => (n >= c ? 3 : n >= b ? 2 : n >= a ? 1 : 1);
  const push = pushups >= 8 ? 3 : pushups >= 5 ? 2 : 1;
  const legs = lvl(squats, 0, 10, 15);
  const core = plankSec >= 30 ? 3 : plankSec >= 20 ? 2 : 1;
  const base = (level: number) => ({ level, clears: 0, misses: 0 });
  return { push: base(push), legs: base(legs), core: base(core), pull: base(1), cardio: base(1), mobility: base(1) };
}

export { CROWN_LEVELS };
export type { Tier };
