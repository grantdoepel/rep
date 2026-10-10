"use client";
// PRD 7 · The Test Set. One test for now: the 30-second chair stand, offered on the first Set of each calendar month.
import { useMemo, useSyncExternalStore } from "react";
import type { DayLog, LedgerRow } from "./types";

export type Sex = "f" | "m";
export type AgeBand = "20-29" | "30-39" | "40-49" | "50-59" | "60-69" | "70-79" | "80+";
export interface Norm { sex: Sex; ageBand: AgeBand; p25: number; p50: number; p75: number; approx?: boolean }
export interface TestDef { id: string; name: string; seconds: number; norms: Norm[]; source: string }
export interface TestRecord { date: string; achieved: number }

const n = (sex: Sex, ageBand: AgeBand, p25: number, p50: number, p75: number, approx?: boolean): Norm => ({ sex, ageBand, p25, p50, p75, ...(approx ? { approx } : {}) });

export const TESTS: TestDef[] = [
  {
    id: "chair_stand_30s",
    name: "Chair stands",
    seconds: 30,
    // 60+ : Rikli & Jones normal range (25th–75th percentile), p50 taken as the midpoint of that range.
    // Under 60: conservative extrapolations; no published Senior Fitness Test norms exist for these ages.
    norms: [
      n("f", "20-29", 16, 20, 24, true), n("f", "30-39", 15, 19, 23, true), n("f", "40-49", 14, 18, 22, true), n("f", "50-59", 13, 16, 19, true),
      n("f", "60-69", 11, 14, 16), n("f", "70-79", 10, 12, 15), n("f", "80+", 8, 11, 13),
      n("m", "20-29", 18, 22, 26, true), n("m", "30-39", 17, 21, 25, true), n("m", "40-49", 16, 20, 24, true), n("m", "50-59", 14, 18, 21, true),
      n("m", "60-69", 12, 16, 18), n("m", "70-79", 11, 14, 17), n("m", "80+", 8, 12, 14),
    ],
    source: "Rikli & Jones, Senior Fitness Test Manual (Human Kinetics) — 30-second chair stand normal ranges for ages 60+. Bands under 60 are approximate (marked approx) and deliberately conservative.",
  },
];
export const CHAIR_STAND = TESTS[0];

// ---------- local records: offline users keep their own series ----------
export const LOCAL_KEY = "uvu.tests";
export function readLocalTests(): TestRecord[] {
  try { const raw = localStorage.getItem(LOCAL_KEY); const arr = raw ? (JSON.parse(raw) as TestRecord[]) : []; return Array.isArray(arr) ? arr.filter((r) => r && typeof r.date === "string" && typeof r.achieved === "number") : []; } catch { return []; }
}
export function writeLocalTest(rec: TestRecord) {
  try { const arr = readLocalTests().filter((r) => r.date !== rec.date); arr.push(rec); arr.sort((a, b) => a.date.localeCompare(b.date)); localStorage.setItem(LOCAL_KEY, JSON.stringify(arr.slice(-36))); } catch {}
  try { window.dispatchEvent(new Event(LOCAL_EVENT)); } catch {}
}
const LOCAL_EVENT = "uvu.tests.changed";
const subscribeLocal = (cb: () => void) => { window.addEventListener("storage", cb); window.addEventListener(LOCAL_EVENT, cb); return () => { window.removeEventListener("storage", cb); window.removeEventListener(LOCAL_EVENT, cb); }; };
const readRaw = () => { try { return localStorage.getItem(LOCAL_KEY) ?? ""; } catch { return ""; } };
/** The local records as a store: null until the client has mounted (there is no localStorage during prerender). */
export function useLocalTests(): TestRecord[] | null {
  const raw = useSyncExternalStore(subscribeLocal, readRaw, () => null);
  return useMemo(() => (raw === null ? null : readLocalTests()), [raw]);
}

// ---------- the series: server ledger rows merged with local records, one point per date ----------
export function testSeries(ledger: LedgerRow[], localRecords: TestRecord[] = []): TestRecord[] {
  const byDate = new Map<string, number>();
  for (const r of ledger) if (r.test && r.movement === CHAIR_STAND.id) byDate.set(r.date, Math.max(byDate.get(r.date) ?? 0, r.achieved));
  for (const r of localRecords) byDate.set(r.date, Math.max(byDate.get(r.date) ?? 0, r.achieved));
  return [...byDate.entries()].map(([date, achieved]) => ({ date, achieved })).sort((a, b) => a.date.localeCompare(b.date));
}

/** The merged series in a client component; empty until mounted. */
export function useTestSeries(ledger: LedgerRow[]): TestRecord[] {
  const local = useLocalTests();
  return useMemo(() => (local === null ? [] : testSeries(ledger, local)), [ledger, local]);
}

// ---------- when is a Test due ----------
// Due when nothing has been tested this calendar month, it wasn't skipped today, and we're either in the
// first 7 days of the month (the re-offer window) or the user has never tested at all.
export function testDue(_log: DayLog[], ledger: LedgerRow[], today: string, testSkippedOn?: string, localRecords: TestRecord[] = readLocalTests()): boolean {
  if (!today || testSkippedOn === today) return false;
  const series = testSeries(ledger, localRecords);
  const month = today.slice(0, 7);
  if (series.some((r) => r.date.slice(0, 7) === month)) return false;
  const dom = Number(today.slice(8, 10));
  return dom <= 7 || series.length === 0;
}

// ---------- comparing to the norms ----------
export type BandLabel = "top band" | "above average" | "average" | "below average";
export function ageBandFor(birthYear: number, today: string): AgeBand {
  const age = Number(today.slice(0, 4)) - birthYear;
  if (age < 30) return "20-29"; if (age < 40) return "30-39"; if (age < 50) return "40-49"; if (age < 60) return "50-59"; if (age < 70) return "60-69"; if (age < 80) return "70-79"; return "80+";
}
export function band(achieved: number, sex: Sex | undefined, birthYear: number | undefined, today: string): { label: BandLabel; ageBand: AgeBand; approx: boolean } | null {
  if (!sex || !birthYear || !Number.isFinite(birthYear)) return null;
  const ageBand = ageBandFor(birthYear, today);
  const norm = CHAIR_STAND.norms.find((x) => x.sex === sex && x.ageBand === ageBand);
  if (!norm) return null;
  const label: BandLabel = achieved > norm.p75 ? "top band" : achieved > norm.p50 ? "above average" : achieved >= norm.p25 ? "average" : "below average";
  return { label, ageBand, approx: !!norm.approx };
}

/** "40–49" with a real en dash, for copy. */
export function bandLabel(b: AgeBand): string { return b.replace("-", "–"); }

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export function nextTestMonth(today: string): string { const m = Number(today.slice(5, 7)); return MONTHS[m % 12]; }
export function shortMonthYear(date: string): string { const m = Number(date.slice(5, 7)); return `${MONTHS[m - 1].slice(0, 3)} ${date.slice(0, 4)}`; }
