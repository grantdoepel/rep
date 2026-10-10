"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useStore } from "@/lib/store";
import { LEAGUE_TIERS } from "@/lib/types";
import { PROMOTE_TOP, addDays, localDate } from "@/lib/rules";
import { MOVEMENT_BY_ID } from "@/lib/content";
import { PROMISE_MAX, PROMISE_MIN, promiseDays, reviewLastWeek, type WeekReview } from "@/lib/promise";
import { track } from "@/lib/analytics";
import { Confetti, Icon, haptic } from "@/components/ui";
import { Vee } from "@/components/Vee";

const CARDS = 4;
const Card = ({ children, className = "" }: { children: ReactNode; className?: string }) => <div className={`w-full shrink-0 snap-center snap-always px-6 flex flex-col ${className}`}>{children}</div>;

export default function Monday() {
  const s = useStore();
  const router = useRouter();
  const [review, setReview] = useState<WeekReview | null>(null);
  const [idx, setIdx] = useState(0);
  const [days, setDays] = useState<number>(0);
  const scroller = useRef<HTMLDivElement>(null);
  const rolled = useRef(false);

  // PRD 1 · Monday rollover: judge last week once, persist, and keep the verdict stable while the profile updates.
  useEffect(() => {
    if (!s.hydrated || !s.onboarded || rolled.current) return;
    rolled.current = true;
    const today = localDate(new Date(), s.profile.timezone);
    const r = reviewLastWeek(s.log, s.profile, today);
    setReview(r);
    setDays(promiseDays(s.profile));
    if (r.patch) s.patchProfile(r.patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.hydrated, s.onboarded]);

  if (!review) return <div className="screen" />;

  const rank = s.league.findIndex((r) => r.isYou) + 1;
  const promoted = rank > 0 && rank <= PROMOTE_TOP;
  const tierIdx = LEAGUE_TIERS.indexOf(s.leagueTier);
  const nextTier = promoted ? LEAGUE_TIERS[Math.min(4, tierIdx + 1)] : s.leagueTier;
  const duoCleared = s.duo ? s.duo.yourXp + s.duo.partnerXp >= s.duo.targetXp : false;

  // card 2 · the ledger diff: best number per movement, the week before → the week just ended
  const lastWs = review.weekStart, lastEnd = addDays(lastWs, 6), prevWs = addDays(lastWs, -7);
  const best = (movement: string, from: string, to: string) => s.ledger.filter((r) => r.movement === movement && r.date >= from && r.date <= to && !r.test).reduce<number | null>((a, r) => (a === null ? r.achieved : Math.max(a, r.achieved)), null);
  const diffs = Object.keys(s.recent).map((m) => ({ id: m, name: MOVEMENT_BY_ID[m]?.name ?? m, unit: MOVEMENT_BY_ID[m]?.unit ?? "reps", prev: best(m, prevWs, addDays(lastWs, -1)), cur: best(m, lastWs, lastEnd) })).filter((d) => d.prev !== null && d.cur !== null).slice(0, 6) as { id: string; name: string; unit: string; prev: number; cur: number }[];
  const movedLastWeek = new Set(s.log.filter((l) => l.date >= lastWs && l.date <= lastEnd && l.kind !== "missed").map((l) => l.date)).size;

  const chips = Array.from(new Set([3, 4, 5, review.P, days].filter((n) => n >= PROMISE_MIN && n <= PROMISE_MAX))).sort((a, b) => a - b);
  const onScroll = () => { const el = scroller.current; if (!el) return; const i = Math.round(el.scrollLeft / el.clientWidth); if (i !== idx) setIdx(Math.min(CARDS - 1, Math.max(0, i))); };
  const goTo = (i: number) => { const el = scroller.current; if (!el) return; el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" }); };
  const commit = () => {
    haptic();
    s.patchProfile({ promiseDays: days });
    track("monday_commit", { days, kept: review.kept });
    s.markMondaySeen();
    router.replace("/");
  };

  return (
    <div className="screen relative overflow-hidden" style={{ background: "radial-gradient(ellipse at 50% 20%, #1E2A3F 0%, #0C0D11 60%)" }}>
      {review.kept && <Confetti colors={["#C8FF3D", "#3D4EFF", "#F4F5F7", "#C8FF3D", "#3D4EFF"]} />}
      <div className="safe-top px-6 pt-10 flex items-center justify-between relative">
        <div className="t-micro text-muted">Last week · final</div>
        <div className="flex gap-1.5" role="tablist" aria-label="Monday story">
          {Array.from({ length: CARDS }, (_, i) => <button key={i} role="tab" aria-selected={i === idx} aria-label={`Card ${i + 1}`} onClick={() => goTo(i)} className="press p-1.5 -m-1.5"><span className="block w-2 h-2 rounded-full" style={{ background: i === idx ? "#C8FF3D" : "#2A2D38" }} /></button>)}
        </div>
      </div>

      <div ref={scroller} onScroll={onScroll} className="flex-1 flex overflow-x-auto snap-x snap-mandatory mt-6 relative" style={{ scrollbarWidth: "none" }}>
        {/* 1 · the week in one sentence */}
        <Card>
          <div className="a-rise t-micro text-lime">The promise</div>
          <div className="a-rise d1 display text-[44px] mt-2.5 leading-[1.02]">{review.kept ? `Week ${review.weekNo} kept.` : `Week ${review.weekNo} slipped: ${review.K} of ${review.P}.`}</div>
          <div className="a-rise d2 t-body text-muted mt-4">{review.kept ? `${review.K} of ${review.P} days. You said it on a Monday and did it.` : review.K === 0 ? "No days this week. The count starts over; the ledger doesn't." : `${review.P - review.K} short. The count starts over; the ledger doesn't.`}</div>
          <div className="a-rise d3 flex gap-1.5 mt-6">{Array.from({ length: 7 }, (_, i) => { const d = addDays(lastWs, i); const l = s.log.find((x) => x.date === d); const on = !!l && l.kind !== "missed" && l.kind !== "frozen"; return <div key={i} className={`flex-1 h-10 rounded-xl flex items-center justify-center text-[12px] font-bold ${on ? "bg-lime text-ink" : l?.kind === "frozen" ? "bg-sky/20 text-sky" : "bg-ink-3 text-muted-2"}`}>{"MTWTFSS"[i]}</div>; })}</div>
          <div className="a-rise d4 mt-auto mb-6 flex items-end justify-between"><div className="t-small text-muted">Swipe for the ledger</div><Vee size={56} mood={review.kept ? "proud" : "neutral"} bob /></div>
        </Card>

        {/* 2 · the ledger diff */}
        <Card>
          <div className="t-micro text-muted">The ledger · week over week</div>
          {diffs.length > 0 ? (
            <>
              <div className="display t-h1 mt-2.5">{diffs.filter((d) => d.cur > d.prev).length} of {diffs.length} moves up.</div>
              <div className="mt-5 flex flex-col">
                <div className="flex justify-between t-micro text-muted-2 pb-1.5"><span>Move</span><span>before → last week</span></div>
                {diffs.map((d) => { const delta = d.cur - d.prev; return (
                  <div key={d.id} className="flex items-center justify-between py-2.5 hairline">
                    <span className="t-body font-semibold">{d.name}</span>
                    <span className="t-num text-[17px] flex items-baseline gap-1.5"><span className="text-muted">{d.prev}</span><span className="text-muted-2">→</span><span>{d.cur}{d.unit === "seconds" ? <span className="t-small text-muted ml-0.5">s</span> : null}</span><span className={`t-small font-bold w-9 text-right ${delta > 0 ? "text-lime" : delta < 0 ? "text-muted-2" : "text-muted-2"}`}>{delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : "="}</span></span>
                  </div>
                ); })}
              </div>
            </>
          ) : (
            <>
              <div className="display t-h1 mt-2.5">Last week in numbers.</div>
              <div className="grid grid-cols-3 gap-2.5 mt-5">
                <div className="bg-ink-3 rounded-[18px] px-3 py-3.5"><div className="display text-[26px]">{s.xpWeek.toLocaleString()}</div><div className="text-[11px] text-muted font-semibold mt-0.5">XP last week</div></div>
                <div className="bg-ink-3 rounded-[18px] px-3 py-3.5"><div className="display text-[26px]">{movedLastWeek}<span className="text-[14px] text-muted">/7</span></div><div className="text-[11px] text-muted font-semibold mt-0.5">days moved</div></div>
                <div className="bg-ink-3 rounded-[18px] px-3 py-3.5"><div className="display text-[26px] text-lime">{s.streak.current}</div><div className="text-[11px] text-muted font-semibold mt-0.5">streak</div></div>
              </div>
              <div className="t-small text-muted mt-4">Two weeks of numbers and this card shows every move, last week against the one before.</div>
            </>
          )}
        </Card>

        {/* 3 · crew, duo, league */}
        <Card>
          <div className="t-micro text-muted">{s.crew ? `Crew · ${s.crew.name}` : s.duo ? `Duo with ${s.duo.partnerName}` : "League"}</div>
          <div className="display t-h1 mt-2.5">{promoted ? "You're moving up." : rank > 25 ? "Tough week." : "You held."}</div>
          <div className="w-[140px] h-[140px] rounded-full mx-auto mt-6 bg-ink-3 flex items-center justify-center relative">
            <div className="absolute inset-0 rounded-full a-shine" style={{ border: "4px solid transparent", background: "linear-gradient(#1A1C23,#1A1C23) padding-box, linear-gradient(90deg,#3D4EFF,#8FB0FF,#3D4EFF) border-box" }} />
            <div className="relative text-center"><Icon.Gem size={44} color="#8FB0FF" /><div className="display text-[18px] mt-1 text-sky capitalize">{nextTier}</div></div>
          </div>
          <div className="t-small text-muted mt-4 text-center">Finished <span className="text-text font-bold">#{rank} of {s.league.length}</span> in <span className="capitalize">{s.leagueTier}</span>. {promoted ? `Top ${PROMOTE_TOP} promote.` : `Top ${PROMOTE_TOP} promote; you're close.`}</div>
          {s.crew && <div className="mt-4 bg-ink-3 rounded-[18px] px-4 py-3.5"><div className="font-bold text-[14px]">{s.crew.kept ? "Crew week kept." : "Crew week not kept."}</div><div className="text-[12px] text-muted font-semibold mt-0.5">{s.crew.xp.toLocaleString()} of {s.crew.targetXp.toLocaleString()} XP together · {s.crew.members.length} of you</div></div>}
          {s.duo && <div className="mt-4 bg-ink-3 rounded-[18px] px-4 py-3.5 flex items-center gap-3"><div className="flex"><div className="w-[30px] h-[30px] rounded-full bg-lime border-2 border-ink-3 box-border" /><div className="w-[30px] h-[30px] rounded-full bg-blue border-2 border-ink-3 box-border -ml-2.5" /></div><div className="flex-1"><div className="font-bold text-[14px]">Duo Quest with {s.duo.partnerName}: {duoCleared ? "cleared" : "not this time"}</div><div className="text-[12px] text-muted font-semibold">{(s.duo.yourXp + s.duo.partnerXp).toLocaleString()} of {s.duo.targetXp.toLocaleString()} XP{duoCleared ? " · 200 gems each" : ""}</div></div>{duoCleared && <Icon.Check size={22} color="#C8FF3D" />}</div>}
          {s.duo && !duoCleared && (s.duo.wagerYou || s.duo.wagerPartner) && <div className="mt-3 bg-coral/12 border-[1.5px] border-coral rounded-[18px] px-4 py-3.5"><div className="t-micro text-coral">The wager</div><div className="font-bold text-[14px] mt-1">{s.duo.yourXp < s.duo.partnerXp ? `You owe ${s.duo.partnerName}: ${s.duo.wagerYou ?? "whatever you agreed"}` : `${s.duo.partnerName} owes you: ${s.duo.wagerPartner ?? "whatever you agreed"}`}</div><div className="text-[12px] text-muted mt-1">Lower XP pays. Settle it this week.</div></div>}
        </Card>

        {/* 4 · the promise for this week */}
        <Card>
          <div className="t-micro text-lime">This week</div>
          <div className="display t-h1 mt-2.5">Keep it at {promiseDays(s.profile)}?</div>
          <div className="t-body text-muted mt-2.5">{review.kept ? "A kept promise can grow. It doesn't have to." : "Smaller and kept beats bigger and slipped."}</div>
          <div className="flex gap-2.5 mt-6">
            {chips.map((n) => <button key={n} onClick={() => { haptic(); setDays(n); }} aria-pressed={days === n} className={`press flex-1 h-14 rounded-2xl border-[1.5px] display text-[22px] ${days === n ? "border-lime bg-lime/8 text-lime" : "border-ink-4 bg-ink-3 text-text-2"}`}>{n}</button>)}
          </div>
          <div className="t-small text-muted mt-3">days a week. You can change it any Monday.</div>
          <div className="mt-auto pb-8 safe-bottom pt-5"><button onClick={commit} className="press h-[58px] rounded-2xl bg-lime text-ink font-extrabold text-[17px] w-full">Commit</button></div>
        </Card>
      </div>
    </div>
  );
}
