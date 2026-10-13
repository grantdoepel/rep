// Fuel · the fasting planner. Pure functions: a plan is generated from a person's stats and their training
// week, inside fixed safety rails. Nothing here touches the store or the network, so the rails are testable.
//
// The rails (the planner can never break these, whatever the goal date says):
//   - loss rate capped at 1% of body weight per week, and the daily deficit at 25% of that day's burn
//   - calories never below the person's resting burn (BMR), and never below 1,500 (men) / 1,200 (women)
//   - protein 1 g per lb of goal weight (capped at 200 g), every day
//   - eating window 8 to 12 hours; an overnight fast never longer than 16 hours
//   - an evening session never ends into a fast: the window closes at least 30 minutes after it
//   - no plan at all for under-18s, a goal under BMI 18.5, or anyone the screening questions flag
import { addDays, dayOfWeek } from "./rules";

export type Sex = "m" | "f";
export interface TrainingDay { am: boolean; pm: boolean }          // a morning session and/or an evening session
export interface FastingInputs {
  weightLb: number;
  heightIn: number;
  birthYear: number;
  sex: Sex;
  goalLb: number;
  goalDate: string;               // YYYY-MM-DD
  amTime: string;                 // "HH:MM" morning session start
  pmTime: string;                 // "HH:MM" evening session start
  pmMinutes: number;              // evening session length
  week: TrainingDay[];            // 0 = Sunday .. 6 = Saturday
  pmLabel: string;                // what the evening session is called ("Hyrox", "Run club")
  startedOn: string;              // YYYY-MM-DD the plan began
}
export type DayKind = "double" | "am" | "pm" | "rest";
export interface Meal { at: number; name: string; note: string; carb?: boolean }   // at: hours since midnight
export interface DayPlan { dow: number; kind: DayKind; start: number; end: number; kcal: number; burn: number; protein: number; meals: Meal[] }
export interface FastingPlan {
  days: DayPlan[];                // 0 = Sunday
  bmr: number;
  weeklyBurn: number;
  ratePerWeek: number;            // projected lb/week from the targets
  requestedRate: number;          // what the goal date asked for
  capped: boolean;                // the rails slowed the plan down
  projectedGoalDate: string;      // when the goal weight lands at the projected rate
  projectedAtGoalDate: number;    // weight on the requested goal date
  protein: number;
}
export interface Screening { pregnant: boolean; edHistory: boolean; diabetesMeds: boolean; underCare: boolean }
export type Refusal = { ok: false; reason: string };

export const KIND_LABEL: Record<DayKind, string> = { double: "Double day", am: "16:8", pm: "Evening session", rest: "Rest" };
const BASE_FACTOR = 1.35;         // everyday movement on top of resting burn
const AM_BURN = 300;              // a morning lift or class
const PM_BURN_PER_MIN = 9;        // conditioning (Hyrox, run club) per minute
const MAX_DEFICIT = 0.25;

export const hm = (s: string) => { const [h, m] = s.split(":").map(Number); return (h || 0) + (m || 0) / 60; };
const r50 = (n: number) => Math.round(n / 50) * 50;
const r5 = (n: number) => Math.round(n / 5) * 5;
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

export function bmrOf(i: Pick<FastingInputs, "weightLb" | "heightIn" | "birthYear" | "sex">, year: number): number {
  const kg = i.weightLb * 0.4536, cm = i.heightIn * 2.54, age = year - i.birthYear;
  return Math.round(10 * kg + 6.25 * cm - 5 * age + (i.sex === "m" ? 5 : -161));        // Mifflin-St Jeor
}

export function kindOf(d: TrainingDay): DayKind { return d.am && d.pm ? "double" : d.am ? "am" : d.pm ? "pm" : "rest"; }

