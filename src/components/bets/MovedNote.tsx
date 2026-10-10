"use client";
// PRD 4 · Home slot. Two quiet states:
//  1. Today was credited from elsewhere ("moved"): a one-line note under the header. Streak safe, no XP.
//  2. PWA, no Health connection, after 4pm, today not done: a once-a-day honor-system prompt.
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { getAdapter, isPWA, manualCredit } from "@/lib/health";
import { Icon, useMounted } from "@/components/ui";

const GUARD = "uvu.movedAsk";   // localStorage: the date the prompt was last answered or dismissed
const ASK_HOUR = 16;

export function MovedNote({ today }: { today?: string } & Record<string, unknown>) {
  const s = useStore();
  const date = typeof today === "string" ? today : undefined;
  const entry = date ? s.log.find((l) => l.date === date) : undefined;
  const moved = entry?.kind === "moved";

  // The prompt depends on the clock and on localStorage, so it only decides after mount; a minute tick re-checks the hour.
  const mounted = useMounted();
  const [tick, setTick] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [justCounted, setJustCounted] = useState(false);
  useEffect(() => { const t = setInterval(() => setTick((n) => n + 1), 60_000); return () => clearInterval(t); }, []);
  void tick;
  let ask = false;
  if (mounted && date && !moved && s.hydrated && !answered) {
    const doneKind = entry?.kind === "perfect" || entry?.kind === "done" || entry?.kind === "rest";
    const setDone = s.today?.status === "done" && s.today.date === date;
    const native = s.profile.healthConnected || getAdapter().available() || !isPWA();
    let guarded = false;
    try { guarded = localStorage.getItem(GUARD) === date; } catch {}
    ask = !doneKind && !setDone && !native && !guarded && new Date().getHours() >= ASK_HOUR;
  }

  const guard = () => { try { if (date) localStorage.setItem(GUARD, date); } catch {} setAnswered(true); };
  const yes = () => { if (!date) return; guard(); manualCredit(s, date, "Logged by you"); setJustCounted(true); };
  const no = () => guard();

  if (moved) {
    return (
      <section className="mx-6 mt-4 rounded-[18px] bg-ink-3 hairline px-4 py-3 flex items-center gap-3 a-rise" aria-live="polite">
        <span className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center" style={{ border: "2px solid #C8FF3D" }}><Icon.Check size={13} color="#C8FF3D" /></span>
        <div className="min-w-0 leading-[1.35]">
          <div className="t-small font-bold text-text truncate">{entry?.source ?? "Moved"} · streak safe</div>
          <div className="t-small text-muted">{justCounted ? "Honor system. The Promise and streak are yours." : "A Set still counts for XP."}</div>
        </div>
      </section>
    );
  }

  if (!ask) return null;
  return (
    <section className="mx-6 mt-4 rounded-[18px] bg-ink-3 hairline px-4 pt-3 pb-3 a-rise">
      <div className="t-body font-bold text-text">Did you train somewhere else today?</div>
      <div className="flex items-center gap-2 mt-2.5">
        <button onClick={yes} className="press h-11 px-4 rounded-xl bg-lime text-ink font-bold text-[14px]">Yes, count it</button>
        <button onClick={no} className="press h-11 px-4 rounded-xl text-muted font-bold text-[14px]">No</button>
      </div>
    </section>
  );
}
