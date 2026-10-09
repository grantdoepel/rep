"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ProofShot } from "@/components/ProofShot";
import { useStore } from "@/lib/store";
import { MOVEMENT_BY_ID, TRACKS } from "@/lib/content";
import { addDays, dayOfWeek, localDate, mascotLine, weekStart } from "@/lib/rules";
import { Avatar, Icon, Mascot, Pulse, Section, TabBar, Wordmark } from "@/components/ui";

export default function Home() {
  const s = useStore();
  const router = useRouter();
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);
  useEffect(() => { if (s.hydrated && !s.onboarded) router.replace("/start"); }, [s.hydrated, s.onboarded, router]);
  const [atGym, setAtGym] = useState(false);
  useEffect(() => {
    if (!s.hydrated || !s.profile.gymLat || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      const d = Math.hypot((pos.coords.latitude - s.profile.gymLat!) * 111000, (pos.coords.longitude - s.profile.gymLng!) * 111000 * Math.cos((s.profile.gymLat! * Math.PI) / 180));
      setAtGym(d < 150);
    }, () => {}, { maximumAge: 300000, timeout: 8000 });
  }, [s.hydrated, s.profile.gymLat, s.profile.gymLng]);

  if (!s.hydrated || !s.onboarded || !now) return <div className="screen" />;

  const today = localDate(now, s.profile.timezone);
  const doneToday = s.today?.status === "done" && s.today.date === today;
  const hour = now.getHours();
  const atRisk = !doneToday && hour >= 21;
  const monday = dayOfWeek(today) === 1 && s.seenMonday !== weekStart(today) && s.xpTotal > 60;
  if (monday) { router.replace("/monday"); return <div className="screen" />; }

  const set = s.today;
  const rankIdx = s.league.findIndex((r) => r.isYou);
  const rankAbove = s.league[rankIdx - 1];
  const ahead = rankAbove?.isFriend ? { name: rankAbove.displayName.split(" ")[0], by: rankAbove.xp - s.league[rankIdx].xp } : undefined;
  const atRiskFriend = s.friends.find((f) => f.atRisk && !f.doneToday)?.displayName.split(" ")[0];
  const isRest = s.profile.restDays.includes(dayOfWeek(today));
  const line = mascotLine({ hour, doneToday, streak: s.streak.current, atRiskFriend, aheadFriend: ahead, restDay: isRest && !doneToday, whyText: s.profile.whyText });
  const week = Array.from({ length: 7 }, (_, i) => { const d = addDays(weekStart(today), i); const l = s.log.find((x) => x.date === d); return { label: "MTWTFSS"[i], kind: d === today ? (doneToday ? l?.kind ?? "done" : "today") : d > today ? "future" : l?.kind ?? (d >= s.profile.createdAt.slice(0, 10) ? "missed" : "future") }; });
  const daysLeft = 7 - ((dayOfWeek(today) + 6) % 7);
  const tierName = s.leagueTier[0].toUpperCase() + s.leagueTier.slice(1);
  const placement = s.xpTotal < 400 && s.log.length < 7;   // first week: you're being placed, not ranked

  // the ledger: last time vs. today, per move
  const ledger = (set?.moves ?? []).map((m) => { const prev = s.recent[m.movement]; const last = prev && prev.date < today ? prev.achieved : null; return { id: m.movement, name: MOVEMENT_BY_ID[m.movement]?.name ?? m.movement, unit: m.unit, target: m.target, last }; });
  const beats = doneToday && s.lastDone ? s.lastDone.moves.filter((m) => { const prev = s.recent[m.movement]; return prev && prev.date === today && (m.achieved ?? 0) > 0; }).length : 0;
  const start = (kind: "normal" | "rescue") => { s.startSet(kind); router.push("/set"); };

  return (
    <div className="screen">
      <header className="safe-top px-6 pt-8 flex items-center justify-between">
        <Wordmark size={24} />
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full py-2 px-3 bg-ink-3"><Icon.Gem /><span className="t-num text-[14px]">{s.gems}</span></div>
          <Link href="/profile" aria-label="Profile" className="press"><Avatar initials={s.profile.displayName.slice(0, 2).toUpperCase()} color="#1A1C24" fg="#C8FF3D" size={40} /></Link>
        </div>
      </header>

      {/* the week as one line */}
      <section className="px-6 pt-6">
        <div className="flex items-end justify-between">
          <div>
            <div className="t-micro text-muted">{isRest && !doneToday ? "Rest day" : doneToday ? "Done" : atRisk ? "Streak at risk" : "Today"}</div>
            <div className="display t-h1 mt-1.5 flex items-center gap-2">
              {s.streak.current > 0 && <Icon.Flame size={26} className={atRisk ? "a-blink" : "a-flicker"} />}
              <span>{s.streak.current === 0 ? "Day one" : `${s.streak.current} day${s.streak.current === 1 ? "" : "s"}`}</span>
            </div>
          </div>
          <div className="text-right mb-1">
            {!doneToday && <div className="t-small font-semibold text-text-2">today makes {s.streak.current + 1}</div>}
            {s.streak.freezes > 0 && <div className="t-small text-muted-2 font-semibold">{s.streak.freezes} freeze{s.streak.freezes === 1 ? "" : "s"} banked</div>}
          </div>
        </div>
        <div className="mt-2"><Pulse days={week} width={340} height={56} /></div>
      </section>

      {/* today's set: the one surface on the screen */}
      {set && !doneToday && (
        <section className={`mx-6 mt-4 rounded-[26px] p-5 text-ink ${atRisk ? "bg-coral" : "bg-lime"}`}>
          <div className="flex items-center justify-between">
            <span className="t-micro opacity-70">{atRisk ? "Rescue Set · 3 min" : isRest ? "Rest day · 3 min" : `Today's Set · ${set.plannedMinutes} min`}</span>
            <span className="t-micro opacity-70">+{(atRisk ? 3 : set.moves.length) * 20} XP</span>
          </div>
          <div className="display t-h2 mt-2.5">{atRisk ? "Mobility flow. No floor, no excuses." : set.tracks.map((t) => TRACKS.find((x) => x.id === t)?.name).join(" + ")}</div>
          {!atRisk && (
            <div className="mt-4 flex flex-col">
              <div className="flex justify-between t-micro opacity-60 pb-1.5"><span>Move</span><span>last time → today</span></div>
              {ledger.map((m) => (
                <div key={m.id} className="flex items-center justify-between py-2 border-t border-ink/10">
                  <span className="t-body font-semibold">{m.name}</span>
                  <span className="t-num text-[17px] flex items-baseline gap-1.5">{m.last !== null ? <span className="opacity-45">{m.last}</span> : <span className="opacity-45 t-small font-semibold">first time</span>}<span className="opacity-45">→</span><span>{m.target}<span className="t-small font-semibold opacity-60 ml-0.5">{m.unit === "seconds" ? "s" : ""}</span></span></span>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => start(atRisk ? "rescue" : "normal")} className="press flex items-center justify-center gap-2.5 mt-4 h-14 rounded-2xl bg-ink text-text font-extrabold text-[17px] w-full"><Icon.Play color={atRisk ? "#FF6B4A" : "#C8FF3D"} />{atRisk ? "Save the streak" : isRest ? "Keep it" : "Start"}</button>
        </section>
      )}

      {doneToday && s.today && (
        <section className="mx-6 mt-4 rounded-[26px] p-5 bg-ink-3">
          <div className="flex items-center justify-between"><span className="t-micro text-lime">Done for today</span><span className="t-num text-[15px] text-lime">+{s.today.xp} XP</span></div>
          <div className="display t-h2 mt-2.5">{s.today.perfect ? "Every target. Perfect Set." : beats > 0 ? `Today-you beat yesterday-you.` : "Logged. Tomorrow, beat it."}</div>
          <div className="t-small text-muted mt-2">Day {s.streak.current} is in the book. A second Set earns XP; the day only counts once.</div>
          <button onClick={() => start("normal")} className="press mt-4 h-11 rounded-xl border-[1.5px] border-ink-4 w-full font-bold text-[14px] text-text-2">Do another</button>
        </section>
      )}

      {atRisk && (
        <div className="mx-6 mt-3 flex gap-2.5">
          <button onClick={() => { if (s.useFreeze()) router.refresh(); }} disabled={s.streak.freezes === 0} className="press flex-1 h-12 rounded-2xl border-[1.5px] border-ink-4 font-bold text-[14px] disabled:opacity-40">Use a freeze</button>
          <button onClick={() => start("normal")} className="press flex-1 h-12 rounded-2xl border-[1.5px] border-ink-4 font-bold text-[14px] text-muted">Full Set instead</button>
        </div>
      )}

      {atGym && !doneToday && <div className="mx-6 mt-3 flex items-center gap-3 t-small"><div className="w-2 h-2 rounded-full bg-lime a-blink" /><span className="font-bold">You're at {s.profile.gymName}.</span><span className="text-muted">Start, then grab a proof shot.</span></div>}
      {atGym && doneToday && <div className="mx-6 mt-3 text-ink"><div className="bg-lime rounded-[18px] px-4 py-3.5"><div className="font-extrabold text-[14px] mb-2">Still at {s.profile.gymName}? Proof shot time.</div><ProofShot /></div></div>}

      <div className="mx-6 mt-5"><Mascot line={line} mood={atRisk ? "worried" : doneToday ? "proud" : hour >= 21 ? "sleepy" : isRest ? "sleepy" : "neutral"} /></div>
      {s.adaptiveNote && !doneToday && <div className="mx-6 mt-3 t-small text-muted">{s.adaptiveNote}</div>}

      <Section title={placement ? "Placement week" : `${tierName} league`} right={<Link href="/league" className="t-small font-bold text-lime press py-2.5 pl-3 -my-2.5">See board</Link>} className="mt-6">
        <Link href="/league" className="flex items-center justify-between py-1 press">
          <div className="flex items-center gap-3">
            {!placement && <div className="t-num text-[28px]">#{rankIdx + 1}</div>}
            <div className="t-small text-muted">{placement ? "Finish 7 days and you're seeded. Nobody ranks a first week." : `of ${s.league.length} · ${daysLeft} day${daysLeft === 1 ? "" : "s"} left · top 7 move up`}</div>
          </div>
          {!placement && rankIdx > 0 && <div className="t-small text-muted-2 font-semibold whitespace-nowrap">{s.league[rankIdx - 1].xp - s.league[rankIdx].xp} XP to #{rankIdx}</div>}
        </Link>
      </Section>

      {s.duo && (
        <Section title={`Duo with ${s.duo.partnerName}`} right={<span className="t-small text-muted-2 font-semibold">{daysLeft}d left</span>}>
          <Link href="/friends" className="block press">
            <div className="flex justify-between t-small font-semibold"><span>You {s.duo.yourXp.toLocaleString()}</span><span className="text-sky">{s.duo.partnerName} {s.duo.partnerXp.toLocaleString()}</span></div>
            <div className="mt-2 h-2 rounded-full bg-ink-4 overflow-hidden flex"><div className="a-grow h-2 bg-lime" style={{ width: `${Math.min(100, (s.duo.yourXp / s.duo.targetXp) * 100)}%` }} /><div className="a-grow h-2 bg-blue" style={{ width: `${Math.min(100, (s.duo.partnerXp / s.duo.targetXp) * 100)}%` }} /></div>
            <div className="mt-1.5 t-small text-muted">{(s.duo.yourXp + s.duo.partnerXp).toLocaleString()} of {s.duo.targetXp.toLocaleString()} together. Both win or neither does.</div>
          </Link>
        </Section>
      )}
      <div className="h-5" />
      <TabBar />
    </div>
  );
}
