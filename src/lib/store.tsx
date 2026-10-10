"use client";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Crew, CrewAward, Crowns, DailySet, DayLog, DuoQuest, Friend, LeagueRow, LeagueTier, LedgerRow, PinkyPromise, Plan, Profile, ProofShot, SetMove, Streak, Track } from "./types";
import { track } from "./analytics";
import { planSet } from "./plans";
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
  proofShots: ProofShot[];
  pinkyPromises: PinkyPromise[];
  pinkyUsedThisMonth: number;
  awards: CrewAward[];
  adaptiveNote?: string;
  seenMonday?: string;
  seenMilestone?: number;
  // the ledger: the last number you put up for each movement. "yesterday-you" everywhere.
  recent: Record<string, { date: string; achieved: number; target: number }>;
  online: boolean;              // signed in: friends/league/duo come from the server
  userId?: string;
  inviteCode?: string;
  toast?: string;
  pendingInvite?: string;
  // ---- the eight bets: slots owned by their feature modules (see src/lib/<feature>.ts) ----
  crew?: Crew;                  // PRD 3
  plan?: Plan;                  // PRD 8
  ledger: LedgerRow[];          // move_daily, pulled when online (PRD 7 series, Monday diffs)
  notePlayedOn?: string;        // PRD 5: date the note was last played (one play per evening)
  testSkippedOn?: string;       // PRD 7: date the Test Set was last skipped
  lastHealthCheck?: string;     // PRD 4: ISO time of the last Health query
}

type Actions = {
  completeOnboarding: (p: Partial<Profile>, placement: { pushups: number; squats: number; plank: number }) => void;
  updateProfile: (p: Partial<Profile>) => void;
  startSet: (kind?: "normal" | "rescue", via?: DailySet["via"]) => DailySet;
  recordMove: (i: number, achieved: number) => void;
  swapEasier: (i: number) => void;
  finishSet: (final?: { index: number; achieved: number }) => { xp: number; perfect: boolean; crownUps: Track[]; beats: number; moves: number };
  useFreeze: () => boolean;
  nudge: (friendId: string) => void;
  cheer: (friendId: string) => void;
  setDuo: (friendId: string) => void;
  markMondaySeen: () => void;
  addProofShot: (dataUrl: string) => void;
  setWager: (mine: string) => void;
  requestPinky: (date: string) => PinkyPromise | null;
  resolvePinky: (id: string, ok: boolean) => void;
  setTreat: (text: string, milestone: number) => void;
  setGym: (lat: number, lng: number, name: string) => void;
  refresh: () => Promise<void>;
  acceptInvite: (code: string) => Promise<void>;
  dismissToast: () => void;
  reset: () => void;
  // generic state patch for feature modules; prefer a named action when the change is reused
  patch: (fn: (x: State) => Partial<State>) => void;
  // merge profile fields and sync the extras (promise, rescue_at, anchor, note, birth year, health)
  patchProfile: (p: Partial<Profile>) => void;
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
    log: [], leagueTier: "bronze", league: seedLeague(0, friends), friends, nudgedToday: [], cheered: [], proofShots: [], pinkyPromises: [], pinkyUsedThisMonth: 0, awards: [],
    recent: {}, online: false, ledger: [],
  };
}

