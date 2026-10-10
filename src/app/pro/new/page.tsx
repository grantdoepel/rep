"use client";
// /pro/new: write a plan. Org name the first time, then name, 3-5 moves, weeks, days a week. Ends with the link.
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { MOVEMENTS } from "@/lib/content";
import { becomePrescriber, createPlan } from "@/lib/plans";
import { track } from "@/lib/analytics";
import { Card, ProGate, ProShell, proBtn, proHref, useProState } from "../pro-ui";

type Row = { key: number; id?: string; name: string; target: number; unit: "reps" | "seconds"; cue: string; custom: boolean };
const blank = (key: number): Row => ({ key, name: "", target: 10, unit: "reps", cue: "", custom: false });

export default function NewPlan() {
  const st = useProState();
  const [org, setOrg] = useState("");
  const [name, setName] = useState("");
  const [rows, setRows] = useState<Row[]>([blank(1), blank(2), blank(3)]);
  const [weeks, setWeeks] = useState(6);
  const [days, setDays] = useState(5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");
  useEffect(() => { setOrigin(window.location.origin); }, []);
  useEffect(() => { if (st.prescriber) setOrg(st.prescriber.orgName); }, [st.prescriber]);

  const needsOrg = !st.prescriber;
  const valid = rows.every((r) => r.name.trim() && r.target >= 1) && name.trim() && (!needsOrg || org.trim());

  const update = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const remove = (key: number) => setRows((rs) => (rs.length > 3 ? rs.filter((r) => r.key !== key) : rs));
  const add = () => setRows((rs) => (rs.length < 5 ? [...rs, blank(Math.max(...rs.map((r) => r.key)) + 1)] : rs));

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true); setError(null);
    if (st.demo) { setCode("7f3a9c2e1b"); setBusy(false); return; }
    if (needsOrg) { const r = await becomePrescriber(org.trim()); if (!r.ok) { setError(r.error ?? "Couldn't save the clinic name."); setBusy(false); return; } }
    const r = await createPlan({ name: name.trim(), weeks, days, moves: rows.map((m) => ({ id: m.custom ? undefined : m.id, name: m.name.trim(), target: m.target, unit: m.unit, cue: m.cue.trim() || undefined })) });
    if (!r.ok || !r.code) { setError(r.error ?? "Couldn't create the plan."); setBusy(false); return; }
    track("plan_created", { moves: rows.length, weeks, days, custom: rows.filter((m) => m.custom).length });
    setCode(r.code); setBusy(false);
    st.reload().catch(() => {});
  };

  const link = code ? `${origin}/plan?c=${code}` : "";
  const copy = async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch {} };

  if (!st.ready) return <ProShell state={st}><div className="h-40" /></ProShell>;
  if (!st.online) return <ProShell state={st} title="New plan" back="/pro"><ProGate state={st} what="the plan editor" /></ProShell>;

  if (code) {
    return (
      <ProShell state={st} title="Plan created" back="/pro">
        <div className="mt-6 max-w-[560px]">
          <div className="t-body text-ink/65">Send this link to your patient. They sign in, see what you will see, and say yes. Their next Set is yours.</div>
          <Card className="mt-5 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <code className="flex-1 text-[14px] break-all font-semibold">{link}</code>
            <button onClick={copy} className={`${proBtn.ink} shrink-0`}>{copied ? "Copied" : "Copy"}</button>
          </Card>
          <div className="t-small text-ink/50 mt-3">Code <span className="font-bold text-ink">{code}</span>. The same link works for every patient on this plan.</div>
          <div className="flex gap-3 mt-8">
            <Link href={proHref("/pro", st.demo)} className={proBtn.primary}>Back to patients</Link>
            <button onClick={() => { setCode(null); setName(""); setRows([blank(1), blank(2), blank(3)]); }} className={proBtn.ghost}>Write another</button>
          </div>
        </div>
      </ProShell>
    );
  }

  return (
    <ProShell state={st} title="New plan" back="/pro">
      <div className="grid gap-8 lg:grid-cols-[1fr_300px] mt-6 items-start">
        <div className="flex flex-col gap-7">
          {needsOrg && (
            <Field label="Your clinic or practice" hint="Patients see this name on the consent screen and above their Set.">
              <input value={org} onChange={(e) => setOrg(e.target.value)} placeholder="Northside Physio" className={proBtn.field} />
            </Field>
          )}
          <Field label="Plan name" hint="For you and the patient, so a second plan is not confused with the first.">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Knee rehab · phase 2" className={proBtn.field} />
          </Field>

          <div>
            <div className="flex items-end justify-between pb-2">
              <div className="t-micro text-ink/50">Moves · {rows.length} of 5</div>
              {rows.length < 5 && <button onClick={add} className="t-small font-bold text-ink min-h-[44px] -my-2">Add a move</button>}
            </div>
            <div className="flex flex-col gap-3">
              {rows.map((r, i) => <MoveRow key={r.key} row={r} index={i} onChange={(p) => update(r.key, p)} onRemove={rows.length > 3 ? () => remove(r.key) : undefined} />)}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Stepper label="Weeks" value={weeks} min={1} max={12} onChange={setWeeks} />
            <Stepper label="Days a week" value={days} min={1} max={7} onChange={setDays} />
          </div>

          {error && <div className="t-small text-coral font-bold">{error}</div>}
          <div className="flex items-center gap-4">
            <button onClick={submit} disabled={!valid || busy} className={proBtn.primary}>{busy ? "Creating" : "Create"}</button>
            <span className="t-small text-ink/50">You get a link to send. Nothing is shared until the patient says yes.</span>
          </div>
        </div>

        <Preview rows={rows} clinic={org || "Your clinic"} weeks={weeks} />
      </div>
    </ProShell>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="block"><div className="t-micro text-ink/50 pb-2">{label}</div>{children}{hint && <div className="t-small text-ink/45 mt-1.5">{hint}</div>}</label>;
}

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <div>
      <div className="t-micro text-ink/50 pb-2">{label}</div>
      <div className="inline-flex items-center rounded-2xl border-[1.5px] border-ink/15 bg-white overflow-hidden">
        <button aria-label={`Fewer ${label.toLowerCase()}`} onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} className="press w-12 h-12 text-[20px] font-bold disabled:opacity-30">−</button>
        <span className="t-num text-[20px] w-10 text-center">{value}</span>
        <button aria-label={`More ${label.toLowerCase()}`} onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} className="press w-12 h-12 text-[20px] font-bold disabled:opacity-30">+</button>
      </div>
    </div>
  );
}

