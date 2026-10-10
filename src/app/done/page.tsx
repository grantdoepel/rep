"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { MOVEMENT_BY_ID, TRACKS } from "@/lib/content";
import { Avatar, Confetti, CountUp, Icon } from "@/components/ui";
import { Vee } from "@/components/Vee";
import { ProofShot } from "@/components/ProofShot";
import { Reminders } from "@/components/Reminders";
import { NoteOffer } from "@/components/bets/NoteOffer";
import { TestResult } from "@/components/bets/TestResult";
import { CrewDoneLine } from "@/components/bets/CrewDoneLine";

function DoneInner() {
  const s = useStore();
  const q = useSearchParams();
  const xp = Number(q.get("xp") ?? s.lastDone?.xp ?? 0);
  const perfect = q.get("perfect") === "1" || !!s.lastDone?.perfect;
  const crownUps = (q.get("crowns") ?? "").split(",").filter(Boolean);
  const beats = Number(q.get("beats") ?? 0);
  const effort = Number(q.get("moves") ?? s.lastDone?.moves.filter((m) => (m.achieved ?? 0) > 0).length ?? 0);
  const [stage, setStage] = useState(0);
  useEffect(() => { const a = setTimeout(() => setStage(1), 900); const b = setTimeout(() => setStage(2), 1700); return () => { clearTimeout(a); clearTimeout(b); }; }, []);

  const rank = s.league.findIndex((r) => r.isYou) + 1;
  const atRisk = s.friends.find((f) => f.atRisk && !f.doneToday);
  const nudged = atRisk ? s.nudgedToday.includes(atRisk.id) : false;
  const track = s.lastDone?.tracks[0];
  const c = track ? s.crowns[track] : undefined;
  const rows = (s.lastDone?.moves ?? []).map((m) => { const a = m.achieved ?? 0; return { name: MOVEMENT_BY_ID[m.movement]?.name ?? m.movement, a, unit: m.unit, target: m.target, beat: false, last: null as number | null }; });
  // the ledger already holds today's number; "last time" for the verdict is whatever the store compared against — we recompute from the log-free heuristic: beats count from the finish result
  const verdict = effort === 0 ? "Nothing counted. Tomorrow is a fresh page." : perfect ? "Every target. Perfect Set." : beats > 0 ? `Today-you beat yesterday-you on ${beats} of ${rows.length}.` : s.streak.current <= 1 ? "That's the first number in the book." : "Matched yesterday. That still counts.";
  const sub = effort === 0 ? "A Set with no reps logged earns nothing; the streak is untouched." : xp > 0 && s.lastDone?.kind === "rescue" ? "Rescue Set. Half XP, full streak." : `Day ${s.streak.current}. ${crownUps.length ? `Crown up on ${crownUps.map((t) => TRACKS.find((x) => x.id === t)?.name).join(", ")}.` : c ? `${3 - c.clears} more clear${3 - c.clears === 1 ? "" : "s"} for ${TRACKS.find((t) => t.id === track)?.name} Crown ${c.level + 1}.` : ""}`;

  return (
    <div className="screen bg-lime text-ink relative overflow-hidden">
      {effort > 0 && <Confetti />}
      <div className="safe-top px-6 pt-10">
        <div className="flex items-center justify-between">
          <div className="t-micro opacity-65">{s.lastDone?.kind === "rescue" ? "Streak saved" : s.lastDone?.kind === "rest" ? "Rest day kept" : "Set complete"}</div>
          <Vee size={56} mood={effort === 0 ? "worried" : perfect || beats > 0 ? "proud" : "happy"} bob className="-mt-3 -mr-1" />
        </div>
        <div className="display mt-5 flex items-baseline gap-2" style={{ fontSize: 96, letterSpacing: "-0.06em", lineHeight: 1 }}>
          <span>+<CountUp to={xp} /></span><span className="t-h2 display opacity-60">XP</span>
        </div>
        <div className={`display t-h2 mt-5 transition-opacity duration-500 ${stage >= 1 ? "opacity-100" : "opacity-0"}`}>{verdict}</div>
        <div className={`t-body opacity-75 mt-2 transition-opacity duration-500 ${stage >= 2 ? "opacity-75" : "opacity-0"}`}>{sub}</div>
      </div>

      <TestResult />
      {/* the ledger, today's column */}
      <div className={`mx-6 mt-6 transition-opacity duration-500 ${stage >= 2 ? "opacity-100" : "opacity-0"}`}>
        {rows.map((r, idx) => (
          <div key={idx} className="flex items-center justify-between py-2.5 border-t border-ink/12 first:border-t-0">
            <span className="t-body font-semibold">{r.name}</span>
            <span className="t-num text-[18px] flex items-baseline gap-2"><span className="opacity-45 t-small font-semibold">target {r.target}</span><span className={r.a >= r.target ? "" : "opacity-70"}>{r.a}{r.unit === "seconds" ? "s" : ""}</span>{r.a >= r.target && <Icon.Check size={14} />}</span>
          </div>
        ))}
      </div>

      <div className={`mx-6 mt-5 grid grid-cols-3 gap-2 transition-opacity duration-500 ${stage >= 2 ? "opacity-100" : "opacity-0"}`}>
        <div className="bg-ink/8 rounded-[18px] px-3 py-3"><div className="t-num text-[24px] flex items-center gap-1"><Icon.Flame size={16} />{s.streak.current}</div><div className="t-micro opacity-60 mt-1">streak</div></div>
        <div className="bg-ink/8 rounded-[18px] px-3 py-3"><div className="t-num text-[24px]">{rank ? `#${rank}` : "—"}</div><div className="t-micro opacity-60 mt-1 capitalize">{s.leagueTier}</div></div>
        <div className="bg-ink/8 rounded-[18px] px-3 py-3"><div className="t-num text-[24px]">{c?.clears ?? 0}<span className="t-small font-bold opacity-60">/3</span></div><div className="t-micro opacity-60 mt-1">crown {c?.level ?? 1}</div></div>
      </div>

      <div className={`mx-6 mt-4 flex flex-col gap-2.5 transition-opacity duration-500 ${stage >= 2 ? "opacity-100" : "opacity-0"}`}>
        <CrewDoneLine />
        <NoteOffer perfect={perfect} />
        <ProofShot />
        <Reminders compact onDark={false} />
        {atRisk && (
          <button onClick={() => s.nudge(atRisk.id)} disabled={nudged} className={`press w-full rounded-[18px] px-4 py-3 flex items-center gap-3 text-left ${nudged ? "bg-ink/8" : "bg-ink text-text"}`}>
            <Avatar initials={atRisk.displayName.slice(0, 2).toUpperCase()} color={atRisk.color} size={36} />
            <div className="flex-1"><div className="font-bold text-[14px]">{nudged ? `Nudged ${atRisk.displayName.split(" ")[0]} · +5 XP` : `${atRisk.displayName.split(" ")[0]} hasn't moved. Nudge?`}</div><div className={`t-small ${nudged ? "opacity-60" : "text-muted"}`}>{atRisk.streak}-day streak ends at midnight.</div></div>
            {!nudged && <Icon.Send />}
          </button>
        )}
      </div>

      <div className="mt-auto px-6 pb-8 safe-bottom pt-5 flex flex-col gap-2">
        <Link href="/" className="press flex items-center justify-center h-[58px] rounded-2xl bg-ink text-lime font-extrabold text-[17px]">Done for today</Link>
        <Link href="/profile" className="press h-11 flex items-center justify-center font-bold text-[14px] opacity-70">Share day {s.streak.current}</Link>
      </div>
    </div>
  );
}

export default function Done() { return <Suspense fallback={<div className="screen bg-lime" />}><DoneInner /></Suspense>; }