const Ctx = createContext<(State & Actions) | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [s, setS] = useState<State>(initial);
  const sRef = useRef(s); sRef.current = s;

  useEffect(() => {
    try { const raw = localStorage.getItem(KEY); if (raw) { const saved = JSON.parse(raw) as State; setS({ ...initial(), ...saved, recent: saved.recent ?? {}, ledger: saved.ledger ?? [], hydrated: true, profile: { ...saved.profile, createdAt: saved.profile.createdAt || new Date().toISOString() } }); return; } } catch {}
    setS((x) => ({ ...x, hydrated: true, profile: { ...x.profile, createdAt: new Date().toISOString() } }));
  }, []);
  useEffect(() => { if (s.hydrated) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} } }, [s]);

  const pull = useCallback(async () => {
    const r = await sync.pull().catch(() => null);
    if (!r) { setS((x) => (x.online ? { ...x, online: false } : x)); return; }
    setS((x) => ({ ...x, online: true, userId: r.userId, inviteCode: r.inviteCode, friends: r.friends, league: r.league.length ? r.league : x.league.filter((row) => row.isYou), leagueTier: r.leagueTier ?? x.leagueTier, duo: r.duo,
      profile: r.extras ? { ...x.profile, ...r.extras } : x.profile, ledger: r.ledger ?? x.ledger, crew: r.crew ?? x.crew, plan: r.plan ?? x.plan }));
  }, []);
  useEffect(() => {
    if (!s.hydrated) return;
    pull();
    const onFocus = () => { if (document.visibilityState === "visible") pull(); };
    document.addEventListener("visibilitychange", onFocus); window.addEventListener("focus", onFocus);
    const t = setInterval(pull, 90_000);
    return () => { document.removeEventListener("visibilitychange", onFocus); window.removeEventListener("focus", onFocus); clearInterval(t); };
  }, [s.hydrated, pull]);

  // An invite link opened before sign-in waits until there is a session.
  useEffect(() => {
    if (!s.online || !s.pendingInvite) return;
    const code = s.pendingInvite;
    setS((x) => ({ ...x, pendingInvite: undefined }));
    sync.acceptInvite(code).then((r) => { setS((x) => ({ ...x, toast: r.ok ? `You and ${r.name ?? "your friend"} are friends now.` : r.error ?? "That invite didn't work." })); pull(); });
  }, [s.online, s.pendingInvite, pull]);

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
        // a day already credited (moved, frozen, vouched) keeps its row
        if (x.today && x.today.status !== "done" && x.today.date < today && !x.log.some((l) => l.date === x.today!.date)) next.log = [...x.log, { date: x.today.date, kind: x.streak.freezes > 0 ? "frozen" : "missed" }];
        next.nudgedToday = [];
        if (x.streak.lastCountedDate && x.streak.lastCountedDate < addDays(today, -1)) {
          next.streak = x.streak.freezes > 0 ? { ...x.streak, freezes: x.streak.freezes - 1, lastCountedDate: addDays(today, -1) } : { ...x.streak, current: 0 };
        }
        if (weekStart(today) !== weekStart(x.today?.date ?? today)) { next.xpWeek = 0; next.duo = undefined; }
      }
      if (!next.duo && !x.online) next.duo = { partnerId: "f_priya", partnerName: "Priya", targetXp: 2000, yourXp: next.xpWeek, partnerXp: 600, weekStart: weekStart(today), status: "active", wagerPartner: "Loser buys coffee" };
      next.proofShots = (next.proofShots ?? []).filter((p) => p.expiresAt > new Date().toISOString());
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
    startSet: (kind = "normal", via?: DailySet["via"]) => {
      let out!: DailySet;
      set((x) => {
        const today = localDate(new Date(), x.profile.timezone);
        const prescribed = kind === "normal" && x.plan ? planSet(x.plan, x.recent, today) : null;   // PRD 8: the plan is today's Set
        const base = prescribed ?? (kind === "rescue" ? generateSet(x.profile, x.crowns, today, [], { rescue: true }) : (x.today && x.today.date === today ? x.today : generateSet(x.profile, x.crowns, today)));
        out = { ...base, status: "active", via, moves: base.moves.map((m) => ({ ...m, achieved: undefined })) };
        if (x.online) sync.presence(out.id, 0);
        track("set_started", { kind, via: via ?? "home", test: !!out.test, plan: !!out.planId });
        return { ...x, active: out };
      });
      return out;
    },
    recordMove: (i, achieved) => set((x) => { if (!x.active) return x; if (x.online && achieved > 0) sync.presence(x.active.id, i); return { ...x, active: { ...x.active, moves: x.active.moves.map((m, j) => (j === i ? { ...m, achieved } : m)) } }; }),
    swapEasier: (i) => set((x) => {
      if (!x.active) return x;
      const mv = MOVEMENT_BY_ID[x.active.moves[i].movement];
      const reg = mv?.regression ? MOVEMENT_BY_ID[mv.regression] : undefined;
      if (!reg) return x;
      const moves: SetMove[] = x.active.moves.map((m, j) => (j === i ? { movement: reg.id, target: Math.round(m.target * 1.25), unit: reg.unit, achieved: undefined } : m));
      return { ...x, active: { ...x.active, moves } };
    }),
    finishSet: (final) => {
      // Computed from the current snapshot (plus the final move passed in), then committed in one update:
      // a function updater here can be deferred by React when another update is queued, which lost the result.
      const x = sRef.current;
      if (!x.active) return { xp: 0, perfect: false, crownUps: [], beats: 0, moves: 0 };
      const active = final ? { ...x.active, moves: x.active.moves.map((m, j) => (j === final.index ? { ...m, achieved: final.achieved } : m)) } : x.active;
      const today = localDate(new Date(), x.profile.timezone);
      const firstOfDay = !(x.today && x.today.date === today && x.today.status === "done");
      const { crowns, crownUps } = applyCrownProgress(x.crowns, active, x.profile.environment);
      const scored = scoreSet(active.moves, { firstOfDay, crownUp: crownUps.length > 0, rescue: active.kind === "rescue" });
      const effort = active.moves.filter((m) => (m.achieved ?? 0) > 0).length;
      const xp = effort > 0 ? Math.max(10, scored.xp) : 0;   // any effort is worth something; nothing is worth nothing
      const perfect = scored.perfect;
      // you vs. you: compare each move with the last time you did it, then write today into the ledger
      let beats = 0; const recent = { ...x.recent };
      for (const m of active.moves) { const prev = recent[m.movement]; const a = m.achieved ?? 0; if (prev && prev.date < today && a > prev.achieved) beats++; if (a > 0) recent[m.movement] = { date: today, achieved: Math.max(a, prev?.date === today ? prev.achieved : 0), target: m.target }; }
      const done: DailySet = { ...active, status: "done", xp, perfect };
      const streak = effort > 0 ? countDay(x.streak, today) : x.streak;
      const adaptiveNote = Object.entries(crowns).find(([, c]) => c.misses >= 2) ? "Two days short on a track. Tomorrow's Set steps down one level; it comes back after 3 clean days." : undefined;
      const log = effort > 0 ? x.log.filter((l) => l.date !== today).concat({ date: today, kind: active.kind === "rest" || active.kind === "rescue" ? "rest" : perfect ? "perfect" : "done" }) : x.log;
      const gems = x.gems + (perfect ? 10 : 0) + crownUps.length * 25;
      const friends = x.friends.map((f) => (f.movingNow ? { ...f, movingNow: false, doneToday: true } : f));
      const league = x.league.map((r) => (r.isYou ? { ...r, xp: x.xpWeek + xp, sets: r.sets + (firstOfDay && effort > 0 ? 1 : 0) } : r)).sort((a, b) => b.xp - a.xp);
      if (effort > 0) sync.setResult(x.profile.id, done, crowns, streak).then(() => { if (x.online) pull(); });
      track("set_done", { kind: active.kind, xp, perfect, beats, moves: effort, test: !!active.test, plan: !!active.planId });
      const next: State = { ...x, recent, active: undefined, today: effort > 0 ? done : x.today, lastDone: done, crowns, streak, xpTotal: x.xpTotal + xp, xpWeek: x.xpWeek + xp, gems, log, adaptiveNote, league, friends, duo: x.duo ? { ...x.duo, yourXp: x.duo.yourXp + xp } : x.duo };
      setS(next); sRef.current = next;
      return { xp, perfect, crownUps, beats, moves: effort };
    },
    useFreeze: () => {
      let ok = false;
      set((x) => { if (x.streak.freezes <= 0) return x; ok = true; const today = localDate(new Date(), x.profile.timezone); return { ...x, streak: { ...countDay(x.streak, today), freezes: x.streak.freezes - 1 }, log: x.log.filter((l) => l.date !== today).concat({ date: today, kind: "frozen" }) }; });
      return ok;
    },
    nudge: (id) => set((x) => { if (x.nudgedToday.includes(id)) return x; if (x.online) sync.nudge(id); return { ...x, nudgedToday: [...x.nudgedToday, id], xpTotal: x.xpTotal + 5, xpWeek: x.xpWeek + 5 }; }),
    cheer: (id) => set((x) => ({ ...x, cheered: x.cheered.includes(id) ? x.cheered.filter((c) => c !== id) : [...x.cheered, id] })),
    setDuo: (id) => set((x) => { const f = x.friends.find((f) => f.id === id); if (!f) return x; if (x.online) { sync.setDuo(id).then((r) => { if (!r.ok) setS((y) => ({ ...y, toast: r.error ?? "Couldn't start that Duo." })); pull(); }); } return { ...x, friends: x.friends.map((g) => ({ ...g, isDuo: g.id === id })), duo: { partnerId: id, partnerName: f.displayName.split(" ")[0], targetXp: 2000, yourXp: x.xpWeek, partnerXp: Math.round(f.xpWeek * 0.55), weekStart: weekStart(localDate()), status: "active" } }; }),
    markMondaySeen: () => set((x) => ({ ...x, seenMonday: weekStart(localDate(new Date(), x.profile.timezone)) })),
    addProofShot: (dataUrl) => set((x) => { const today = localDate(new Date(), x.profile.timezone); const exp = new Date(Date.now() + 24 * 3600 * 1000).toISOString(); return { ...x, proofShots: [...x.proofShots.filter((p) => p.date !== today), { id: `ps_${Date.now()}`, date: today, dataUrl, setId: x.lastDone?.id ?? "", expiresAt: exp }] }; }),
    setWager: (mine) => set((x) => { if (!x.duo) return x; if (x.online) sync.setWager(mine); return { ...x, duo: { ...x.duo, wagerYou: mine } }; }),
    requestPinky: (date) => {
      let out: PinkyPromise | null = null;
      set((x) => { if (x.pinkyUsedThisMonth >= 2 || !x.duo) return x; const partner = x.friends.find((f) => f.id === x.duo!.partnerId); out = { id: `pp_${Date.now()}`, date, voucherId: x.duo.partnerId, voucherName: partner?.displayName.split(" ")[0] ?? x.duo.partnerName, status: "pending" }; return { ...x, pinkyPromises: [...x.pinkyPromises, out], pinkyUsedThisMonth: x.pinkyUsedThisMonth + 1 }; });
      return out;
    },
    resolvePinky: (id, ok) => set((x) => { const pp = x.pinkyPromises.find((p) => p.id === id); if (!pp) return x; const promises = x.pinkyPromises.map((p) => (p.id === id ? { ...p, status: ok ? "vouched" as const : "declined" as const } : p)); if (!ok) return { ...x, pinkyPromises: promises }; const streak = countDay(x.streak, pp.date); return { ...x, pinkyPromises: promises, streak, log: x.log.filter((l) => l.date !== pp.date).concat({ date: pp.date, kind: "done" }) }; }),
    setTreat: (text, milestone) => set((x) => { const profile = { ...x.profile, treatText: text, treatMilestone: milestone }; sync.profile(profile); return { ...x, profile }; }),
    setGym: (lat, lng, name) => set((x) => { const profile = { ...x.profile, gymLat: lat, gymLng: lng, gymName: name }; sync.profile(profile); return { ...x, profile }; }),
    refresh: pull,
    acceptInvite: async (code) => {
      const c = code.trim().toLowerCase(); if (!c) return;
      if (!sRef.current.online) { setS((x) => ({ ...x, pendingInvite: c, toast: "Sign in and you'll be friends automatically." })); return; }
      const r = await sync.acceptInvite(c);
      setS((x) => ({ ...x, toast: r.ok ? `You and ${r.name ?? "your friend"} are friends now.` : r.error ?? "That invite didn't work." }));
      pull();
    },
    dismissToast: () => set((x) => ({ ...x, toast: undefined })),
    patch: (fn) => set((x) => ({ ...x, ...fn(x) })),
    patchProfile: (p) => set((x) => { const profile = { ...x.profile, ...p }; sync.profileExtras(p); return { ...x, profile }; }),
    reset: () => { try { localStorage.removeItem(KEY); } catch {} setS({ ...initial(), hydrated: true }); },
  }), [set, pull]);

  const value = useMemo(() => ({ ...s, ...actions }), [s, actions]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() { const c = useContext(Ctx); if (!c) throw new Error("useStore outside provider"); return c; }
