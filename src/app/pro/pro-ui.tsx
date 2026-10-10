"use client";
// Shared pieces for /pro: the prescriber web app. Bone ground, ink type, one accent, no mascot.
import Link from "next/link";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { Account } from "@/components/Account";
import { supabaseEnabled } from "@/lib/supabase";
import { myPlans, myPrescriber, planAdherence, type AdherenceRow, type Prescriber, type ProPlan } from "@/lib/plans";

// ---------- demo state (?demo=1): lets the UI render with no account. Clearly marked on screen. ----------
const D = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
export const DEMO_PRESCRIBER: Prescriber = { id: "demo-prescriber", orgName: "Northside Physio" };
export const DEMO_PLANS: ProPlan[] = [
  { id: "demo-knee", name: "Knee rehab · phase 2", code: "7f3a9c2e1b", weeks: 6, daysPerWeek: 5, createdAt: D(20), members: 3, adherence: 78, lastDone: D(0),
    moves: [{ id: "chair_squat", name: "Chair squat", target: 12, unit: "reps" }, { id: "glute_bridge", name: "Glute bridge", target: 15, unit: "reps" }, { id: "custom:demo-knee:3", name: "Heel raise", target: 20, unit: "reps", cue: "Slow on the way down. Hold the counter if you need it." }],
    patients: [
      { label: "Dana T.", week: 3, done: 12, due: 15, last_done: D(0), ended: false },
      { label: "Marcus J.", week: 2, done: 7, due: 10, last_done: D(1), ended: false },
      { label: "Priya N.", week: 1, done: 3, due: 3, last_done: D(0), ended: false },
    ] },
  { id: "demo-shoulder", name: "Shoulder · post-op", code: "a1d4e8f09c", weeks: 8, daysPerWeek: 4, createdAt: D(41), members: 1, adherence: 55, lastDone: D(3),
    moves: [{ id: "band_pullapart", name: "Band pull-apart", target: 15, unit: "reps" }, { id: "custom:demo-shoulder:2", name: "Wall slide", target: 10, unit: "reps" }, { id: "custom:demo-shoulder:3", name: "Pendulum swing", target: 30, unit: "seconds" }, { id: "superman", name: "Superman hold", target: 20, unit: "seconds" }],
    patients: [{ label: "Sam K.", week: 6, done: 13, due: 24, last_done: D(3), ended: false }] },
];
export function demoAdherence(planId: string): AdherenceRow[] {
  const plan = DEMO_PLANS.find((p) => p.id === planId) ?? DEMO_PLANS[0];
  const out: AdherenceRow[] = [];
  const pattern: Record<string, number[]> = { "Dana T.": [0, 1, 3, 4, 6, 7, 8, 10, 11, 13, 14, 16], "Marcus J.": [0, 2, 3, 5, 7, 9, 10], "Priya N.": [0, 1, 2], "Sam K.": [1, 2, 4, 6, 7, 9, 12, 14, 17, 19, 23, 25, 28] };
  for (const pt of plan.patients) {
    const startDaysAgo = (pt.week - 1) * 7 + 3;
    for (const off of pattern[pt.label] ?? [0, 2, 4]) {
      if (off > startDaysAgo) continue;
      const day = D(startDaysAgo - off);
      const kind = off % 5 === 4 ? "moved" : off % 3 === 0 ? "perfect" : "done";
      out.push({ user_label: pt.label, week: Math.floor(off / 7) + 1, day, kind, start_day: D(startDaysAgo),
        moves: kind === "moved" ? [] : plan.moves.map((m, i) => ({ id: m.id, name: m.name, target: m.target, achieved: Math.max(1, Math.round(m.target * (0.7 + ((off * 7 + i * 3) % 6) / 10))) })) });
    }
  }
  return out.sort((a, b) => a.user_label.localeCompare(b.user_label) || a.day.localeCompare(b.day));
}

// ---------- state ----------
export interface ProState { ready: boolean; demo: boolean; online: boolean; prescriber: Prescriber | null; plans: ProPlan[]; reload: () => Promise<void> }
export function useProState(): ProState {
  const s = useStore();
  const [demo, setDemo] = useState(false);
  const [ready, setReady] = useState(false);
  const [prescriber, setPrescriber] = useState<Prescriber | null>(null);
  const [plans, setPlans] = useState<ProPlan[]>([]);
  useEffect(() => { setDemo(new URL(window.location.href).searchParams.get("demo") === "1"); }, []);
  const reload = async () => {
    if (demo) { setPrescriber(DEMO_PRESCRIBER); setPlans(DEMO_PLANS); setReady(true); return; }
    if (!s.online) { setReady(s.hydrated); return; }
    const p = await myPrescriber().catch(() => null);
    setPrescriber(p);
    setPlans(p ? await myPlans().catch(() => []) : []);
    setReady(true);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (s.hydrated) reload(); }, [s.hydrated, s.online, demo]);
  return { ready, demo, online: s.online || demo, prescriber, plans, reload };
}

