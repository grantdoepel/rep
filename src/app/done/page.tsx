"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useStore } from "@/lib/store";
import { TRACKS } from "@/lib/content";
import { Avatar, Confetti, Icon } from "@/components/ui";

function DoneInner() {
  const s = useStore();
  const q = useSearchParams();
  const xp = Number(q.get("xp") ?? s.lastDone?.xp ?? 0);
  const perfect = q.get("perfect") === "1" || !!s.lastDone?.perfect;
  const crownUps = (q.get("crowns") ?? "").split(",").filter(Boolean);
  const rank = s.league.findIndex((r) => r.isYou) + 1;
  const atRisk = s.friends.find((f) => f.atRisk && !f.doneToday);
  const nudged = atRisk ? s.nudgedToday.includes(atRisk.id) : false;
  const track = s.lastDone?.tracks[0];
  const c = track ? s.crowns[track] : undefined;

  return (
    <div className="screen bg-lime text-ink relative overflow-hidden">
      <Confetti />
      <div className="safe-top px-6 pt-12">
        <div className="a-rise text-[13px] font-extrabold tracking-[1.5px] uppercase opacity-65">{s.lastDone?.kind === "rescue" ? "Streak saved" : s.lastDone?.kind === "rest" ? "Rest day kept" : "Set complete"}</div>
        <div className="a-rise d1 display text-[72px] mt-2.5 leading-[.95]">+{xp}<br /><span className="text-[40px]">XP</span></div>
        <div className="a-rise d2 text-[15px] font-semibold mt-3 opacity-80">{perfect ? "Perfect Set bonus included. Every target hit." : "Every move counts. Targets are tomorrow's problem."}</div>
      </div>

      <div className="a-rise d2 grid grid-cols-3 gap-2.5 mx-6 mt-6">
        <div className="bg-ink text-text rounded-[18px] px-3 py-3.5"><div className="flex items-center gap-1"><Icon.Flame size={18} className="a-flicker" /><span className="display text-[26px]">{s.streak.current}</span></div><div className="text-[11px] text-muted font-semibold mt-1">day streak</div></div>
        <div className="bg-ink text-text rounded-[18px] px-3 py-3.5"><div className="display text-[26px]">#{rank}</div><div className="text-[11px] text-muted font-semibold mt-1 capitalize">{s.leagueTier} league</div></div>
        <div className="bg-ink text-text rounded-[18px] px-3 py-3.5"><div className="display text-[26px]">{c?.clears ?? 0}<span className="text-[14px] text-muted">/3</span></div><div className="text-[11px] text-muted font-semibold mt-1">{track ? TRACKS.find((t) => t.id === track)?.name : ""} Crown {c?.level ?? 1}</div></div>
      </div>

      {crownUps.length > 0 ? (
        <div className="a-rise d3 mx-6 mt-3.5 bg-ink/8 rounded-[18px] px-4 py-3.5 flex items-center gap-3.5"><Icon.Crown size={40} color="#0C0D11" /><div><div className="font-extrabold text-[15px]">Crown up: {crownUps.map((t) => TRACKS.find((x) => x.id === t)?.name).join(", ")}</div><div className="text-[13px] opacity-70 mt-0.5">+25 gems each. The tree just got taller.</div></div></div>
      ) : c && (
        <div className="a-rise d3 mx-6 mt-3.5 bg-ink/8 rounded-[18px] px-4 py-3.5 flex items-center gap-3.5"><Icon.Crown size={40} color="#0C0D11" /><div><div className="font-extrabold text-[15px]">{3 - c.clears} more clear{3 - c.clears === 1 ? "" : "s"} for {TRACKS.find((t) => t.id === track)?.name} Crown {c.level + 1}</div><div className="text-[13px] opacity-70 mt-0.5">On different days. Tomorrow works.</div></div></div>
      )}

      {atRisk && (
        <div className="a-rise d4 mx-6 mt-3.5 bg-ink text-text rounded-[22px] p-4">
          <div className="flex items-center gap-3"><Avatar initials={atRisk.displayName.slice(0, 2).toUpperCase()} color={atRisk.color} size={44} /><div className="flex-1"><div className="font-bold text-[15px]">{atRisk.displayName.split(" ")[0]} hasn't moved today</div><div className="text-[13px] text-muted mt-0.5">A {atRisk.streak}-day streak ends at midnight.</div></div></div>
          <button onClick={() => s.nudge(atRisk.id)} disabled={nudged} className={`mt-3.5 w-full h-[50px] rounded-[14px] font-extrabold text-[15px] flex items-center justify-center gap-2 ${nudged ? "bg-ink-4 text-muted" : "bg-lime text-ink"}`}><Icon.Send />{nudged ? 'Sent · "Keep your Rep" · +5 XP' : `Nudge ${atRisk.displayName.split(" ")[0]}`}</button>
        </div>
      )}

      <div className="mt-auto px-6 pb-8 safe-bottom pt-5 flex flex-col gap-2.5">
        <Link href="/" className="flex items-center justify-center h-[58px] rounded-2xl bg-ink text-lime font-extrabold text-[17px]">Done for today</Link>
        <Link href="/profile" className="h-11 flex items-center justify-center font-bold text-[14px] opacity-70">Share the {s.streak.current}-day card</Link>
      </div>
    </div>
  );
}

export default function Done() { return <Suspense fallback={<div className="screen bg-lime" />}><DoneInner /></Suspense>; }
