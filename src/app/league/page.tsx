"use client";
import { useStore } from "@/lib/store";
import { LEAGUE_TIERS } from "@/lib/types";
import { DEMOTE_BOTTOM, PROMOTE_TOP, dayOfWeek, localDate } from "@/lib/rules";
import { Avatar, Chip, TabBar, useMounted } from "@/components/ui";

const TIER_COLOR: Record<string, string> = { bronze: "#7A5A3A", silver: "#9AA0AE", gold: "#C8FF3D", sapphire: "#8FB0FF", diamond: "#F4F5F7" };

export default function League() {
  const s = useStore();
  const mounted = useMounted();
  if (!mounted) return <div className="screen" />;
  const today = localDate(new Date(), s.profile.timezone);
  const daysLeft = 7 - ((dayOfWeek(today) + 6) % 7);
  const rows = s.league;
  const youIdx = rows.findIndex((r) => r.isYou);
  const above = rows[youIdx - 1];

  return (
    <div className="screen">
      <div className="safe-top px-6 pt-10">
        <div className="flex items-center justify-between">
          <div><div className="text-[12px] font-bold text-muted tracking-[1.5px] uppercase">This week</div><div className="display text-[30px] mt-1 capitalize">{s.leagueTier} League</div></div>
          <div className="text-right"><div className="display text-[22px]">{daysLeft}d</div><div className="text-[12px] text-muted font-semibold">until Monday</div></div>
        </div>
        <div className="flex gap-1.5 mt-4 items-center">{LEAGUE_TIERS.map((t) => <div key={t} className={`flex-1 rounded-full ${t === s.leagueTier ? "h-2.5 a-shine" : "h-1.5"}`} style={{ background: t === s.leagueTier ? `linear-gradient(90deg, ${TIER_COLOR[t]}, #fff, ${TIER_COLOR[t]})` : LEAGUE_TIERS.indexOf(t) < LEAGUE_TIERS.indexOf(s.leagueTier) ? TIER_COLOR[t] : "#2A2D38" }} />)}</div>
        <div className="flex justify-between text-[10px] text-muted-2 font-bold mt-1.5 tracking-[.5px]">{LEAGUE_TIERS.map((t) => <span key={t} className={t === s.leagueTier ? "text-lime" : ""}>{t.toUpperCase()}</span>)}</div>
      </div>

      <div className="mx-6 mt-4 bg-ink-3 rounded-[14px] px-3.5 py-2.5 text-[12px] text-muted leading-[1.4] flex gap-2.5 items-center">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9AA0AE" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="shrink-0"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
        <span>Ranked by XP per minute of your goal tier, so Casual and Serious compete fairly. Top {PROMOTE_TOP} promote, bottom {DEMOTE_BOTTOM} demote.</span>
      </div>

      <div className="flex flex-col px-6 pt-3.5 pb-5 gap-1">
        <div className="text-[11px] font-bold text-lime tracking-[1px] uppercase py-1.5 flex items-center gap-2"><svg width="12" height="12" viewBox="0 0 24 24" fill="#C8FF3D" aria-hidden="true"><path d="M12 4l8 12H4z" /></svg>Promotion zone · top {PROMOTE_TOP}</div>
        {rows.map((r, i) => (
          <div key={r.id}>
            {i === PROMOTE_TOP && <div className="border-t-[1.5px] border-dashed border-ink-4 my-1.5" />}
            {i === rows.length - DEMOTE_BOTTOM && <div className="text-[11px] font-bold text-coral tracking-[1px] uppercase py-1.5 flex items-center gap-2"><svg width="12" height="12" viewBox="0 0 24 24" fill="#FF6B4A" aria-hidden="true"><path d="M12 20L4 8h16z" /></svg>Demotion zone</div>}
            <div className={`a-slidein flex items-center gap-3 px-3 py-2.5 rounded-[14px] ${r.isYou ? "bg-lime text-ink" : ""}`} style={{ animationDelay: `${Math.min(i, 10) * 40}ms`, opacity: i >= rows.length - DEMOTE_BOTTOM && !r.isYou ? 0.6 : 1 }}>
              <span className={`w-[22px] font-extrabold text-[14px] ${r.isYou ? "" : "text-muted"}`}>{i + 1}</span>
              <Avatar initials={r.isYou ? s.profile.displayName.slice(0, 2).toUpperCase() : r.displayName.split(" ").map((x) => x[0]).join("")} color={r.isYou ? "#0C0D11" : r.isFriend ? "#3D4EFF" : "#2A2D38"} fg={r.isYou ? "#C8FF3D" : "#F4F5F7"} />
              <div className="flex-1"><div className="font-bold text-[14px] flex items-center gap-1.5">{r.displayName}{r.isDuo && <Chip tone="lime">Duo</Chip>}{r.isFriend && !r.isDuo && <Chip tone="lime">Friend</Chip>}</div><div className={`text-[11px] font-semibold ${r.isYou ? "opacity-70" : "text-muted"}`}><span className="capitalize">{r.goalTier}</span> · {r.sets} Sets{r.perfect ? ` · Perfect ×${r.perfect}` : ""}</div></div>
              <div className="text-right"><div className="font-extrabold text-[14px]">{r.xp.toLocaleString()}</div>{r.isYou && above && <div className="text-[10px] font-bold opacity-70">{above.xp - r.xp} behind {above.displayName.split(" ")[0]}</div>}</div>
            </div>
          </div>
        ))}
      </div>
      <TabBar />
    </div>
  );
}
