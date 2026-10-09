"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { dayOfWeek, localDate } from "@/lib/rules";
import { Avatar, TopBar, useMounted } from "@/components/ui";

export default function Crew() {
  const s = useStore();
  const mounted = useMounted();
  const router = useRouter();
  const [rallied, setRallied] = useState<string[]>([]);
  if (!mounted) return <div className="screen" />;
  const today = localDate(new Date(), s.profile.timezone);
  const daysLeft = 7 - ((dayOfWeek(today) + 6) % 7);
  const members = [{ id: "you", name: "You", sets: Math.min(6, s.log.filter((l) => l.kind !== "missed").slice(-7).length), color: "#0C0D11", fg: "#C8FF3D", sub: `${s.streak.current} streak` }, ...s.friends.map((f) => ({ id: f.id, name: f.displayName.split(" ")[0], sets: f.atRisk ? 2 : 4 + (f.streak % 3), color: f.color, fg: "#F4F5F7", sub: f.movingNow ? "Moving now" : f.id === "f_priya" ? `Captain · ${f.streak} streak` : `${f.streak} streak`, atRisk: f.atRisk && !f.doneToday }))];
  const total = members.reduce((a, m) => a + m.sets, 0) + 22; const goal = 54;
  const moving = s.friends.filter((f) => f.movingNow);

  return (
    <div className="screen">
      <TopBar title="Crew" back="/friends" right={<button aria-label="Invite" onClick={() => navigator.share?.({ title: "Tuesday Crew on Rep", url: location.origin + "/?crew=tuesday" }).catch(() => {})} className="w-10 h-10 rounded-full bg-lime flex items-center justify-center"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0C0D11" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg></button>} />
      <div className="px-6 pt-5"><div className="flex items-center gap-2"><div className="display text-[30px]">Tuesday Crew</div><span className="text-[11px] font-bold bg-ink-3 text-muted rounded-full px-2 py-1">9 of 12</span></div><div className="text-[13px] text-muted mt-1.5 font-medium">One weekly goal. Everyone's Set counts. Nobody gets left behind.</div></div>

      <div className="mx-6 mt-4 bg-ink-3 rounded-[22px] p-[18px]">
        <div className="flex items-end justify-between"><div><div className="text-[11px] font-bold text-lime tracking-[1.5px] uppercase">Crew goal · this week</div><div className="display text-[34px] mt-1.5">{total} <span className="text-[16px] text-muted font-sans font-semibold">/ {goal} Sets</span></div></div><div className="text-right"><div className="text-[12px] text-muted font-semibold">{daysLeft} days left</div><div className="text-[13px] text-lime font-bold">{total / goal >= (8 - daysLeft) / 7 ? "Ahead of pace" : "Behind pace"}</div></div></div>
        <div className="mt-3.5 h-2.5 rounded-full bg-ink-4 overflow-hidden"><div className="a-grow h-2.5 rounded-full bg-lime" style={{ width: `${Math.min(100, (total / goal) * 100)}%` }} /></div>
        <div className="text-[12px] text-muted mt-2 leading-[1.4]">Goal = 6 Sets per person. Hit it and everyone gets a crew badge and 150 gems. Miss it and nobody does.</div>
      </div>

      {moving.length > 0 && <div className="mx-6 mt-3.5 bg-lime/6 border-[1.5px] border-lime/25 rounded-2xl px-3.5 py-3 flex items-center gap-2.5"><div className="w-2 h-2 rounded-full bg-lime a-blink" /><div className="flex-1 text-[13px]"><span className="font-bold">{moving.map((f) => f.displayName.split(" ")[0]).join(" and ")}</span> <span className="text-muted">mid-Set right now</span></div><button onClick={() => { s.startSet("normal"); router.push("/set"); }} className="text-[12px] font-bold text-lime">Join →</button></div>}

      <div className="flex flex-col gap-1.5 px-6 pt-4 pb-5">
        <div className="text-[11px] font-bold text-muted tracking-[1px] uppercase pb-1">This week</div>
        {members.map((m) => (
          <div key={m.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-[14px] bg-ink-3 ${"atRisk" in m && m.atRisk ? "border-[1.5px] border-coral" : ""}`}>
            <Avatar initials={m.name.slice(0, 2).toUpperCase()} color={m.color} fg={m.fg} />
            <div className="flex-1"><div className="font-bold text-[14px]">{m.name}</div><div className={`text-[11px] font-semibold ${"atRisk" in m && m.atRisk ? "text-coral" : m.sub === "Moving now" ? "text-lime" : "text-muted"}`}>{"atRisk" in m && m.atRisk ? `${m.sets} Sets · needs ${6 - m.sets} in ${daysLeft} days` : m.sub}</div></div>
            {"atRisk" in m && m.atRisk ? <button onClick={() => setRallied([...rallied, m.id])} disabled={rallied.includes(m.id)} className={`h-[34px] px-3 rounded-full font-extrabold text-[12px] ${rallied.includes(m.id) ? "bg-ink-4 text-muted" : "bg-coral text-ink"}`}>{rallied.includes(m.id) ? "Rallied" : "Rally"}</button> : <div className="flex gap-[3px]">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="w-2.5 h-[18px] rounded-[3px]" style={{ background: i < m.sets ? "#C8FF3D" : "#2A2D38" }} />)}</div>}
          </div>
        ))}
      </div>
      <div className="mt-auto px-6 pb-8 safe-bottom"><div className="text-[12px] text-muted-2 text-center leading-[1.4]">Crew chat and streak saves arrive with accounts.</div></div>
    </div>
  );
}
