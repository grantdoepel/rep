// PRD 2 · The Evening. When the day is slipping, the app changes shape.
// rescueAt ("HH:MM" local) is when the evening layout takes over. Client-side it's learned from when you
// usually start a Set; the server computes the same thing nightly from sets.started_at (0007_evening.sql).

export const RESCUE_DEFAULT = "21:00";
export const RESCUE_MIN = 18 * 60;          // 18:00
export const RESCUE_MAX = 22 * 60 + 30;     // 22:30
export const RESCUE_LEAD_MIN = 40;          // minutes before your usual start
export const RESCUE_MIN_POINTS = 7;         // fewer data points → default
export const RESCUE_WINDOW = 14;            // last N Set starts
export const SET_STARTS_KEY = "uvu.setStarts";
export const SET_STARTS_CAP = 30;
const SHOWN_KEY = "uvu.rescueShown";

export function toMinutes(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm ?? "");
  if (!m) return toMinutes(RESCUE_DEFAULT);
  return Math.min(24 * 60 - 1, Math.max(0, Number(m[1]) * 60 + Number(m[2])));
}
export function fromMinutes(mins: number): string {
  const m = Math.round(mins);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
export function localHHMM(d: Date): string { return fromMinutes(d.getHours() * 60 + d.getMinutes()); }

/** Median of the last 14 Set start times minus 40 minutes, clamped 18:00–22:30. "21:00" under 7 data points. */
export function computeRescueAt(startTimes: string[]): string {
  const recent = startTimes.slice(-RESCUE_WINDOW).map(toMinutes).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (recent.length < RESCUE_MIN_POINTS) return RESCUE_DEFAULT;
  const mid = Math.floor(recent.length / 2);
  const median = recent.length % 2 ? recent[mid] : (recent[mid - 1] + recent[mid]) / 2;
  return fromMinutes(Math.min(RESCUE_MAX, Math.max(RESCUE_MIN, median - RESCUE_LEAD_MIN)));
}

export function readSetStarts(): string[] {
  try { const raw = localStorage.getItem(SET_STARTS_KEY); const arr = raw ? JSON.parse(raw) : []; return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : []; } catch { return []; }
}
/** Append the local start time of a Set (cap 30). Home calls this when a Set starts. */
export function recordSetStart(now: Date): string[] {
  const next = [...readSetStarts(), localHHMM(now)].slice(-SET_STARTS_CAP);
  try { localStorage.setItem(SET_STARTS_KEY, JSON.stringify(next)); } catch {}
  return next;
}

export function minutesUntilMidnight(now: Date): number {
  return 24 * 60 - (now.getHours() * 60 + now.getMinutes());
}
/** "2h 40m" / "40m" / "1h" */
export function formatLeft(mins: number): string {
  const h = Math.floor(mins / 60), m = mins % 60;
  if (h <= 0) return `${Math.max(1, m)}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function isEvening(now: Date, rescueAt: string | undefined): boolean {
  return now.getHours() * 60 + now.getMinutes() >= toMinutes(rescueAt ?? RESCUE_DEFAULT);
}
/** Rescue Set (3 min) instead of the full Set once the evening is an hour old. */
export function isRescueHour(now: Date, rescueAt: string | undefined): boolean {
  return now.getHours() * 60 + now.getMinutes() >= toMinutes(rescueAt ?? RESCUE_DEFAULT) + 60;
}

/** True the first time the evening layout is shown on a given day (localStorage guard for `rescue_shown`). */
export function markRescueShown(today: string): boolean {
  try { if (localStorage.getItem(SHOWN_KEY) === today) return false; localStorage.setItem(SHOWN_KEY, today); return true; } catch { return false; }
}
