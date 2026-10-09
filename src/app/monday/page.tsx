"use client";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { LEAGUE_TIERS } from "@/lib/types";
import { PROMOTE_TOP } from "@/lib/rules";
import { Confetti, Icon } from "@/components/ui";

export default function Monday() {
  const s = useStore();
  const router = useRouter();
  const rank = s.league.findIndex((r) => r.isYou) + 1;
  const promoted = rank <= PROMOTE_TOP;
  const idx = LEAGUE_TIERS.indexOf(s.leagueTier);
  const nextTier = promoted ? LEAGUE_TIERS[Math.min(4, idx + 1)] : s.leagueTier;
  const duoCleared = s.duo ? s.duo.yourXp + s.duo.partnerXp >= s.duo.targetXp : false;
  const go = () => { s.markMondaySeen(); router.replace("/league"); };

  return (
    <div className="screen relative overflow-hidden" style={{ background: "radial-gradient(ellipse at 50% 20%, #1E2A3F 0%, #0C0D11 60%)" }}>
      {promoted && <Confetti colors={["#C8FF3D", "#3D4EFF", "#F4F5F7", "#C8FF3D", "#3D4EFF"]} />}
      <div className="safe-top px-6 pt-12 text-center relative">
        <div className="a-rise text-[12px] font-bold text-muted tracking-[2px] uppercase">Last week · final</div>
        <div className="a-rise d1 display text-[44px] mt-2.5">{promoted ? "You're moving up." : rank > 25 ? "Tough week." : "You held."}</div>
        <div className="a-rise d2 w-[170px] h-[170px] rounded-full mx-auto mt-7 bg-ink-3 flex items-center justify-center relative">
          <div className="absolute inset-0 rounded-full a-shine" style={{ border: "4px solid transparent", background: "linear-gradient(#1A1C23,#1A1C23) padding-box, linear-gradient(90deg,#3D4EFF,#8FB0FF,#3D4EFF) border-box" }} />
          <div className="relative text-center"><Icon.Gem size={56} color="#8FB0FF" /><div className="display text-[20px] mt-1 text-sky capitalize">{nextTier}</div></div>
        </div>
        <div className="a-rise d3 text-[14px] text-muted mt-4 leading-[1.4]">Finished <span className="text-text font-bold">#{rank} of 30</span> in <span className="capitalize">{s.leagueTier}</span>. {promoted ? `Top ${PROMOTE_TOP} promote.` : "Top 7 promote; you're close."}</div>
      </div>
      <div className="a-rise d3 grid grid-cols-3 gap-2.5 mx-6 mt-6">
        <div className="bg-ink-3 rounded-[18px] px-3 py-3.5"><div className="display text-[26px]">{s.xpWeek.toLocaleString()}</div><div className="text-[11px] text-muted font-semibold mt-0.5">XP last week</div></div>
        <div className="bg-ink-3 rounded-[18px] px-3 py-3.5"><div className="display text-[26px]">{Math.min(7, s.log.filter((l) => l.kind !== "missed").slice(-7).length)}<span className="text-[14px] text-muted">/7</span></div><div className="text-[11px] text-muted font-semibold mt-0.5">days moved</div></div>
        <div className="bg-ink-3 rounded-[18px] px-3 py-3.5"><div className="display text-[26px] text-lime">{s.streak.current}</div><div className="text-[11px] text-muted font-semibold mt-0.5">streak</div></div>
      </div>
      {s.duo && <div className="a-rise d4 mx-6 mt-3 bg-ink-3 rounded-[18px] px-4 py-3.5 flex items-center gap-3"><div className="flex"><div className="w-[30px] h-[30px] rounded-full bg-lime border-2 border-ink-3 box-border" /><div className="w-[30px] h-[30px] rounded-full bg-blue border-2 border-ink-3 box-border -ml-2.5" /></div><div className="flex-1"><div className="font-bold text-[14px]">Duo Quest with {s.duo.partnerName}: {duoCleared ? "cleared" : "not this time"}</div><div className="text-[12px] text-muted font-semibold">{(s.duo.yourXp + s.duo.partnerXp).toLocaleString()} of {s.duo.targetXp.toLocaleString()} XP{duoCleared ? " · 200 gems each" : ""}</div></div>{duoCleared && <Icon.Check size={22} color="#C8FF3D" />}</div>}
      <div className="mt-auto px-6 pb-8 safe-bottom pt-5"><button onClick={go} className="h-[58px] rounded-2xl bg-lime text-ink font-extrabold text-[17px] w-full">See the new league</button></div>
    </div>
  );
}
