"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { CROWN_LEVELS, MOVEMENT_BY_ID, TRACKS } from "@/lib/content";
import type { Tier, Track } from "@/lib/types";
import { Icon, Ring, Section, TabBar } from "@/components/ui";

const TIERS: Tier[] = ["foundation", "standard", "advanced"];

export default function Crowns() {
  const s = useStore();
  const [open, setOpen] = useState<Track | null>(null);
  const env = s.profile.environment;
  const earned = TRACKS.reduce((a, t) => a + ((s.crowns[t.id]?.level ?? 1) - 1), 0);
  const cycleTier = () => s.updateProfile({ tier: TIERS[(TIERS.indexOf(s.profile.tier) + 1) % 3] });
  const openTrack = open ? TRACKS.find((t) => t.id === open) : null;
  const oc = open ? s.crowns[open] ?? { level: 1, clears: 0, misses: 0 } : null;
  const olvl = open && oc ? CROWN_LEVELS.find((l) => l.track === open && l.level === oc.level) : null;
  const reqs = olvl ? (env === "gym" ? olvl.gym : olvl.requirements) : [];

  return (
    <div className="screen">
      <div className="safe-top px-6 pt-8 flex items-end justify-between">
        <div><div className="t-micro text-muted">Six tracks · five crowns each</div><div className="display t-h1 mt-1.5">Crowns</div></div>
        <div className="text-right"><div className="t-num text-[28px]">{earned}<span className="t-small font-bold text-muted-2">/30</span></div></div>
      </div>

      {/* six rings. Fill = clears toward the next crown; the number is the crown you hold. */}
      <div className="grid grid-cols-3 gap-x-2 gap-y-4 px-6 pt-6">
        {TRACKS.map((t) => {
          const c = s.crowns[t.id] ?? { level: 1, clears: 0, misses: 0 };
          const maxed = c.level >= 5 && c.clears >= 3;
          const on = open === t.id;
          return (
            <button key={t.id} onClick={() => setOpen(on ? null : t.id)} aria-expanded={on} className="press flex flex-col items-center gap-2 py-1">
              <Ring value={maxed ? 1 : c.clears / 3} size={92} width={7} color={on || maxed ? "#C8FF3D" : "#F4F5F7"}>
                <div className="text-center"><div className={`t-num text-[26px] ${on ? "text-lime" : ""}`}>{c.level}</div><div className="t-micro text-muted-2 -mt-0.5" style={{ fontSize: 9 }}>crown</div></div>
              </Ring>
              <div className={`t-small font-bold ${on ? "text-lime" : ""}`}>{t.name}</div>
              <div className="t-micro text-muted-2" style={{ fontSize: 10 }}>{maxed ? "maxed" : `${c.clears}/3 clears`}{c.misses >= 2 ? " · eased" : ""}</div>
            </button>
          );
        })}
      </div>

      {openTrack && oc && (
        <Section title={`${openTrack.name} · Crown ${oc.level} targets`} right={<span className="t-small text-muted-2 font-semibold capitalize">{env} · {s.profile.tier}</span>} className="mt-5 a-rise">
          <div className="flex flex-col">
            {reqs.map((r) => { const mv = MOVEMENT_BY_ID[r.movement]; const last = s.recent[r.movement]; return (
              <div key={r.movement} className="flex items-center justify-between py-2.5 border-t border-hair first:border-t-0">
                <span className="t-body font-semibold">{mv.name}</span>
                <span className="t-num text-[17px] flex items-baseline gap-2">{last && <span className="ghost">{last.achieved}</span>}<span className={last && last.achieved >= r.target ? "text-lime" : ""}>{r.target}{mv.unit === "seconds" ? "s" : ""}</span></span>
              </div>
            ); })}
          </div>
          <div className="t-small text-muted mt-3 leading-[1.45]">{oc.level >= 5 ? "Top of the track. Targets keep rising a little each clear." : `Hit every target in ${3 - oc.clears} more Set${3 - oc.clears === 1 ? "" : "s"} on different days and Crown ${oc.level + 1} is yours. Your last number sits in blue.`}</div>
        </Section>
      )}

      <Section title="How it works" className="mt-5">
        <div className="t-small text-muted leading-[1.5]">Every track keeps a full ladder wherever you train. Movements swap for {env === "gym" ? "home" : "gym"} equipment; the crown does not. Two short days in a row ease a track by one step until three clean Sets bring it back.</div>
        <button onClick={cycleTier} className="press mt-3 h-10 px-3.5 -ml-3.5 rounded-full text-lime t-small font-bold flex items-center gap-2"><Icon.Crown size={14} filled={false} />Difficulty: <span className="capitalize">{s.profile.tier}</span> · tap to change</button>
      </Section>
      <div className="h-5" />
      <TabBar />
    </div>
  );
}
