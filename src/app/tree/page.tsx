"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { CROWN_LEVELS, MOVEMENT_BY_ID, TRACKS } from "@/lib/content";
import type { Environment, Tier, Track } from "@/lib/types";
import { Icon, TabBar } from "@/components/ui";

const TIERS: Tier[] = ["foundation", "standard", "advanced"];

export default function Tree() {
  const s = useStore();
  const [open, setOpen] = useState<Track>("push");
  const env = s.profile.environment;
  const total = TRACKS.reduce((a, t) => a + ((s.crowns[t.id]?.level ?? 1) - 1), 0) + TRACKS.filter((t) => (s.crowns[t.id]?.level ?? 1) >= 5).length;
  const setEnv = (e: Environment) => s.updateProfile({ environment: e });
  const cycleTier = () => s.updateProfile({ tier: TIERS[(TIERS.indexOf(s.profile.tier) + 1) % 3] });

  return (
    <div className="screen">
      <div className="safe-top px-6 pt-10">
        <div className="display text-[30px]">Your tree</div>
        <div className="text-[13px] text-muted mt-1.5 font-medium">{total} of 30 crowns · same tree, wherever you train</div>
      </div>
      <div className="flex items-center gap-2.5 px-6 pt-4">
        <div className="flex bg-ink-3 rounded-full p-1 flex-1">{(["home", "gym", "travel"] as const).map((e) => <button key={e} onClick={() => setEnv(e)} className={`flex-1 h-[38px] rounded-full font-bold text-[13px] capitalize ${env === e ? "bg-lime text-ink" : "text-muted"}`}>{e}</button>)}</div>
        <button onClick={cycleTier} className="h-[46px] px-3.5 rounded-full border-[1.5px] border-ink-4 text-lime font-bold text-[13px] capitalize whitespace-nowrap">{s.profile.tier}</button>
      </div>

      <div className="flex flex-col gap-2.5 px-6 pt-4 pb-5">
        {TRACKS.map((t) => {
          const c = s.crowns[t.id] ?? { level: 1, clears: 0, misses: 0 };
          const lvl = CROWN_LEVELS.find((l) => l.track === t.id && l.level === c.level)!;
          const reqs = env === "gym" ? lvl.gym : lvl.requirements;
          const isOpen = open === t.id;
          return (
            <div key={t.id} className={`bg-ink-3 rounded-[20px] p-4 ${isOpen ? "border-[1.5px] border-lime" : ""}`}>
              <button onClick={() => setOpen(t.id)} className="w-full flex items-center justify-between text-left">
                <div className="flex items-center gap-2.5">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isOpen ? "bg-lime" : "bg-ink-4"}`}><Icon.Crown size={18} color={isOpen ? "#0C0D11" : "#F4F5F7"} filled={false} /></div>
                  <div><div className="font-extrabold text-[16px]">{t.name}</div><div className="text-[12px] text-muted font-semibold">Crown {c.level} · {c.level >= 5 && c.clears >= 3 ? "maxed" : `${c.clears} of 3 clears`}{c.misses >= 2 ? " · adjusted" : ""}</div></div>
                </div>
                <div className="flex gap-1">{[1, 2, 3, 4, 5].map((n) => <Icon.Crown key={n} size={18} filled={n < c.level} color={n <= c.level ? "#C8FF3D" : "#2A2D38"} />)}</div>
              </button>
              {isOpen && (
                <div className="mt-3.5 flex flex-col gap-1.5">
                  {reqs.map((r) => { const mv = MOVEMENT_BY_ID[r.movement]; return <div key={r.movement} className="flex justify-between items-center text-[13px] px-2.5 py-2 bg-ink rounded-[10px]"><span className="font-semibold">{mv.name}</span><span className="text-lime font-bold">{r.target} {mv.unit === "seconds" ? "s" : ""}</span></div>; })}
                  <div className="text-[12px] text-muted mt-1 leading-[1.4]">{c.level >= 5 ? "Top of the track. Targets keep rising a little each clear." : `Hit every target in ${3 - c.clears} more Set${3 - c.clears === 1 ? "" : "s"} on different days and Crown ${c.level + 1} is yours.`}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <TabBar />
    </div>
  );
}