export function useAdherence(planId: string, demo: boolean) {
  const [rows, setRows] = useState<AdherenceRow[] | null>(null);
  useEffect(() => { if (!planId) return; if (demo) { setRows(demoAdherence(planId)); return; } planAdherence(planId).then(setRows).catch(() => setRows([])); }, [planId, demo]);
  return rows;
}

/** Keep ?demo=1 on internal links so the mocked state follows you around. */
export function proHref(path: string, demo: boolean) { return demo ? `${path}${path.includes("?") ? "&" : "?"}demo=1` : path; }

// ---------- chrome ----------
export function ProShell({ children, state, title, back }: { children: React.ReactNode; state: ProState; title?: string; back?: string }) {
  return (
    <div className="min-h-dvh bg-text text-ink" style={{ fontFamily: "var(--font-dm), system-ui, sans-serif" }}>
      <div className="mx-auto max-w-[720px] px-4 sm:px-6 pb-16">
        <header className="flex items-center justify-between pt-6 pb-4 border-b border-ink/10">
          <div className="flex items-center gap-3 min-w-0">
            <Link href={proHref("/pro", state.demo)} className="display text-[22px] tracking-[-0.04em] shrink-0">uvu <span className="text-ink/40">pro</span></Link>
            {state.prescriber && <span className="t-small font-semibold text-ink/55 truncate">· {state.prescriber.orgName}</span>}
          </div>
          <div className="flex items-center gap-3">
            {state.demo && <span className="t-micro bg-coral text-ink rounded-full px-2.5 py-1 whitespace-nowrap">Demo data</span>}
            <Link href="/" className="t-small font-bold text-ink/55 min-h-[44px] flex items-center">Patient app</Link>
          </div>
        </header>
        {(title || back) && (
          <div className="flex items-center gap-3 pt-6">
            {back && <Link href={proHref(back, state.demo)} aria-label="Back" className="w-11 h-11 -ml-3 rounded-full flex items-center justify-center text-ink/60 hover:bg-ink/5"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg></Link>}
            {title && <h1 className="display text-[28px] sm:text-[32px] tracking-[-0.04em]">{title}</h1>}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

/** Not signed in: the Account card on bone, with a plain reason. */
export function ProGate({ what = "your patients" }: { state?: ProState; what?: string }) {
  if (!supabaseEnabled) return <Card className="mt-8"><div className="t-body text-ink/70">Sign-in is not configured in this build. Add <code>?demo=1</code> to the address to see the prescriber app with sample data.</div></Card>;
  return (
    <div className="mt-8 max-w-[440px]">
      <div className="display text-[28px] tracking-[-0.04em]">Sign in to see {what}</div>
      <div className="t-body text-ink/60 mt-2">Prescriber accounts are ordinary uvu accounts. Sign in, name your clinic, and write your first plan.</div>
      <div className="mt-5 rounded-[22px] bg-ink text-text p-1"><Account /></div>
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-[20px] bg-white/70 border border-ink/10 ${className}`}>{children}</div>;
}

export const proBtn = {
  primary: "press inline-flex items-center justify-center gap-2 h-12 px-5 rounded-2xl bg-lime text-ink font-extrabold text-[15px] disabled:opacity-40",
  ink: "press inline-flex items-center justify-center gap-2 h-12 px-5 rounded-2xl bg-ink text-text font-extrabold text-[15px] disabled:opacity-40",
  ghost: "press inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl border-[1.5px] border-ink/15 text-ink font-bold text-[14px] disabled:opacity-40",
  field: "h-12 w-full rounded-xl bg-white border-[1.5px] border-ink/15 px-3.5 text-[15px] text-ink outline-none focus:border-ink/50 placeholder:text-ink/35",
};

export function pct(n: number | null | undefined) { return n === null || n === undefined || Number.isNaN(n) ? "—" : `${Math.round(n)}%`; }
export function fmtDay(d: string | null | undefined) {
  if (!d) return "—";
  const today = new Date().toISOString().slice(0, 10);
  if (d === today) return "Today";
  const y = new Date(); y.setDate(y.getDate() - 1);
  if (d === y.toISOString().slice(0, 10)) return "Yesterday";
  return new Date(d + "T12:00:00Z").toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
export function addDaysISO(d: string, n: number) { const x = new Date(d + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
