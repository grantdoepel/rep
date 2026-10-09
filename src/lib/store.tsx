"use client";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Crowns, DailySet, DayLog, DuoQuest, Friend, LeagueRow, LeagueTier, Profile, SetMove, Streak, Track } from "./types";
import { addDays, applyCrownProgress, countDay, generateSet, localDate, scoreSet, tierFromScore, weekStart } from "./rules";
import { MOVEMENT_BY_ID } from "./content";
import { sync } from "./supabase";

export interface State {
  hydrated: boolean;
  onboarded: boolean;
  profile: Profile;
  crowns: Crowns;
  streak: Streak;
  gems: number;
  xpTotal: number;
  xpWeek: number;
  today?: DailySet;
  active?: DailySet;
  lastDone?: DailySet;
  log: DayLog[];
  leagueTier: LeagueTier;
  league: LeagueRow[];
  friends: Friend[];
  duo?: DuoQuest;
  nudgedToday: string[];
  cheered: string[];
  adaptiveNote?: string;
  seenMonday?: string;
  seenMilestone?: number;
}

type Actions = {
  completeOnboarding: (p: Partial<Profile>, placement: { pushups: number; squats: number; plank: number }) => void;
  updateProfile: (p: Partial<Profile>) => void;
  startSet: (kind?: "normal" | "rescue") => DailySet;
  recordMove: (i: number, achieved: number) => void;
  swapEasier: (i: number) => void;
  finishSet: () => { xp: number; perfect: boolean; crownUps: Track[] };
  useFreeze: () => boolean;
  nudge: (friendId: string) => void;
  cheer: (friendId: string) => void;
  setDuo: (friendId: string) => void;
  markMondaySeen: () => void;
  reset: () => void;
};

const KEY = "rep.v1";
const COLORS = ["#3D4EFF", "#FF6B4A", "#C8FF3D", "#8FB0FF", "#FFB347", "#2A2D38"];

function seedFriends(): Friend[] {
  return [
    { id: "f_marcus", username: "marcusj", displayName: "Marcus J.", streak: 31, xpWeek: 1180, doneToday: false, atRisk: true, isCrew: true, movingNow: false, color: COLORS[0] },
    { id: "f_priya", username: "priyan", displayName: "Priya N.", streak: 112, xpWeek: 1060, doneToday: true, atRisk: false, isDuo: true, isCrew: true, color: COLORS[1] },
    { id: "f_sam", username: "samk", displayName: "Sam K.", streak: 22, xpWeek: 1150, doneToday: true, atRisk: false, movingNow: true, color: COLORS[5] },
    { id: "f_dana", username: "danat", displayName: "Dana T.", streak: 19, xpWeek: 980, doneToday: true, atRisk: false, isCrew: true, movingNow: true, color: COLORS[5] },
  ];
}

function seedLeague(youXp: number, friends: Friend[]): LeagueRow[] {
  const names = ["Alex R.", "Jordan O.", "Riley B.", "Casey M.", "Morgan L.", "Taylor W.", "Jamie K.", "Avery S.", "Quinn D.", "Reese P.", "Drew H.", "Skyler F.", "Blake N.", "Emerson C.", "Finley G.", "Harper J.", "Kai T.", "Logan V.", "Parker B.", "Rowan E.", "Sage A.", "Tatum R.", "Wren M.", "Zion L.", "Noor K."];
  const goals: LeagueRow["goalTier"][] = ["casual", "regular", "serious"];
  const rows: LeagueRow[] = names.map((n, i) => ({ id: `l_${i}`, displayName: n, goalTier: goals[i % 3], sets: 3 + ((i * 7) % 5), xp: 1240 - i * 38 - ((i * 13) % 29) }));
  friends.forEach((f) => rows.push({ id: f.id, displayName: f.displayName, goalTier: "regular", sets: 5, xp: f.xpWeek, isFriend: true, isDuo: f.isDuo }));
  rows.push({ id: "you", displayName: "You", goalTier: "regular", sets: 5, xp: youXp, isYou: true, perfect: 2 });
  return rows.sort((a, b) => b.xp - a.xp).slice(0, 30);
}

