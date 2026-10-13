"use client";
// Home · one line for Fuel: the live window when a plan exists, a quiet invitation when it doesn't.
import Link from "next/link";
import { useStore } from "@/lib/store";
import { clock, hm, hourLabel, phaseAt } from "@/lib/fasting";
import { MiniDial } from "./FuelDial";
import { useNow } from "@/lib/useNow";

export function FuelCard() {
  const s = useStore();
  const now = useNow();
  if (!now) return null;
  const f = s.fuel;
  if (!f) return (
    <Link href="/fast" className="press mx-6 mt-4 flex items-center justify-between gap-3 rounded-2xl bg-ink-3 px-4 min-h-[52px]">
      <span className="t-body"><b>Fuel</b> <span className="text-muted">· build a fasting plan around your training</span></span>
      <span className="text-lime" aria-hidden="true">→</span>
    </Link>
  );
  const ph = phaseAt(f.plan, now), dow = now.getDay(), h = now.getHours() + now.getMinutes() / 60;
  const line = ph.state === "fast" ? `Fasting · opens ${hourLabel(ph.day.start, false)} in ${clock(ph.left)}` : ph.state === "eat" ? `Eating · ${clock(ph.left)} left` : `Fasting · opens ${hourLabel(ph.next.start, false)} tomorrow`;
  return (
    <Link href="/fast" className="press mx-6 mt-4 flex items-center gap-3 rounded-2xl bg-ink-3 px-3 py-2.5" aria-label={`Fuel: ${line}`}>
      <MiniDial day={ph.day} size={40} hour={h} marks={{ am: f.inputs.week[dow].am ? hm(f.inputs.amTime) : undefined, pm: f.inputs.week[dow].pm ? hm(f.inputs.pmTime) : undefined }} />
      <div className="min-w-0 flex-1"><div className="t-micro text-muted">Fuel</div><div className={`font-bold truncate ${ph.state === "eat" ? "text-lime" : ""}`}>{line}</div></div>
      <span className="text-muted" aria-hidden="true">→</span>
    </Link>
  );
}
