"use client";
import Link from "next/link";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { TRACKS } from "@/lib/content";
import { addDays, localDate, weekStart } from "@/lib/rules";
import { Avatar, Icon, TopBar, useMounted } from "@/components/ui";

const CELL: Record<string, string> = { perfect: "#C8FF3D", done: "#6E8A1F", rest: "#3D4EFF", frozen: "#3D4EFF", missed: "#2A2D38", future: "#15171E" };

export default function Profile() {
  const s = useStore();
  const mounted = useMounted();
  const [treatOpen, setTreatOpen] = useState(false);
  const [treatText, setTreatText] = useState("");
  const [treatMs, setTreatMs] = useState(30);
  if (!mounted) return <div className="screen" />;
  const today = localDate(new Date(), s.profile.timezone);
  const start = addDays(weekStart(today), -63);
  const weeks = Array.from({ length: 10 }, (_, w) => Array.from({ length: 7 }, (_, d) => { const date = addDays(start, w * 7 + d); const l = s.log.find((x) => x.date === date); return { date, kind: date > today ? "future" : date < s.profile.createdAt.slice(0, 10) ? "future" : l?.kind ?? "missed" }; }));
  const days = s.log.filter((l) => l.kind !== "missed").length;
  const crowns = TRACKS.reduce((a, t) => a + ((s.crowns[t.id]?.level ?? 1) - 1), 0);
  const ms = [7, 30, 100, 365];
  const share = () => navigator.share?.({ title: "uvu", text: `${s.streak.current} days in a row. You vs. you.`, url: location.origin }).catch(() => {});

  return (
    <div className="screen">
      <TopBar title="Profile" right={<Link href="/rest-days" aria-label="Settings" className="w-10 h-10 rounded-full bg-ink-3 flex items-center justify-center"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F4F5F7" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" /></svg></Link>} />
      <div className="px-6 pt-5 flex items-center gap-3.5">
        <Avatar initials={s.profile.displayName.slice(0, 2).toUpperCase()} color="#2A2D38" fg="#C8FF3D" size={68} />
        <div className="flex-1">
          <div className="display text-[24px]">{s.profile.displayName}</div>
          <div className="text-[13px] text-muted font-semibold mt-1">@{s.profile.username} · joined {new Date(s.profile.createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</div>
          <div className="flex gap-1.5 mt-2"><span className="text-[11px] font-bold bg-ink-3 text-sky rounded-full px-2 py-1 capitalize">{s.leagueTier}</span><span className="text-[11px] font-bold bg-ink-3 rounded-full px-2 py-1 capitalize">{s.profile.goalTier} · {s.profile.environment}</span></div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2.5 mx-6 mt-5">
        <div className="bg-ink-3 rounded-[18px] px-3 py-3.5"><div className="flex items-center gap-1"><Icon.Flame size={16} /><span className="display text-[24px]">{s.streak.current}</span></div><div className="text-[11px] text-muted font-semibold mt-0.5">current · best {s.streak.longest}</div></div>
        <div className="bg-ink-3 rounded-[18px] px-3 py-3.5"><div className="display text-[24px]">{crowns}<span className="text-[13px] text-muted">/30</span></div><div className="text-[11px] text-muted font-semibold mt-0.5">crowns</div></div>
        <div className="bg-ink-3 rounded-[18px] px-3 py-3.5"><div className="display text-[24px]">{s.xpTotal.toLocaleString()}</div><div className="text-[11px] text-muted font-semibold mt-0.5">lifetime XP</div></div>
      </div>

      <div className="mx-6 mt-4 bg-ink-3 rounded-[20px] p-4">
        <div className="flex items-center justify-between"><div className="font-bold text-[14px]">Last 10 weeks</div><div className="text-[12px] text-muted font-semibold">{days} day{days === 1 ? "" : "s"} moved</div></div>
        <div className="grid grid-cols-10 gap-[5px] mt-3">{weeks.map((w, i) => <div key={i} className="flex flex-col gap-[5px]">{w.map((d) => <div key={d.date} className="aspect-square rounded-[3px]" style={{ background: CELL[d.kind], outline: d.date === today ? "2px solid #F4F5F7" : undefined, outlineOffset: 1 }} />)}</div>)}</div>
        <div className="flex gap-3 mt-3 text-[11px] text-muted font-semibold">{[["Perfect", "#C8FF3D"], ["Done", "#6E8A1F"], ["Rest", "#3D4EFF"], ["Missed", "#2A2D38"]].map(([n, c]) => <span key={n} className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: c }} />{n}</span>)}</div>
      </div>

      <div className="mx-6 mt-4">
        <div className="text-[11px] font-bold text-muted tracking-[1px] uppercase mb-2.5">Milestones</div>
        <div className="flex gap-2.5">{ms.map((m) => { const got = s.streak.longest >= m; return <div key={m} className="flex-1 bg-ink-3 rounded-2xl p-3 text-center" style={{ opacity: got ? 1 : 0.55 }}><div className={`w-10 h-10 rounded-full mx-auto flex items-center justify-center display text-[13px] ${got ? "bg-lime text-ink" : "border-2 border-dashed border-muted-2 text-muted"}`}>{m}</div><div className="text-[11px] font-bold mt-2">{got ? ["Week one", "A month", "Hundred", "The card"][ms.indexOf(m)] : `${m - s.streak.current} to go`}</div></div>; })}</div>
      </div>

      {s.profile.whyText && <div className="mx-6 mt-4 bg-ink-2 rounded-2xl px-4 py-3 text-[13px] leading-[1.4]"><span className="text-muted font-semibold">Your why · </span><span className="display font-bold text-[14px] text-lime italic">"{s.profile.whyText}"</span></div>}

      <div className="mx-6 mt-3 bg-ink-3 rounded-2xl px-4 py-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFB347" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 12v8H4v-8M2 7h20v5H2zM12 7v13M12 7c-2-4-6-4-6-1s4 1 6 1M12 7c2-4 6-4 6-1s-4 1-6 1" /></svg><div className="font-bold text-[14px]">Treat yourself</div></div>
          <button onClick={() => { setTreatText(s.profile.treatText ?? ""); setTreatMs(s.profile.treatMilestone ?? 30); setTreatOpen(!treatOpen); }} className="text-[12px] font-bold text-lime">{s.profile.treatText ? "Edit" : "Set one"}</button>
        </div>
        {treatOpen ? (
          <div className="mt-3 flex flex-col gap-2">
            <input value={treatText} onChange={(e) => setTreatText(e.target.value)} placeholder="e.g. new running shoes" className="h-11 rounded-xl bg-ink border-[1.5px] border-ink-4 px-3.5 text-[14px] outline-none focus:border-lime" />
            <div className="flex gap-1.5">{[7, 30, 100, 365].map((m) => <button key={m} onClick={() => setTreatMs(m)} className={`flex-1 h-9 rounded-full text-[12px] font-bold ${treatMs === m ? "bg-lime text-ink" : "bg-ink text-muted"}`}>{m} days</button>)}</div>
            <button onClick={() => { s.setTreat(treatText.trim(), treatMs); setTreatOpen(false); }} className="h-11 rounded-xl bg-lime text-ink font-extrabold text-[14px]">Save</button>
          </div>
        ) : s.profile.treatText ? (
          <div className="mt-2 text-[13px] leading-[1.4]"><span className="display text-[14px] text-amber">{s.profile.treatText}</span> <span className="text-muted">at {s.profile.treatMilestone} days · {s.streak.longest >= (s.profile.treatMilestone ?? 0) ? "earned. Go get it." : `${(s.profile.treatMilestone ?? 0) - s.streak.current} to go`}</span></div>
        ) : (
          <div className="mt-2 text-[12px] text-muted leading-[1.4]">A real-world reward you name now and claim at a streak milestone. The mascot gets an outfit; you get the thing.</div>
        )}
      </div>

      <div className="mt-auto px-6 pb-8 safe-bottom pt-5 flex flex-col gap-2.5">
        <button onClick={share} className="h-12 rounded-[14px] border-[1.5px] border-ink-4 font-bold text-[14px]">Share my {s.streak.current}-day card</button>
        <button onClick={() => { if (confirm("Reset everything on this device?")) s.reset(); }} className="h-10 text-[12px] text-muted-2 font-semibold">Reset local data</button>
      </div>
    </div>
  );
}
