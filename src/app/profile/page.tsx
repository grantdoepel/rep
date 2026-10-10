"use client";
import Link from "next/link";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { MOVEMENT_BY_ID, TRACKS } from "@/lib/content";
import { addDays, localDate, weekStart } from "@/lib/rules";
import { Avatar, Icon, Section, TopBar, useMounted } from "@/components/ui";
import { CHAIR_STAND, shortMonthYear, useTestSeries } from "@/lib/tests";

const CELL: Record<string, string> = { perfect: "#C8FF3D", done: "#6E8A1F", rest: "#3D4EFF", frozen: "#3D4EFF", missed: "#262A35", future: "#13151B" };

export default function Profile() {
  const s = useStore();
  const mounted = useMounted();
  const [treatOpen, setTreatOpen] = useState(false);
  const [treatText, setTreatText] = useState("");
  const [treatMs, setTreatMs] = useState(30);
  const testSeries = useTestSeries(s.ledger);   // PRD 7
  if (!mounted) return <div className="screen" />;
  const today = localDate(new Date(), s.profile.timezone);
  const joined = s.profile.createdAt.slice(0, 10);
  const daysIn = Math.max(1, Math.round((new Date(today).getTime() - new Date(joined).getTime()) / 86400000) + 1);
  const young = daysIn <= 30;
  const days = s.log.filter((l) => l.kind !== "missed").length;
  const crowns = TRACKS.reduce((a, t) => a + ((s.crowns[t.id]?.level ?? 1) - 1), 0);
  const nextMs = [7, 30, 100, 365].find((m) => m > s.streak.longest) ?? 365;
  const share = () => navigator.share?.({ title: "uvu", text: `${s.streak.current} days in a row. You vs. you.`, url: location.origin }).catch(() => {});
  // first 30 days: a strip, not a grid. Later: the 10-week grid.
  const strip = Array.from({ length: 30 }, (_, i) => { const date = addDays(joined, i); const l = s.log.find((x) => x.date === date); return { date, kind: date > today ? "future" : l?.kind ?? "missed" }; });
  const start = addDays(weekStart(today), -63);
  const weeks = Array.from({ length: 10 }, (_, w) => Array.from({ length: 7 }, (_, d) => { const date = addDays(start, w * 7 + d); const l = s.log.find((x) => x.date === date); return { date, kind: date > today ? "future" : date < joined ? "future" : l?.kind ?? "missed" }; }));
  // personal bests from the ledger
  const lastTest = testSeries[testSeries.length - 1];
  const bests = Object.entries(s.recent).filter(([id]) => id !== CHAIR_STAND.id).map(([id, r]) => ({ id, name: MOVEMENT_BY_ID[id]?.name ?? id, unit: MOVEMENT_BY_ID[id]?.unit ?? "reps", ...r })).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);

  return (
    <div className="screen">
      <TopBar title="Profile" right={<Link href="/rest-days" aria-label="Settings" className="press w-11 h-11 rounded-full flex items-center justify-center"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F4F5F7" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" /></svg></Link>} />
      <div className="px-6 pt-4 flex items-center gap-4">
        <Avatar initials={s.profile.displayName.slice(0, 2).toUpperCase()} color="#1A1C24" fg="#C8FF3D" size={64} />
        <div className="flex-1 min-w-0">
          <div className="display t-h2 truncate">{s.profile.displayName}</div>
          <div className="t-small text-muted mt-1">@{s.profile.username} · day {daysIn} · <span className="capitalize">{s.leagueTier}</span> · <span className="capitalize">{s.profile.goalTier}</span></div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mx-6 mt-5">
        <div><div className="t-num text-[28px] flex items-center gap-1"><Icon.Flame size={18} />{s.streak.current}</div><div className="t-micro text-muted-2 mt-0.5">streak · best {s.streak.longest}</div></div>
        <div><div className="t-num text-[28px]">{crowns}<span className="t-small font-bold text-muted-2">/30</span></div><div className="t-micro text-muted-2 mt-0.5">crowns</div></div>
        <div><div className="t-num text-[28px]">{s.xpTotal.toLocaleString()}</div><div className="t-micro text-muted-2 mt-0.5">lifetime XP</div></div>
      </div>

      <Section title={young ? "First 30 days" : "Last 10 weeks"} right={<span className="t-small text-muted-2 font-semibold">{days} day{days === 1 ? "" : "s"} moved</span>} className="mt-5">
        {young ? (
          <div className="grid grid-cols-10 gap-[6px]">{strip.map((d, i) => <div key={d.date} className="aspect-square rounded-[6px] flex items-center justify-center" style={{ background: CELL[d.kind], outline: d.date === today ? "2px solid #F4F5F7" : undefined, outlineOffset: 1 }}>{d.kind === "future" && <span className="t-micro text-muted-2" style={{ fontSize: 9 }}>{i + 1}</span>}</div>)}</div>
        ) : (
          <div className="grid grid-cols-10 gap-[5px]">{weeks.map((w, i) => <div key={i} className="flex flex-col gap-[5px]">{w.map((d) => <div key={d.date} className="aspect-square rounded-[3px]" style={{ background: CELL[d.kind], outline: d.date === today ? "2px solid #F4F5F7" : undefined, outlineOffset: 1 }} />)}</div>)}</div>
        )}
        <div className="flex gap-3 mt-3 t-micro text-muted-2" style={{ fontSize: 10 }}>{[["Perfect", "#C8FF3D"], ["Done", "#6E8A1F"], ["Rest", "#3D4EFF"], ["Missed", "#262A35"]].map(([n, c]) => <span key={n} className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: c }} />{n}</span>)}</div>
      </Section>

      <Section title="Next milestone" className="mt-4">
        <div className="flex items-center gap-4">
          <div className="t-num text-[40px]">{nextMs}</div>
          <div className="flex-1"><div className="h-2 rounded-full bg-ink-4 overflow-hidden"><div className="a-grow h-2 bg-lime" style={{ width: `${Math.min(100, (s.streak.current / nextMs) * 100)}%` }} /></div><div className="t-small text-muted mt-1.5">{nextMs - s.streak.current} day{nextMs - s.streak.current === 1 ? "" : "s"} to {nextMs === 7 ? "week one" : nextMs === 30 ? "a month" : nextMs === 100 ? "a hundred" : "the year"}{s.profile.treatText && s.profile.treatMilestone === nextMs ? ` · ${s.profile.treatText}` : ""}</div></div>
        </div>
      </Section>

      {(bests.length > 0 || lastTest) && (
        <Section title="Your numbers" right={<span className="t-small text-muted-2 font-semibold">last time</span>} className="mt-4">
          <div className="flex flex-col">{bests.map((b) => <div key={b.id} className="flex items-center justify-between py-2 border-t border-hair first:border-t-0"><span className="t-body font-semibold">{b.name}</span><span className="t-num text-[17px]">{b.achieved}{b.unit === "seconds" ? "s" : ""}</span></div>)}
            {lastTest && <div className="flex items-center justify-between py-2 border-t border-hair first:border-t-0"><span className="t-body font-semibold">Last Test</span><span className="t-num text-[17px]">{lastTest.achieved}<span className="t-small text-muted-2 font-semibold ml-1.5">· {shortMonthYear(lastTest.date)}</span></span></div>}
          </div>
        </Section>
      )}

      {s.profile.whyText && <div className="mx-6 mt-5 t-small"><span className="text-muted-2">Your why · </span><span className="display text-[14px] text-lime">"{s.profile.whyText}"</span></div>}

      <Section title="Treat yourself" right={<button onClick={() => { setTreatText(s.profile.treatText ?? ""); setTreatMs(s.profile.treatMilestone ?? 30); setTreatOpen(!treatOpen); }} className="press t-small font-bold text-lime">{s.profile.treatText ? "Edit" : "Set one"}</button>} className="mt-4">
        {treatOpen ? (
          <div className="flex flex-col gap-2">
            <input value={treatText} onChange={(e) => setTreatText(e.target.value)} placeholder="e.g. new running shoes" aria-label="Your treat" className="h-11 rounded-xl bg-ink-3 border-[1.5px] border-ink-4 px-3.5 text-[14px] outline-none focus:border-lime" />
            <div className="flex gap-1.5">{[7, 30, 100, 365].map((m) => <button key={m} onClick={() => setTreatMs(m)} className={`flex-1 h-9 rounded-full text-[12px] font-bold ${treatMs === m ? "bg-lime text-ink" : "bg-ink-3 text-muted"}`}>{m} days</button>)}</div>
            <button onClick={() => { s.setTreat(treatText.trim(), treatMs); setTreatOpen(false); }} className="press h-11 rounded-xl bg-lime text-ink font-extrabold text-[14px]">Save</button>
          </div>
        ) : s.profile.treatText ? (
          <div className="t-small leading-[1.4]"><span className="display text-[14px] text-amber">{s.profile.treatText}</span> <span className="text-muted">at {s.profile.treatMilestone} days · {s.streak.longest >= (s.profile.treatMilestone ?? 0) ? "earned. Go get it." : `${(s.profile.treatMilestone ?? 0) - s.streak.current} to go`}</span></div>
        ) : (
          <div className="t-small text-muted leading-[1.4]">A real reward you name now and claim at a streak milestone. Make it something you'd feel bad buying otherwise.</div>
        )}
      </Section>

      <div className="mt-auto px-6 pb-8 safe-bottom pt-6 flex flex-col gap-2.5">
        <button onClick={share} className="press h-12 rounded-[14px] border-[1.5px] border-ink-4 font-bold text-[14px]">Share day {s.streak.current}</button>
        <button onClick={() => { if (confirm("Reset everything on this device?")) s.reset(); }} className="h-10 t-small text-muted-2 font-semibold">Reset local data</button>
      </div>
    </div>
  );
}
