"use client";
// PRD 7 · The Test Set, Home slot. Offered on the first Set of each calendar month: a 30-second chair stand.
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { track } from "@/lib/analytics";
import { CHAIR_STAND, testDue, testSeries, useLocalTests } from "@/lib/tests";
import type { DailySet } from "@/lib/types";
import { Icon, haptic } from "@/components/ui";

export function TestSetCard({ today }: { today?: string }) {
  const s = useStore();
  const router = useRouter();
  const local = useLocalTests();

  if (!today || local === null) return null;
  const doneToday = s.today?.status === "done" && s.today.date === today;
  if (doneToday || !testDue(s.log, s.ledger, today, s.testSkippedOn, local)) return null;

  const series = testSeries(s.ledger, local);
  const lastValue = s.recent[CHAIR_STAND.id]?.achieved ?? series[series.length - 1]?.achieved;
  const target = Math.max(1, lastValue ?? 12);

  const start = () => {
    const set: DailySet = { id: `set_${today}_test`, date: today, tracks: ["legs"], moves: [{ movement: CHAIR_STAND.id, target, unit: "reps", test: true }], plannedMinutes: 1, kind: "normal", test: true, via: "home", status: "active" };
    s.patch(() => ({ active: set }));
    track("set_started", { kind: "normal", via: "home", test: true, plan: false });
    haptic(10);
    router.push("/set");
  };
  const skip = () => { s.patch(() => ({ testSkippedOn: today })); track("test_skipped", { date: today }); haptic(6); };

  return (
    <section className="mx-6 mt-4 rounded-[26px] p-5 bg-lime text-ink a-rise">
      <div className="flex items-center justify-between">
        <span className="t-micro opacity-70">Test Set · monthly</span>
        <span className="t-micro opacity-70">{series.length ? `last ${lastValue}` : "first time"}</span>
      </div>
      <div className="display t-h2 mt-2.5">Chair stands · 30 seconds</div>
      <div className="t-small font-semibold opacity-75 mt-2">Count every full stand. Arms crossed.</div>
      <button onClick={start} className="press flex items-center justify-center gap-2.5 mt-4 h-14 rounded-2xl bg-ink text-text font-extrabold text-[17px] w-full"><Icon.Play color="#C8FF3D" />Start test</button>
      <button onClick={skip} className="press mt-1 h-11 w-full rounded-xl font-bold text-[14px] opacity-70">Skip today</button>
    </section>
  );
}
