"use client";
// /pro/plan/[id]: one plan. Adherence grid (weeks × days), per-move numbers, CSV export.
import { useParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import type { AdherenceRow } from "@/lib/plans";
import { track } from "@/lib/analytics";
import { Card, ProGate, ProShell, addDaysISO, fmtDay, pct, proBtn, useAdherence, useProState } from "../../pro-ui";

export default function PlanPage() {
  return <Suspense fallback={<div className="min-h-dvh bg-text" />}><PlanInner /></Suspense>;
}

type Cell = { date: string; kind: "done" | "missed" | "moved" | "future" | "rest" };

function PlanInner() {
  const params = useParams<{ id: string }>();
  const id = String(params?.id ?? "");
  const st = useProState();
  const rows = useAdherence(st.ready && st.online ? id : "", st.demo);
  const plan = st.plans.find((p) => p.id === id);
  const [who, setWho] = useState<string | null>(null);
  const [today, setToday] = useState("");
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");
  useEffect(() => { setToday(new Date().toISOString().slice(0, 10)); setOrigin(window.location.origin); }, []);

  const patients = useMemo(() => {
    const byLabel = new Map<string, { label: string; start: string; rows: AdherenceRow[] }>();
    for (const r of rows ?? []) { const p = byLabel.get(r.user_label) ?? { label: r.user_label, start: r.start_day, rows: [] }; p.rows.push(r); byLabel.set(r.user_label, p); }
    // members with no rows yet still exist on the plan list
    for (const pt of plan?.patients ?? []) if (!byLabel.has(pt.label)) byLabel.set(pt.label, { label: pt.label, start: today ? addDaysISO(today, -((pt.week - 1) * 7)) : today, rows: [] });
    return [...byLabel.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [rows, plan, today]);
  const sel = patients.find((p) => p.label === who) ?? patients[0];

  if (!st.ready) return <ProShell state={st}><div className="h-40" /></ProShell>;
  if (!st.online) return <ProShell state={st} title="Plan" back="/pro"><ProGate state={st} what="this plan" /></ProShell>;
  if (!plan) return <ProShell state={st} title="Plan" back="/pro"><div className="t-body text-ink/60 mt-6">{st.plans.length ? "That plan isn't yours, or it was removed." : "Loading"}</div></ProShell>;

  const link = `${origin}/plan?c=${plan.code}`;
  const copy = async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch {} };

  const grid: Cell[][] = sel ? Array.from({ length: plan.weeks }, (_, w) => Array.from({ length: 7 }, (_, d) => {
    const date = addDaysISO(sel.start, w * 7 + d);
    const r = sel.rows.find((x) => x.day === date);
    const kind: Cell["kind"] = r ? (r.kind === "moved" ? "moved" : r.kind === "rest" ? "rest" : "done") : date > today ? "future" : "missed";
    return { date, kind };
  })) : [];
  const doneDays = sel ? sel.rows.filter((r) => r.kind !== "rest").length : 0;
  const elapsed = sel && today ? Math.min(plan.weeks * 7, Math.max(0, Math.round((Date.parse(today) - Date.parse(sel.start)) / 86_400_000) + 1)) : 0;
  const due = Math.max(1, Math.ceil((elapsed * plan.daysPerWeek) / 7));
  const weekNow = sel ? Math.min(plan.weeks, Math.floor(Math.max(0, elapsed - 1) / 7) + 1) : 0;

  const moveStats = plan.moves.map((m) => {
    const vals = (sel?.rows ?? []).flatMap((r) => r.moves.filter((x) => x.id === m.id).map((x) => x.achieved));
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    const best = vals.length ? Math.max(...vals) : null;
    const last = (sel?.rows ?? []).slice().reverse().flatMap((r) => r.moves.filter((x) => x.id === m.id))[0]?.achieved ?? null;
    const hit = vals.filter((v) => v >= m.target).length;
    return { ...m, avg, best, last, n: vals.length, hit };
  });

  const exportCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [["patient", "date", "week", "kind", "move", "achieved", "target", "unit"].join(",")];
    for (const r of rows ?? []) {
      if (r.moves.length === 0) lines.push([r.user_label, r.day, r.week, r.kind, "", "", "", ""].map(esc).join(","));
      for (const m of r.moves) lines.push([r.user_label, r.day, r.week, r.kind, m.name, m.achieved, m.target, plan.moves.find((x) => x.id === m.id)?.unit ?? ""].map(esc).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${plan.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-adherence.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    track("plan_exported", { plan_id: plan.id, rows: rows?.length ?? 0 });
  };

  return (
    <ProShell state={st} title={plan.name} back="/pro">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2 t-small text-ink/55">
        <span>{plan.weeks} weeks · {plan.daysPerWeek} days a week</span>
        <span>{plan.moves.map((m) => `${m.name} ${m.target}${m.unit === "seconds" ? "s" : ""}`).join(" · ")}</span>
      </div>
      <div className="flex flex-wrap items-center gap-3 mt-4">
        <button onClick={copy} className={proBtn.ghost}>{copied ? "Link copied" : "Copy patient link"}</button>
        <button onClick={exportCsv} disabled={!rows || rows.length === 0} className={proBtn.ghost}>Export CSV</button>
        <span className="t-small text-ink/45">code {plan.code}</span>
      </div>

      {patients.length === 0 ? (
        <Card className="mt-8 p-6 max-w-[520px]"><div className="font-bold text-[16px]">Nobody has opened the link yet.</div><div className="t-body text-ink/60 mt-1.5">When a patient joins, their days fill in here as they do them.</div></Card>
      ) : (
        <>
          {patients.length > 1 && (
            <div className="flex gap-2 mt-8 flex-wrap" role="tablist">
              {patients.map((p) => <button key={p.label} role="tab" aria-selected={sel?.label === p.label} onClick={() => setWho(p.label)} className={`h-10 px-4 rounded-full text-[14px] font-bold ${sel?.label === p.label ? "bg-ink text-text" : "bg-ink/5 text-ink/70"}`}>{p.label}</button>)}
            </div>
          )}

          {sel && (
            <div className="grid gap-6 lg:grid-cols-[1fr_320px] mt-6 items-start">
              <Card className="p-5">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <div className="t-micro text-ink/50">{sel.label} · week {weekNow} of {plan.weeks}</div>
                    <div className="display text-[30px] tracking-[-0.04em] mt-1">{doneDays} <span className="text-[16px] text-ink/45 font-sans font-semibold">of {due} days so far · {pct(Math.min(100, (100 * doneDays) / due))}</span></div>
                  </div>
                  <div className="t-small text-ink/55 text-right">Started {fmtDay(sel.start)}<br />Last done {fmtDay(sel.rows.at(-1)?.day ?? null)}</div>
                </div>
                <div className="mt-5 overflow-x-auto">
                  <div className="grid gap-1.5 min-w-[296px]" style={{ gridTemplateColumns: "auto repeat(7, minmax(0, 1fr))" }}>
                    <div />
                    {["D1", "D2", "D3", "D4", "D5", "D6", "D7"].map((d) => <div key={d} className="t-micro text-ink/40 text-center">{d}</div>)}
                    {grid.map((week, w) => (
                      <WeekRow key={w} w={w} week={week} dueDays={plan.daysPerWeek} />
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-4 mt-4 t-micro text-ink/50">
                  <Legend className="bg-lime" label="Done" /><Legend className="border-2 border-lime bg-transparent" label="Moved elsewhere" /><Legend className="bg-ink/12" label="Not done" /><Legend className="border border-dashed border-ink/25" label="Ahead" />
                </div>
              </Card>

              <Card className="p-5">
                <div className="t-micro text-ink/50">Per move · achieved vs target</div>
                <table className="w-full mt-3 text-[14px]">
                  <thead><tr className="t-micro text-ink/40 text-left"><th className="font-bold pb-2">Move</th><th className="font-bold pb-2 text-right">Last</th><th className="font-bold pb-2 text-right">Avg</th><th className="font-bold pb-2 text-right">Target</th></tr></thead>
                  <tbody>
                    {moveStats.map((m) => (
                      <tr key={m.id} className="border-t border-ink/8">
                        <td className="py-2.5 font-semibold pr-2"><div className="truncate">{m.name}</div><div className="t-micro text-ink/40 normal-case tracking-normal font-semibold">{m.n ? `hit target ${m.hit} of ${m.n}` : "no numbers yet"}</div></td>
                        <td className="py-2.5 text-right t-num text-[16px]">{m.last ?? "—"}</td>
                        <td className={`py-2.5 text-right t-num text-[16px] ${m.avg !== null && m.avg < m.target * 0.8 ? "text-coral" : ""}`}>{m.avg === null ? "—" : Math.round(m.avg)}</td>
                        <td className="py-2.5 text-right t-num text-[16px] text-ink/50">{m.target}{m.unit === "seconds" ? "s" : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="t-small text-ink/45 mt-3">Averages are over days the move was logged. Coral means under 80% of target.</div>
              </Card>
            </div>
          )}
        </>
      )}
    </ProShell>
  );
}

function WeekRow({ w, week, dueDays }: { w: number; week: Cell[]; dueDays: number }) {
  const done = week.filter((c) => c.kind === "done" || c.kind === "moved").length;
  const started = week.some((c) => c.kind !== "future");
  return (
    <>
      <div className="flex items-center gap-2 pr-2 whitespace-nowrap"><span className="t-small font-bold text-ink/70">Wk {w + 1}</span>{started && <span className={`t-micro ${done >= dueDays ? "text-ink/40" : "text-ink/40"}`}>{done}/{dueDays}</span>}</div>
      {week.map((c) => {
        const cls = c.kind === "done" ? "bg-lime" : c.kind === "moved" ? "border-2 border-lime" : c.kind === "rest" ? "bg-lime/40" : c.kind === "missed" ? "bg-ink/12" : "border border-dashed border-ink/20";
        return <div key={c.date} title={`${c.date} · ${c.kind}`} className={`h-8 rounded-[7px] ${cls}`} />;
      })}
    </>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return <span className="inline-flex items-center gap-1.5"><span className={`w-3.5 h-3.5 rounded-[4px] ${className}`} />{label}</span>;
}