/** The eating window for one day, before the overnight-fast check. */
function windowFor(kind: DayKind, i: FastingInputs): { start: number; end: number } {
  const am = hm(i.amTime), pmEnd = hm(i.pmTime) + i.pmMinutes / 60;
  switch (kind) {
    case "double": { const end = clamp(pmEnd + 0.5, 18, 22.5); return { start: clamp(Math.max(am + 4, end - 12), 8, end - 8), end }; }
    case "am": { const start = clamp(am + 5, 9, 14); return { start, end: start + 8 }; }
    case "pm": { const end = clamp(pmEnd + 0.5, 18, 22.5); return { start: end - 8, end }; }
    default: return { start: 12, end: 20 };
  }
}

function mealsFor(kind: DayKind, start: number, end: number, protein: number, i: FastingInputs): Meal[] {
  const p3 = r5(protein / 3), last = r5(protein - 2 * p3);
  if (kind === "double" || kind === "pm") {
    const pre = clamp(hm(i.pmTime) - 2, start + 2, end - 2);
    return [
      { at: start, name: "Break the fast", note: `${p3} g protein` },
      { at: pre, name: `Before ${i.pmLabel}`, note: "Carb-heavy", carb: true },
      { at: Math.max(end - 0.25, pre + 1), name: "Recovery", note: `${last} g protein` },
    ];
  }
  const mid = Math.round(((start + end) / 2) * 2) / 2;
  return [
    { at: start, name: kind === "am" ? "Post-lift meal" : "Break the fast", note: `${p3} g protein` },
    { at: mid, name: "Lunch", note: `${p3} g protein` },
    { at: end - 0.5, name: "Dinner", note: `${last} g protein` },
  ];
}

export function screen(s: Screening): Refusal | null {
  if (s.pregnant) return { ok: false, reason: "Fasting isn't recommended while pregnant or breastfeeding. Talk to your doctor about a plan that fits." };
  if (s.edHistory) return { ok: false, reason: "With a history of disordered eating, fasting windows can do more harm than good. A doctor or dietitian can help you build a plan that's safe for you." };
  if (s.diabetesMeds) return { ok: false, reason: "Fasting on insulin or blood-sugar medication can drop your blood sugar dangerously. Your doctor needs to set this up with you." };
  return null;
}

export function generatePlan(i: FastingInputs, today: string): FastingPlan | Refusal {
  const year = Number(today.slice(0, 4));
  if (year - i.birthYear < 18) return { ok: false, reason: "Fuel plans are for adults. Movement streaks are all yours." };
  const goalBmi = (703 * i.goalLb) / (i.heightIn * i.heightIn);
  if (goalBmi < 18.5) return { ok: false, reason: `That goal is under a healthy weight for your height. The lowest goal Fuel will plan for is ${Math.ceil((18.5 * i.heightIn * i.heightIn) / 703)} lb.` };
  if (i.goalLb >= i.weightLb) return { ok: false, reason: "Fuel plans are built for losing weight. Set a goal below your current weight." };

  const bmr = bmrOf(i, year);
  const floor = Math.max(bmr, i.sex === "m" ? 1500 : 1200);
  const protein = Math.min(200, r5(i.goalLb));
  const weeks = Math.max(1, (Date.parse(i.goalDate) - Date.parse(today)) / (7 * 864e5));
  const requestedRate = (i.weightLb - i.goalLb) / weeks;
  const rateCap = Math.min(requestedRate, i.weightLb * 0.01);
  const burns = i.week.map((d) => Math.round(bmr * BASE_FACTOR + (d.am ? AM_BURN : 0) + (d.pm ? PM_BURN_PER_MIN * i.pmMinutes : 0)));
  const weeklyBurn = burns.reduce((a, b) => a + b, 0);
  // one deficit percentage for every day: training days keep more food in absolute terms
  const pct = Math.min(MAX_DEFICIT, (rateCap * 3500) / weeklyBurn);

  let days: DayPlan[] = i.week.map((d, dow) => {
    const kind = kindOf(d);
    const w = windowFor(kind, i);
    const kcal = Math.max(r50(floor + 25), r50(burns[dow] * (1 - pct)));
    return { dow, kind, start: w.start, end: w.end, kcal, burn: burns[dow], protein, meals: [] };
  });
  // overnight fasts: never longer than 16 hours (pull the next morning's window earlier if needed)
  days = days.map((d, dow) => {
    const prev = days[(dow + 6) % 7];
    const overnight = 24 - prev.end + d.start;
    const start = overnight > 16 ? d.start - (overnight - 16) : d.start;
    return { ...d, start, meals: mealsFor(d.kind, start, d.end, protein, i) };
  });

  const ratePerWeek = Math.round((days.reduce((a, d) => a + (d.burn - d.kcal), 0) / 3500) * 100) / 100;
  const toGo = i.weightLb - i.goalLb;
  const projWeeks = ratePerWeek > 0 ? toGo / ratePerWeek : 52;
  return {
    days, bmr, weeklyBurn, ratePerWeek, requestedRate: Math.round(requestedRate * 100) / 100,
    capped: ratePerWeek + 0.05 < requestedRate, protein,
    projectedGoalDate: addDays(today, Math.ceil(projWeeks * 7)),
    projectedAtGoalDate: Math.round((i.weightLb - Math.min(toGo, ratePerWeek * weeks)) * 10) / 10,
  };
}

