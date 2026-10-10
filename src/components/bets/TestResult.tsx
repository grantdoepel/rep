"use client";
// PRD 7 · The Test Set, Done slot. The number, the series so far, and where it sits against published norms.
import Link from "next/link";
import { useStore } from "@/lib/store";
import { CHAIR_STAND, band, bandLabel, nextTestMonth, useTestSeries } from "@/lib/tests";

export function TestResult() {
  const s = useStore();
  const series = useTestSeries(s.ledger);
  const done = s.lastDone;
  if (!done?.test) return null;
  const move = done.moves.find((m) => m.movement === CHAIR_STAND.id) ?? done.moves[0];
  const achieved = move?.achieved ?? 0;
  const today = done.date;
  // today's number is the last point whether or not the local write has landed yet
  const points = [...series.filter((p) => p.date !== today), { date: today, achieved }].slice(-6);
  const b = band(achieved, s.profile.sex, s.profile.birthYear, today);

  // 120×40 mini line: lime stroke, ink-filled dots with a lime edge so they read on the ink card
  const W = 120, H = 40, PAD = 4;
  const max = Math.max(1, ...points.map((p) => p.achieved)), min = Math.min(...points.map((p) => p.achieved));
  const span = Math.max(1, max - min);
  const xs = points.length === 1 ? [W / 2] : points.map((_, i) => PAD + (i * (W - PAD * 2)) / (points.length - 1));
  const ys = points.map((p) => H - PAD - ((p.achieved - min) / span) * (H - PAD * 2));
  const path = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(" ");

  return (
    <div className="mx-6 mt-6 rounded-[22px] bg-ink text-text p-5 a-rise">
      <div className="t-micro text-muted">Test Set · {CHAIR_STAND.name.toLowerCase()}</div>
      <div className="flex items-end justify-between gap-4 mt-2">
        <div>
          <div className="display text-lime" style={{ fontSize: 72, letterSpacing: "-0.05em", lineHeight: 1 }}>{achieved}</div>
          <div className="t-small font-semibold text-muted mt-1">stands in {CHAIR_STAND.seconds} s</div>
        </div>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${points.length} test${points.length === 1 ? "" : "s"} so far`} className="shrink-0 mb-1 overflow-visible">
          {points.length > 1 && <path d={path} fill="none" stroke="#C8FF3D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
          {xs.map((x, i) => <circle key={points[i].date} cx={x} cy={ys[i]} r={i === xs.length - 1 ? 4 : 3} fill="#0C0D11" stroke="#C8FF3D" strokeWidth={i === xs.length - 1 ? 2.5 : 1.5} />)}
        </svg>
      </div>
      <div className="mt-4 pt-3 border-t border-hair flex flex-col gap-1">
        <div className="t-small font-semibold text-text-2">
          {b ? <>{b.label[0].toUpperCase() + b.label.slice(1)} for {bandLabel(b.ageBand)}{b.approx ? <span className="text-muted-2"> · approximate band</span> : ""}</> : <Link href="/rest-days" className="press">Add your birth year in Settings to compare</Link>}
        </div>
        <div className="t-small text-muted">Next test: {nextTestMonth(today)}</div>
      </div>
    </div>
  );
}