function MoveRow({ row, index, onChange, onRemove }: { row: Row; index: number; onChange: (p: Partial<Row>) => void; onRemove?: () => void }) {
  const [q, setQ] = useState(row.name);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { const f = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); }; document.addEventListener("mousedown", f); return () => document.removeEventListener("mousedown", f); }, []);
  const matches = useMemo(() => { const t = q.trim().toLowerCase(); if (!t) return MOVEMENTS.slice(0, 8); return MOVEMENTS.filter((m) => m.name.toLowerCase().includes(t)).slice(0, 8); }, [q]);
  const pick = (m: (typeof MOVEMENTS)[number]) => { setQ(m.name); onChange({ id: m.id, name: m.name, unit: m.unit, custom: false, cue: "" }); setOpen(false); };
  const pickCustom = () => { const n = q.trim(); if (!n) return; onChange({ id: undefined, name: n, custom: true }); setOpen(false); };
  const exact = MOVEMENTS.find((m) => m.name.toLowerCase() === q.trim().toLowerCase());

  return (
    <Card className="p-3 sm:p-4">
      <div className="flex gap-3 items-start">
        <div className="t-num text-[15px] text-ink/35 w-5 pt-3 shrink-0">{index + 1}</div>
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          <div ref={box} className="relative">
            <input value={q} onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true); onChange({ name: e.target.value, id: undefined, custom: true }); }} placeholder="Search a move, or type your own" className={proBtn.field} aria-label={`Move ${index + 1}`} />
            {row.name && <span className={`absolute right-3 top-1/2 -translate-y-1/2 t-micro ${row.custom ? "text-coral" : "text-ink/45"}`}>{row.custom ? "Custom" : "Catalog"}</span>}
            {open && (
              <div className="absolute z-10 left-0 right-0 mt-1 rounded-xl bg-white border border-ink/15 shadow-lg overflow-hidden max-h-[280px] overflow-y-auto">
                {matches.map((m) => <button key={m.id} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(m)} className="w-full text-left px-3.5 py-2.5 text-[14px] hover:bg-ink/5 flex items-center justify-between"><span className="font-semibold">{m.name}</span><span className="t-micro text-ink/40">{m.track} · {m.unit}</span></button>)}
                {q.trim() && !exact && <button onMouseDown={(e) => e.preventDefault()} onClick={pickCustom} className="w-full text-left px-3.5 py-2.5 text-[14px] hover:bg-ink/5 border-t border-ink/10"><span className="font-semibold">Custom: {q.trim()}</span><span className="t-micro text-ink/40 ml-2">name it and set the unit</span></button>}
                {matches.length === 0 && !q.trim() && <div className="px-3.5 py-2.5 t-small text-ink/45">Type to search the catalog.</div>}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <label className="flex items-center gap-2"><span className="t-micro text-ink/50">Target</span><input type="number" min={1} max={600} value={row.target} onChange={(e) => onChange({ target: Math.max(0, Math.min(600, Number(e.target.value) || 0)) })} className={`${proBtn.field} w-24 h-11 text-center t-num text-[16px]`} aria-label={`Target for move ${index + 1}`} /></label>
            <div className="inline-flex rounded-xl border-[1.5px] border-ink/15 overflow-hidden bg-white" role="radiogroup" aria-label="Unit">
              {(["reps", "seconds"] as const).map((u) => <button key={u} role="radio" aria-checked={row.unit === u} disabled={!row.custom && !!row.id} onClick={() => onChange({ unit: u })} className={`h-11 px-3.5 text-[13px] font-bold ${row.unit === u ? "bg-ink text-text" : "text-ink/60"} disabled:cursor-default`}>{u}</button>)}
            </div>
            {onRemove && <button onClick={onRemove} className="ml-auto t-small font-bold text-ink/45 min-h-[44px] px-2">Remove</button>}
          </div>
          {row.custom && row.name && <input value={row.cue} onChange={(e) => onChange({ cue: e.target.value })} placeholder="One-line cue the patient hears (optional)" className={`${proBtn.field} h-11 text-[14px]`} maxLength={200} />}
        </div>
      </div>
    </Card>
  );
}