// ---------- the clock ----------
export type Phase = { state: "fast" | "eat" | "after"; fasted: number; fastLength: number; left: number; nextStart: number; day: DayPlan; prev: DayPlan; next: DayPlan };
export function phaseAt(plan: FastingPlan, now: Date): Phase {
  const dow = now.getDay(), day = plan.days[dow], prev = plan.days[(dow + 6) % 7], next = plan.days[(dow + 1) % 7];
  const h = now.getHours() + now.getMinutes() / 60;
  const fastLength = 24 - prev.end + day.start;
  if (h < day.start) return { state: "fast", fasted: 24 - prev.end + h, fastLength, left: day.start - h, nextStart: day.start, day, prev, next };
  if (h < day.end) return { state: "eat", fasted: fastLength, fastLength, left: day.end - h, nextStart: day.start, day, prev, next };
  return { state: "after", fasted: h - day.end, fastLength: 24 - day.end + next.start, left: 24 - h + next.start, nextStart: next.start, day, prev, next };
}

export const clock = (hrs: number) => { const m = Math.max(0, Math.round(hrs * 60)); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`; };
export const dur = (hrs: number) => { const m = Math.max(0, Math.round(hrs * 60)); return `${Math.floor(m / 60)}h ${m % 60}m`; };
export function hourLabel(h: number, withAp = true): string {
  const hh = Math.floor(h) % 24, mm = Math.round((h - Math.floor(h)) * 60);
  const ap = hh >= 12 ? "pm" : "am", h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}${mm ? ":" + String(mm).padStart(2, "0") : ""}${withAp ? " " + ap : ""}`;
}
export const windowLabel = (d: DayPlan) => {
  const a = hourLabel(d.start, false), b = hourLabel(d.end, false), apA = d.start >= 12 ? "pm" : "am", apB = d.end >= 12 ? "pm" : "am";
  return apA === apB ? `${a}–${b} ${apB}` : `${a} ${apA}–${b} ${apB}`;
};

