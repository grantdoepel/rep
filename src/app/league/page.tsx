"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { LEAGUE_TIERS } from "@/lib/types";
import { DEMOTE_BOTTOM, PROMOTE_TOP, dayOfWeek, localDate } from "@/lib/rules";
import { Avatar, Chip, Section, TabBar, useMounted } from "@/components/ui";

const TIER_COLOR: Record<string, string> = { bronze: "#A8794F", silver: "#B3B8C7", gold: "#C8FF3D", sapphire: "#8FB0FF", diamond: "#F4F5F7" };

export default function League() {
  const s = useStore();
  const mounted = useMounted();
  const [all, setAll] = useState(false);
  if (!mounted) return <div className="screen" />;
  const today = localDate(new Date(), s.profile.timezone);
  const daysLeft = 7 - ((dayOfWeek(today) + 6) % 7);
  const rows = s.league;
  const youIdx = rows.findIndex((r) => r.isYou);
  const above = rows[youIdx - 1];
  const placement = s.xpTotal < 400 && s.log.length < 7;
  const tierIdx = LEAGUE_TIERS.indexOf(s.leagueTier);
  // the bracket: you, three above, three below. The whole board is one tap away.
  const lo = Math.max(0, youIdx - 3), hi = Math.min(rows.length, youIdx + 4);
  const shown = all ? rows : rows.slice(lo, hi);
  const offset = all ? 0 : lo;
  const toPromo = youIdx >= PROMOTE_TOP && rows[PROMOTE_TOP - 1] ? rows[PROMOTE_TOP - 1].xp - rows[youIdx].xp : 0;

  const Row = ({ r, i }: { r: (typeof rows)[number]; i: number }) => (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-[14px] ${r.isYou ? "bg-lime text-ink" : ""}`} style={{ opacity: !r.isYou && i >= rows.length - DEMOTE_BOTTOM && rows.length > 12 ? 0.6 : 1 }}>
      <span className={`w-[26px] t-num text-[14px] ${r.isYou ? "" : "text-muted"}`}>{i + 1}</span>
      <Avatar initials={r.isYou ? s.profile.displayName.slice(0, 2).toUpperCase() : r.displayName.split(" ").map((x) => x[0]).join("")} color={r.isYou ? "#0C0D11" : r.isFriend ? "#3D4EFF" : "#262A35"} fg={r.isYou ? "#C8FF3D" : "#F4F5F7"} />
      <div className="flex-1 min-w-0"><div className="font-bold text-[14px] flex items-center gap-1.5 truncate">{r.displayName}{r.isDuo && <Chip tone={r.isYou ? "ink" : "lime"}>Duo</Chip>}{r.isFriend && !r.isDuo && <Chip tone="lime">Friend</Chip>}</div><div className={`t-small ${r.isYou ? "opacity-70" : "text-muted"}`}><span className="capitalize">{r.goalTier}</span> · {r.sets} Set{r.sets === 1 ? "" : "s"}{r.perfect ? ` · ${r.perfect} perfect` : ""}</div></div>
      <div className="text-right"><div className="t-num text-[16px]">{r.xp.toLocaleString()}</div>{r.isYou && above && <div className="t-micro opacity-70" style={{ fontSize: 10 }}>{above.xp - r.xp} to #{youIdx}</div>}</div>
    </div>
  );

  return (
    <div className="screen">
      <div className="safe-top px-6 pt-8">
        <div className="flex items-end justify-between">
          <div><div className="t-micro text-muted">{placement ? "Placement week" : "This week"}</div><div className="display t-h1 mt-1.5 capitalize">{s.leagueTier}</div></div>
          <div className="text-right"><div className="t-num text-[28px]">{daysLeft}<span className="t-small font-bold text-muted-2">d</span></div><div className="t-micro text-muted-2">to Monday</div></div>
        </div>
        <div className="flex gap-1.5 mt-5 items-center">{LEAGUE_TIERS.map((t, i) => <div key={t} className={`flex-1 rounded-full ${i === tierIdx ? "h-2.5" : "h-1.5"}`} style={{ background: i <= tierIdx ? TIER_COLOR[t] : "#262A35" }} />)}</div>
        <div className="flex justify-between t-micro mt-1.5" style={{ fontSize: 10 }}>{LEAGUE_TIERS.map((t, i) => <span key={t} className={i === tierIdx ? "text-text" : "text-muted-2"}>{t}</span>)}</div>
      </div>

      {placement ? (
        <div className="mx-6 mt-5 rounded-[22px] bg-ink-3 p-5">
          <div className="display t-h2">Nobody ranks a first week.</div>
          <div className="t-body text-muted mt-2 leading-[1.45]">Do seven days. Monday morning you're seeded into a league of thirty people with your pace, and from then on it's top seven up, bottom five down. You can watch the board below; it just can't hurt you yet.</div>
          <div className="mt-4 flex gap-6"><div><div className="t-num text-[24px]">{Math.min(7, s.log.filter((l) => l.kind !== "missed").length)}<span className="t-small text-muted-2 font-bold">/7</span></div><div className="t-micro text-muted-2">days done</div></div><div><div className="t-num text-[24px]">{s.xpWeek.toLocaleString()}</div><div className="t-micro text-muted-2">XP this week</div></div></div>
        </div>
      ) : (
        <div className="mx-6 mt-5 flex items-center gap-4">
          <div className="t-num" style={{ fontSize: 56, lineHeight: 1 }}>#{youIdx + 1}</div>
          <div className="t-small text-muted leading-[1.45]">{youIdx < PROMOTE_TOP ? `In the promotion zone. Hold top ${PROMOTE_TOP} through Monday and you're ${LEAGUE_TIERS[Math.min(4, tierIdx + 1)]}.` : youIdx >= rows.length - DEMOTE_BOTTOM ? `In the drop zone. ${rows[rows.length - DEMOTE_BOTTOM - 1].xp - rows[youIdx].xp + 1} XP gets you out; one Set does it.` : `${toPromo + 1} XP from the promotion line. Ranked on XP per minute of your goal, so Casual and Serious compete fairly.`}</div>
        </div>
      )}

      <Section title={all ? `All ${rows.length}` : "Your bracket"} right={rows.length > 7 && <button onClick={() => setAll(!all)} className="press t-small font-bold text-lime">{all ? "Just my bracket" : "Whole board"}</button>} className="mt-5">
        <div className="flex flex-col gap-0.5 -mx-3">
          {shown.map((r, j) => { const i = j + offset; return (
            <div key={r.id} className="a-slidein" style={{ animationDelay: `${Math.min(j, 10) * 35}ms` }}>
              {all && i === PROMOTE_TOP && <div className="t-micro text-lime px-3 py-2 flex items-center gap-2" style={{ fontSize: 10 }}><span className="h-px flex-1 bg-lime/30" />promotion line<span className="h-px flex-1 bg-lime/30" /></div>}
              {all && i === rows.length - DEMOTE_BOTTOM && rows.length > 12 && <div className="t-micro text-coral px-3 py-2 flex items-center gap-2" style={{ fontSize: 10 }}><span className="h-px flex-1 bg-coral/30" />drop line<span className="h-px flex-1 bg-coral/30" /></div>}
              <Row r={r} i={i} />
            </div>
          ); })}
        </div>
      </Section>
      <div className="h-5" />
      <TabBar />
    </div>
  );
}
