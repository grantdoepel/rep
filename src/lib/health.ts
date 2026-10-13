"use client";
// PRD 4 · Credit movement from elsewhere. Read-only, smallest version.
// A workout of 20+ minutes recorded in Apple Health / Health Connect counts the day for the streak
// (log kind "moved"); it never earns XP. The native wrapper does not exist yet, so the Health query sits
// behind a pluggable adapter: `capacitorHealth` becomes live in the App Store build, `none` is the PWA.
// The PWA keeps an honest path: `manualCredit` ("Logged by you") from the Home prompt after 4pm.
import { useEffect, useRef } from "react";
import type { State } from "./store";
import type { DayLog, Streak } from "./types";
import { countDay } from "./rules";
import { sync } from "./supabase";
import { track } from "./analytics";

export const MIN_MINUTES = 20;

export interface HealthWorkout { source: string; minutes: number; start: string }

export interface HealthAdapter {
  available(): boolean;
  requestPermission(): Promise<boolean>;
  workoutsSince(isoStart: string): Promise<HealthWorkout[]>;
}

// The subset of the store a credit needs. Keeps this module testable and off the store's import graph.
export type HealthStore = Pick<State, "log" | "streak" | "online"> & {
  patch: (fn: (x: State) => Partial<State>) => void;
};

// ---------- adapters ----------
type Plugin = { requestHealthPermissions?: (o: { permissions: string[] }) => Promise<unknown>; requestAuthorization?: (o?: unknown) => Promise<unknown>; requestPermission?: (o?: unknown) => Promise<unknown>; queryWorkouts: (o: { startDate: string; endDate?: string; includeHeartRate?: boolean; includeRoute?: boolean; includeSteps?: boolean }) => Promise<unknown> };
function nativePlugin(): Plugin | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { Capacitor?: { Plugins?: Record<string, unknown> }; CapacitorHealth?: unknown };
  // capacitor-health registers itself as "HealthPlugin" in the native shell (ios/).
  const p = (w.Capacitor?.Plugins?.HealthPlugin ?? w.Capacitor?.Plugins?.Health ?? w.CapacitorHealth) as Plugin | undefined;
  return p && typeof p.queryWorkouts === "function" ? p : null;
}
function minutesOf(r: Record<string, unknown>): number {
  if (typeof r.minutes === "number") return r.minutes;
  if (typeof r.duration === "number") return r.duration > 600 ? r.duration / 60 : r.duration;   // seconds or minutes; a plausible guess
  const a = Date.parse(String(r.startDate ?? r.start ?? "")), b = Date.parse(String(r.endDate ?? r.end ?? ""));
  return Number.isFinite(a) && Number.isFinite(b) ? Math.max(0, (b - a) / 60000) : 0;
}

export const capacitorHealth: HealthAdapter = {
  available: () => nativePlugin() !== null,
  async requestPermission() {
    const p = nativePlugin(); if (!p) return false;
    try {
      const r = (p.requestHealthPermissions
        ? await p.requestHealthPermissions({ permissions: ["READ_WORKOUTS", "READ_WEIGHT"] })
        : await (p.requestAuthorization ?? p.requestPermission)?.({ read: ["workouts"] })) as Record<string, unknown> | undefined;
      return r === undefined || r.granted !== false;
    } catch { return false; }
  },
  async workoutsSince(isoStart) {
    const p = nativePlugin(); if (!p) return [];
    try {
      const r = (await p.queryWorkouts({ startDate: isoStart, endDate: new Date().toISOString(), includeHeartRate: false, includeRoute: false, includeSteps: false })) as unknown;
      const rows = (Array.isArray(r) ? r : (r as { workouts?: unknown[]; result?: unknown[] })?.workouts ?? (r as { result?: unknown[] })?.result ?? []) as Record<string, unknown>[];
      return rows.map((w) => ({ source: String(w.sourceName ?? w.source ?? w.workoutType ?? w.type ?? "Health"), minutes: Math.round(minutesOf(w)), start: String(w.startDate ?? w.start ?? isoStart) }));
    } catch { return []; }
  },
};

export const none: HealthAdapter = { available: () => false, requestPermission: async () => false, workoutsSince: async () => [] };

export const adapters = { capacitorHealth, none };

export function getAdapter(): HealthAdapter { return capacitorHealth.available() ? capacitorHealth : none; }

/** Installed to the home screen (standalone), or any browser that is not the native wrapper. */
export function isPWA(): boolean { return typeof window !== "undefined" && !nativePlugin(); }

// ---------- crediting ----------
export function alreadyCounted(log: DayLog[], today: string): boolean {
  const k = log.find((l) => l.date === today)?.kind;
  return k === "perfect" || k === "done" || k === "rest";
}

/** Writes the "moved" day: log, client streak, lastHealthCheck, server RPC when online, analytics. */
function applyCredit(s: HealthStore, today: string, source: string) {
  s.patch((x) => {
    const streak: Streak = countDay(x.streak, today);   // a moved day counts for the streak exactly like a done day
    return { log: x.log.filter((l) => l.date !== today).concat({ date: today, kind: "moved", source }), streak, lastHealthCheck: new Date().toISOString() };
  });
  if (s.online) sync.creditMoved(today, source).catch(() => {});
  track("day_moved", { source });
}

/** Queries workouts since local midnight; a 20+ minute one credits today unless a Set already did. */
export async function creditToday(s: HealthStore, today: string, adapter: HealthAdapter = getAdapter()): Promise<{ credited: boolean; source?: string }> {
  if (!adapter.available()) return { credited: false };
  const workouts = await adapter.workoutsSince(new Date(today + "T00:00:00").toISOString());
  s.patch(() => ({ lastHealthCheck: new Date().toISOString() }));
  const hit = workouts.find((w) => w.minutes >= MIN_MINUTES);
  if (!hit || alreadyCounted(s.log, today)) return { credited: false };
  if (s.log.find((l) => l.date === today)?.kind === "moved") return { credited: false, source: hit.source };
  applyCredit(s, today, hit.source);
  return { credited: true, source: hit.source };
}

/** The PWA path: the person says they trained somewhere else. Honor system. */
export function manualCredit(s: HealthStore, today: string, source = "Manual"): boolean {
  if (alreadyCounted(s.log, today)) return false;
  applyCredit(s, today, source);
  return true;
}

/** Runs `creditToday` on mount and whenever the app comes back to the foreground, when connected and available. */
export function useHealthCredit(s: HealthStore & { profile: { healthConnected?: boolean; timezone: string } }) {
  const connected = !!s.profile.healthConnected;
  const tz = s.profile.timezone;
  const ref = useRef(s);
  useEffect(() => { ref.current = s; });   // always the latest store; the credit effect itself only re-runs on connect/timezone
  useEffect(() => {
    if (!connected || !getAdapter().available()) return;
    const run = () => {
      const cur = ref.current;
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
      creditToday({ patch: cur.patch, log: cur.log, streak: cur.streak, online: cur.online }, today).catch(() => {});
    };
    run();
    const onVis = () => { if (document.visibilityState === "visible") run(); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [connected, tz]);
}