// ---------- XP, streak, the you-vs-last-week league ----------
export interface FuelLog { fasts: string[]; protein: string[]; weights: Record<string, number> }
export const FAST_XP = 30, PROTEIN_XP = 10, WEIGH_XP = 10;
export const FUEL_TIERS: [string, number][] = [["Bronze", 0], ["Silver", 120], ["Gold", 220], ["Volt", 300]];
export function xpOn(log: FuelLog, date: string): number { return (log.fasts.includes(date) ? FAST_XP : 0) + (log.protein.includes(date) ? PROTEIN_XP : 0) + (log.weights[date] !== undefined ? WEIGH_XP : 0); }
export function weekXp(log: FuelLog, monday: string): number { let x = 0; for (let k = 0; k < 7; k++) x += xpOn(log, addDays(monday, k)); return x; }
export function totalXp(log: FuelLog): number { return [...new Set([...log.fasts, ...log.protein, ...Object.keys(log.weights)])].reduce((a, d) => a + xpOn(log, d), 0); }
export function fastStreak(log: FuelLog, today: string): number {
  let d = log.fasts.includes(today) ? today : addDays(today, -1), n = 0;
  while (log.fasts.includes(d)) { n++; d = addDays(d, -1); }
  return n;
}
export function tierOf(xp: number): number { let t = 0; FUEL_TIERS.forEach(([, min], k) => { if (xp >= min) t = k; }); return t; }

// ---------- weekly check-in ----------
export function targetOn(i: FastingInputs, plan: FastingPlan, date: string): number {
  const wks = (Date.parse(date) - Date.parse(i.startedOn)) / (7 * 864e5);
  return Math.max(i.goalLb, Math.round((i.weightLb - plan.ratePerWeek * Math.max(0, wks)) * 10) / 10);
}
export function checkIn(log: FuelLog, i: FastingInputs, plan: FastingPlan, today: string): { avg?: number; rate?: number; count: number; line: string } {
  const keys = Object.keys(log.weights).filter((k) => k <= today).sort();
  const last7 = keys.filter((k) => k > addDays(today, -7)), prev7 = keys.filter((k) => k <= addDays(today, -7) && k > addDays(today, -14));
  const mean = (ks: string[]) => ks.reduce((a, k) => a + log.weights[k], 0) / ks.length;
  if (!last7.length) return { count: 0, line: "Weigh in first thing, after the bathroom, before coffee. Seven entries and the average starts meaning something." };
  const avg = Math.round(mean(last7) * 10) / 10;
  const rate = prev7.length >= 3 ? Math.round((mean(prev7) - avg) * 10) / 10 : undefined;
  if (last7.length < 5) return { avg, rate, count: last7.length, line: `${last7.length} weigh-in${last7.length === 1 ? "" : "s"} this week. Day-to-day swings are water; the average is the truth.` };
  if (rate !== undefined && rate > Math.max(2.2, i.weightLb * 0.012)) return { avg, rate, count: last7.length, line: `Down ${rate} lb this week. That's faster than muscle likes. If it holds next week, add 200 kcal to training days.` };
  if (rate !== undefined && rate < 0.5) return { avg, rate, count: last7.length, line: `Down ${Math.max(0, rate)} lb this week. Check protein and portions first; if it holds next week, trim 150 kcal from rest days.` };
  const diff = Math.round((avg - targetOn(i, plan, today)) * 10) / 10;
  return { avg, rate, count: last7.length, line: Math.abs(diff) <= 1.5 ? "On the line. Change nothing." : diff > 0 ? `${diff} lb above the line. Stay the course; one week isn't a trend.` : `${-diff} lb ahead of the line. Keep protein high.` };
}

/** Plain-language summary of what the rails did, for the plan screen. */
export function planSummary(i: FastingInputs, p: FastingPlan): string {
  const fmt = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (!p.capped) return `About ${p.ratePerWeek} lb a week. You reach ${i.goalLb} around ${fmt(p.projectedGoalDate)}.`;
  return `Your date asks for ${p.requestedRate} lb a week. Faster than about ${p.ratePerWeek} costs muscle, so Fuel plans ${p.ratePerWeek}: about ${p.projectedAtGoalDate} lb on ${fmt(i.goalDate)}, and ${i.goalLb} around ${fmt(p.projectedGoalDate)}.`;
}

export function dowOf(date: string) { return dayOfWeek(date); }