function initial(): State {
  const tz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "America/New_York";
  const friends = seedFriends();
  return {
    hydrated: false, onboarded: false,
    profile: { id: "local", username: "you", displayName: "You", goalTier: "regular", environment: "home", tier: "standard", timezone: tz, restDays: [0], injuryFlags: [], accessibility: [], createdAt: "" },
    crowns: {}, streak: { current: 0, longest: 0, freezes: 2 }, gems: 0, xpTotal: 0, xpWeek: 0,
    log: [], leagueTier: "bronze", league: seedLeague(0, friends), friends, nudgedToday: [], cheered: [],
  };
}

const Ctx = createContext<(State & Actions) | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [s, setS] = useState<State>(initial);

  useEffect(() => {
    try { const raw = localStorage.getItem(KEY); if (raw) { const saved = JSON.parse(raw) as State; setS({ ...initial(), ...saved, hydrated: true, profile: { ...saved.profile, createdAt: saved.profile.createdAt || new Date().toISOString() } }); return; } } catch {}
    setS((x) => ({ ...x, hydrated: true, profile: { ...x.profile, createdAt: new Date().toISOString() } }));
  }, []);
  useEffect(() => { if (s.hydrated) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} } }, [s]);

  // Ensure today's Set exists and roll over day/week bookkeeping.
  useEffect(() => {
    if (!s.hydrated || !s.onboarded) return;
    const today = localDate(new Date(), s.profile.timezone);
    setS((x) => {
      let next = { ...x };
      if (!x.today || x.today.date !== today) {
        const yTracks = x.today?.status === "done" ? x.today.tracks : [];
        next.today = generateSet(x.profile, x.crowns, today, yTracks);
        next.active = undefined;
        // mark missed days in log
        if (x.today && x.today.status !== "done" && x.today.date < today) next.log = [...x.log, { date: x.today.date, kind: x.streak.freezes > 0 ? "frozen" : "missed" }];
        if (x.streak.lastCountedDate && x.streak.lastCountedDate < addDays(today, -1)) {
          next.streak = x.streak.freezes > 0 ? { ...x.streak, freezes: x.streak.freezes - 1, lastCountedDate: addDays(today, -1) } : { ...x.streak, current: 0 };
        }
        if (weekStart(today) !== weekStart(x.today?.date ?? today)) { next.xpWeek = 0; next.duo = undefined; }
      }
      if (!next.duo) next.duo = { partnerId: "f_priya", partnerName: "Priya", targetXp: 2000, yourXp: next.xpWeek, partnerXp: 600, weekStart: weekStart(today), status: "active" };
      return next;
    });
  }, [s.hydrated, s.onboarded, s.profile, s.crowns, s.today?.date]);

  const set = useCallback((fn: (x: State) => State) => setS((x) => { const n = fn(x); return n; }), []);

  const actions: Actions = useMemo(() => ({
    completeOnboarding: (p, placement) => set((x) => {
      const crowns = tierFromScore(placement.pushups, placement.squats, placement.plank);
      const today = localDate(new Date(), x.profile.timezone);
      const streak = countDay(x.streak, today);
      const profile = { ...x.profile, ...p };
      sync.profile(profile);
      return { ...x, onboarded: true, profile, crowns, streak, xpTotal: 60, xpWeek: 60, gems: 10, log: [{ date: today, kind: "done" }], today: { ...generateSet(profile, crowns, today), status: "planned" } };
    }),
    updateProfile: (p) => set((x) => { const profile = { ...x.profile, ...p }; sync.profile(profile); const today = localDate(new Date(), profile.timezone); const todaySet = x.today?.status === "done" ? x.today : generateSet(profile, x.crowns, today); return { ...x, profile, today: todaySet }; }),
    startSet: (kind = "normal") => {
      let out!: DailySet;
      set((x) => {
        const today = localDate(new Date(), x.profile.timezone);
        const base = kind === "rescue" ? generateSet(x.profile, x.crowns, today, [], { rescue: true }) : (x.today && x.today.date === today ? x.today : generateSet(x.profile, x.crowns, today));
        out = { ...base, status: "active", moves: base.moves.map((m) => ({ ...m, achieved: undefined })) };
        return { ...x, active: out };
      });
      return out;
    },
    recordMove: (i, achieved) => set((x) => x.active ? { ...x, active: { ...x.active, moves: x.active.moves.map((m, j) => (j === i ? { ...m, achieved } : m)) } } : x),
    swapEasier: (i) => set((x) => {
      if (!x.active) return x;
      const mv = MOVEMENT_BY_ID[x.active.moves[i].movement];
      const reg = mv?.regression ? MOVEMENT_BY_ID[mv.regression] : undefined;
      if (!reg) return x;
      const moves: SetMove[] = x.active.moves.map((m, j) => (j === i ? { movement: reg.id, target: Math.round(m.target * 1.25), unit: reg.unit, achieved: undefined } : m));
      return { ...x, active: { ...x.active, moves } };
    }),
    finishSet: () => {
      let result = { xp: 0, perfect: false, crownUps: [] as Track[] };
      set((x) => {
        if (!x.active) return x;
        const today = localDate(new Date(), x.profile.timezone);
        const firstOfDay = !(x.today && x.today.date === today && x.today.status === "done");
        const { crowns, crownUps } = applyCrownProgress(x.crowns, x.active, x.profile.environment);
        const { xp, perfect } = scoreSet(x.active.moves, { firstOfDay, crownUp: crownUps.length > 0, rescue: x.active.kind === "rescue" });
        const done: DailySet = { ...x.active, status: "done", xp, perfect };
        const streak = countDay(x.streak, today);
        const adaptiveNote = Object.entries(crowns).find(([, c]) => c.misses >= 2) ? "Two days short on a track. Tomorrow's Set steps down one level; it comes back after 3 clean days." : undefined;
        const log = x.log.filter((l) => l.date !== today).concat({ date: today, kind: x.active.kind === "rest" || x.active.kind === "rescue" ? "rest" : perfect ? "perfect" : "done" });
        const gems = x.gems + (perfect ? 10 : 0) + crownUps.length * 25;
        const friends = x.friends.map((f) => (f.movingNow ? { ...f, movingNow: false, doneToday: true } : f));
        const league = x.league.map((r) => (r.isYou ? { ...r, xp: x.xpWeek + xp, sets: r.sets + (firstOfDay ? 1 : 0) } : r)).sort((a, b) => b.xp - a.xp);
        result = { xp, perfect, crownUps };
        sync.setResult(x.profile.id, done, crowns, streak);
        return { ...x, active: undefined, today: done, lastDone: done, crowns, streak, xpTotal: x.xpTotal + xp, xpWeek: x.xpWeek + xp, gems, log, adaptiveNote, league, friends, duo: x.duo ? { ...x.duo, yourXp: x.duo.yourXp + xp } : x.duo };
      });
      return result;
    },
    useFreeze: () => {
      let ok = false;
      set((x) => { if (x.streak.freezes <= 0) return x; ok = true; const today = localDate(new Date(), x.profile.timezone); return { ...x, streak: { ...countDay(x.streak, today), freezes: x.streak.freezes - 1 }, log: x.log.filter((l) => l.date !== today).concat({ date: today, kind: "frozen" }) }; });
      return ok;
    },
    nudge: (id) => set((x) => x.nudgedToday.includes(id) ? x : { ...x, nudgedToday: [...x.nudgedToday, id], xpTotal: x.xpTotal + 5, xpWeek: x.xpWeek + 5 }),
    cheer: (id) => set((x) => ({ ...x, cheered: x.cheered.includes(id) ? x.cheered.filter((c) => c !== id) : [...x.cheered, id] })),
    setDuo: (id) => set((x) => { const f = x.friends.find((f) => f.id === id); if (!f) return x; return { ...x, friends: x.friends.map((g) => ({ ...g, isDuo: g.id === id })), duo: { partnerId: id, partnerName: f.displayName.split(" ")[0], targetXp: 2000, yourXp: x.xpWeek, partnerXp: Math.round(f.xpWeek * 0.55), weekStart: weekStart(localDate()), status: "active" } }; }),
    markMondaySeen: () => set((x) => ({ ...x, seenMonday: weekStart(localDate(new Date(), x.profile.timezone)) })),
    reset: () => { try { localStorage.removeItem(KEY); } catch {} setS({ ...initial(), hydrated: true }); },
  }), [set]);

  const value = useMemo(() => ({ ...s, ...actions }), [s, actions]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() { const c = useContext(Ctx); if (!c) throw new Error("useStore outside provider"); return c; }