/** What the patient's Set card will look like on Home. Same ink-on-lime card as the app. */
function Preview({ rows, clinic, weeks }: { rows: Row[]; clinic: string; weeks: number }) {
  return (
    <div className="lg:sticky lg:top-6">
      <div className="t-micro text-ink/50 pb-2">What the patient sees</div>
      <div className="rounded-[26px] bg-ink p-4 max-w-[340px]">
        <div className="t-micro text-muted px-1 pb-3 truncate">From {clinic} · week 1 of {weeks}</div>
        <div className="rounded-[22px] p-4 bg-lime text-ink">
          <div className="flex items-center justify-between"><span className="t-micro opacity-70">Today&apos;s Set · 3 min</span><span className="t-micro opacity-70">+{rows.length * 20} XP</span></div>
          <div className="mt-3 flex flex-col">
            <div className="flex justify-between t-micro opacity-60 pb-1.5"><span>Move</span><span>last time → today</span></div>
            {rows.map((m) => (
              <div key={m.key} className="flex items-center justify-between py-2 border-t border-ink/10">
                <span className="t-body font-semibold truncate pr-3">{m.name.trim() || <span className="opacity-40">Move {m.key}</span>}</span>
                <span className="t-num text-[17px] flex items-baseline gap-1.5 shrink-0"><span className="opacity-45 t-small font-semibold">first time</span><span className="opacity-45">→</span><span>{m.target || 0}<span className="t-small font-semibold opacity-60 ml-0.5">{m.unit === "seconds" ? "s" : ""}</span></span></span>
              </div>
            ))}
          </div>
          <div className="mt-4 h-12 rounded-2xl bg-ink text-text font-extrabold text-[16px] flex items-center justify-center gap-2"><svg width="16" height="16" viewBox="0 0 24 24" fill="#C8FF3D" aria-hidden="true"><path d="M7 4l13 8-13 8z" /></svg>Start</div>
        </div>
      </div>
    </div>
  );
}
