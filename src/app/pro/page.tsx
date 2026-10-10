"use client";
// /pro: the patient list. One row per patient on a live plan; click through for the grid.
import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, ProGate, ProShell, fmtDay, pct, proBtn, proHref, useProState } from "./pro-ui";

export default function ProHome() {
  const st = useProState();
  const [now, setNow] = useState(0);
  useEffect(() => { setNow(Date.now()); }, []);

  if (!st.ready) return <ProShell state={st}><div className="h-40" /></ProShell>;
  if (!st.online) return <ProShell state={st}><ProGate state={st} /></ProShell>;

  if (!st.prescriber) {
    return (
      <ProShell state={st}>
        <div className="mt-10 max-w-[480px]">
          <div className="display text-[32px] tracking-[-0.04em]">Three moves. One link. A grid that fills in.</div>
          <div className="t-body text-ink/60 mt-3">Write a short plan, send the link, and see which days your patient actually did it. They see exactly what you see, nothing more.</div>
          <Link href={proHref("/pro/new", st.demo)} className={`${proBtn.primary} mt-6`}>Write your first plan</Link>
        </div>
      </ProShell>
    );
  }

  const rows = st.plans.flatMap((p) => p.patients.filter((x) => !x.ended).map((x) => ({ ...x, plan: p })));
  const waiting = st.plans.filter((p) => p.members === 0);

  return (
    <ProShell state={st}>
      <div className="flex items-end justify-between gap-4 pt-7 pb-4">
        <div>
          <div className="t-micro text-ink/50">Patients</div>
          <div className="display text-[32px] tracking-[-0.04em] mt-1">{rows.length === 0 ? "No one yet" : `${rows.length} on a plan`}</div>
        </div>
        <Link href={proHref("/pro/new", st.demo)} className={proBtn.primary}>New plan</Link>
      </div>

      {rows.length > 0 && (
        <Card className="overflow-hidden">
          <table className="w-full text-left text-[14px]">
            <thead className="t-micro text-ink/50">
              <tr className="border-b border-ink/10">
                <th className="font-bold px-4 py-3">Patient</th>
                <th className="font-bold px-3 py-3 hidden sm:table-cell">Plan</th>
                <th className="font-bold px-3 py-3">Week</th>
                <th className="font-bold px-3 py-3 text-right">Adherence</th>
                <th className="font-bold px-4 py-3 text-right">Last done</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const a = r.due > 0 ? Math.min(100, (100 * r.done) / r.due) : null;
                const stale = r.last_done ? (now - new Date(r.last_done + "T12:00:00Z").getTime()) / 86_400_000 > 3 : true;
                return (
                  <tr key={`${r.plan.id}:${r.label}`} className="border-b border-ink/5 last:border-0 hover:bg-ink/[0.03]">
                    <td className="px-4 py-3 font-bold"><Link href={proHref(`/pro/plan/${r.plan.id}`, st.demo)} className="block -my-3 py-3">{r.label}</Link></td>
                    <td className="px-3 py-3 text-ink/70 hidden sm:table-cell">{r.plan.name}</td>
                    <td className="px-3 py-3 t-num text-[15px] whitespace-nowrap">{r.week} <span className="font-sans font-semibold text-ink/45 text-[13px]">of {r.plan.weeks}</span></td>
                    <td className="px-3 py-3 text-right">
                      <span className="inline-flex items-center gap-2 justify-end">
                        <span className="w-16 h-1.5 rounded-full bg-ink/10 overflow-hidden hidden sm:block"><span className="block h-full bg-lime" style={{ width: `${a ?? 0}%` }} /></span>
                        <span className="t-num text-[15px]">{pct(a)}</span>
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-right whitespace-nowrap ${stale ? "text-coral font-bold" : "text-ink/70"}`}>{fmtDay(r.last_done)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <div className="pt-8">
        <div className="t-micro text-ink/50 pb-3">Plans</div>
        <div className="grid gap-3 sm:grid-cols-2">
          {st.plans.map((p) => (
            <Link key={p.id} href={proHref(`/pro/plan/${p.id}`, st.demo)} className="press block">
              <Card className="p-4 h-full hover:border-ink/25">
                <div className="flex items-start justify-between gap-3">
                  <div className="font-bold text-[15px]">{p.name}</div>
                  <span className="t-num text-[15px]">{pct(p.adherence)}</span>
                </div>
                <div className="t-small text-ink/55 mt-1">{p.moves.map((m) => m.name).join(" · ")}</div>
                <div className="t-small text-ink/55 mt-2">{p.weeks} wk · {p.daysPerWeek} days a week · {p.members} {p.members === 1 ? "patient" : "patients"}</div>
              </Card>
            </Link>
          ))}
          {st.plans.length === 0 && <Card className="p-5 text-ink/60 t-body">No plans yet. The first one takes about a minute.</Card>}
        </div>
        {waiting.length > 0 && <div className="t-small text-ink/50 mt-3">{waiting.length === 1 ? "One plan is" : `${waiting.length} plans are`} waiting for a patient to open the link.</div>}
      </div>
    </ProShell>
  );
}
