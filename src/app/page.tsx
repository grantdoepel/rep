"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { MOVEMENT_BY_ID, TRACKS } from "@/lib/content";
import { addDays, dayOfWeek, localDate, mascotLine, weekStart } from "@/lib/rules";
import { Avatar, Button, Chip, Eyebrow, Icon, LinkButton, Mascot, TabBar } from "@/components/ui";

export default function Home() {
  const s = useStore();
  const router = useRouter();
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);
  useEffect(() => { if (s.hydrated && !s.onboarded) router.replace("/start"); }, [s.hydrated, s.onboarded, router]);

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
  const atRiskFriend = s.friends.find((f) => f.atRisk)?.displayName.split(" ")[0];
  const isRest = s.profile.restDays.includes(dayOfWeek(today));
  const line = mascotLine({ hour, doneToday, streak: s.streak.current, atRiskFriend, aheadFriend: ahead, restDay: isRest && !doneToday, whyText: s.profile.whyText });
  const week = Array.from({ length: 7 }, (_, i) => { const d = addDays(weekStart(today), i); const l = s.log.find((x) => x.date === d); return { d, kind: d === today ? (doneToday ? l?.kind ?? "done" : "today") : d > today || d < s.profile.createdAt.slice(0, 10) ? "future" : l?.kind ?? "missed" }; });
  const duoPct = s.duo ? Math.min(100, Math.round(((s.duo.yourXp + s.duo.partnerXp) / s.duo.targetXp) * 100)) : 0;
  const tierName = s.leagueTier[0].toUpperCase() + s.leagueTier.slice(1);

  return (
    <div className="screen">
      <header className="safe-top px-6 pt-10 flex items-center justify-between">
        <div className="display text-[26px]">rep<span className="text-lime">.</span></div>
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 bg-ink-3 rounded-full py-2 pl-2.5 pr-3"><Icon.Gem /><span className="font-bold text-[14px]">{s.gems}</span></div>
          <Link href="/profile"><Avatar initials={s.profile.displayName.slice(0, 2).toUpperCase()} color="#2A2D38" fg="#C8FF3D" size={40} /></Link>
        </div>
      </header>

      {/* streak */}
      <section className="px-6 pt-7 flex items-end justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Icon.Flame size={30} className={atRisk ? "a-blink" : "a-flicker"} color={atRisk ? "#FF6B4A" : "#FF6B4A"} />
            <div className="display text-[56px]">{s.streak.current}</div>
            {atRisk && <span className="text-coral font-bold text-[14px] self-center">at risk</span>}
          </div>
          <div className="text-[14px] text-muted mt-1.5 font-medium">day streak · {s.streak.freezes} freeze{s.streak.freezes === 1 ? "" : "s"} left</div>
        </div>
        <Link href="/league" className="text-right">
          <Eyebrow>{tierName} league</Eyebrow>
          <div className="display text-[22px] mt-0.5">#{rankIdx + 1}</div>
        </Link>
      </section>

      {/* week */}
      <section className="flex justify-between px-6 pt-5">
        {week.map((w, i) => (
          <div key={w.d} className="flex flex-col items-center gap-1.5">
            <div className={`w-[34px] h-[34px] rounded-full flex items-center justify-center box-border relative ${w.kind === "perfect" || w.kind === "done" ? "bg-lime" : w.kind === "rest" || w.kind === "frozen" ? "bg-blue" : w.kind === "today" ? "border-2 border-lime" : w.kind === "future" ? "border-[1.5px] border-ink-4" : "border-[1.5px] border-coral/50"}`}>
              {(w.kind === "perfect" || w.kind === "done") && <Icon.Check />}
              {w.kind === "today" && <><div className="absolute -inset-1.5 rounded-full border-2 border-lime a-ring" /><div className="w-2.5 h-2.5 rounded-full bg-lime" /></>}
            </div>
            <span className={`text-[11px] font-semibold ${w.kind === "today" ? "text-text font-bold" : w.kind === "future" ? "text-muted-2" : "text-muted"}`}>{"MTWTFSS"[i]}</span>
          </div>
        ))}
      </section>

      {/* today's set */}
      {set && !doneToday && (
        <section className={`mx-6 mt-6 rounded-3xl p-5 text-ink relative overflow-hidden ${atRisk ? "bg-coral" : "bg-lime"}`}>
          <div className="absolute -right-8 -top-8 w-[150px] h-[150px] rounded-full border-[18px] border-ink/8" />
          <div className="flex items-center justify-between relative">
            <span className="text-[12px] font-bold tracking-[1px] uppercase opacity-70">{atRisk ? "Rescue Set" : isRest ? "Rest day Set" : "Today's Set"}</span>
            <div className="flex gap-1.5">
              {atRisk ? <span className="text-[11px] font-bold bg-ink/12 rounded-full px-2.5 py-1">Still counts</span> : <>
                <span className="text-[11px] font-bold bg-ink/12 rounded-full px-2.5 py-1 capitalize">{s.profile.environment}</span>
                <span className="text-[11px] font-bold bg-ink/12 rounded-full px-2.5 py-1 capitalize">{s.profile.tier}</span></>}
            </div>
          </div>
          <div className="display text-[30px] mt-3 relative leading-[1.05]">
            {atRisk ? <>Mobility flow<br />3 minutes, no floor</> : <>{set.tracks.map((t) => TRACKS.find((x) => x.id === t)?.name).join(" + ")}<br />{set.kind === "rest" ? "keeps the streak" : `Crown ${s.crowns[set.tracks[0]]?.level ?? 1} attempt`}</>}
          </div>
          <div className="flex gap-3.5 mt-3.5 text-[13px] font-semibold opacity-80 relative"><span>{atRisk ? 3 : set.plannedMinutes} min</span><span>·</span><span>{atRisk ? 3 : set.moves.length} movements</span><span>·</span><span>+{(atRisk ? 3 : set.moves.length) * 20} XP</span></div>
          <div className="flex gap-1.5 mt-4 relative flex-wrap">
            {(atRisk ? ["Neck rolls", "Hip hinge", "Wall reach"] : set.moves.slice(0, 3).map((m) => MOVEMENT_BY_ID[m.movement].name)).map((n) => <span key={n} className={`text-[12px] font-semibold rounded-lg px-2.5 py-1.5 bg-ink ${atRisk ? "text-coral" : "text-lime"}`}>{n}</span>)}
            {!atRisk && set.moves.length > 3 && <span className="text-[12px] font-semibold rounded-lg px-2.5 py-1.5 bg-ink/12">+{set.moves.length - 3}</span>}
          </div>
          <button onClick={() => { s.startSet(atRisk ? "rescue" : "normal"); router.push("/set"); }} className="flex items-center justify-center gap-2.5 mt-4 h-14 rounded-2xl bg-ink text-text font-bold text-[17px] w-full relative"><Icon.Play color={atRisk ? "#FF6B4A" : "#C8FF3D"} />{atRisk ? "Save the streak" : "Start"}</button>
        </section>
      )}

      {doneToday && (
        <section className="mx-6 mt-6 rounded-3xl p-5 bg-ink-3">
          <div className="flex items-center justify-between"><Eyebrow tone="lime">Done for today</Eyebrow><Chip tone="lime">+{s.today?.xp} XP</Chip></div>
          <div className="display text-[26px] mt-2">{s.today?.perfect ? "Perfect Set." : "Set complete."} Streak {s.streak.current}.</div>
          <div className="text-[13px] text-muted mt-2">Want more? A second Set earns XP but doesn't double-count the day.</div>
          <button onClick={() => { s.startSet("normal"); router.push("/set"); }} className="mt-3.5 h-11 rounded-xl border-[1.5px] border-ink-4 w-full font-bold text-[14px] text-muted">Do another</button>
        </section>
      )}

      {atRisk && (
        <div className="mx-6 mt-3.5 flex gap-2.5">
          <button onClick={() => { if (s.useFreeze()) router.refresh(); }} disabled={s.streak.freezes === 0} className="flex-1 h-[54px] rounded-2xl border-[1.5px] border-ink-4 font-bold text-[14px] disabled:opacity-40">Use a freeze ({s.streak.freezes})</button>
          <button onClick={() => { s.startSet("normal"); router.push("/set"); }} className="flex-1 h-[54px] rounded-2xl border-[1.5px] border-ink-4 font-bold text-[14px] text-muted">Do the full Set</button>
        </div>
      )}

      <section className="mx-6 mt-4"><Mascot line={line} mood={atRisk ? "worried" : "neutral"} /></section>
      {s.adaptiveNote && !doneToday && <div className="mx-6 mt-3 text-[12px] text-muted bg-ink-2 rounded-xl px-3.5 py-2.5 leading-[1.4]">{s.adaptiveNote}</div>}

      {/* duo */}
      {s.duo && (
        <Link href="/friends" className="mx-6 mt-3.5 mb-5 block bg-ink-3 rounded-[18px] px-4 py-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex"><div className="w-[26px] h-[26px] rounded-full bg-blue border-2 border-ink-3 box-border" /><div className="w-[26px] h-[26px] rounded-full bg-lime border-2 border-ink-3 box-border -ml-2" /></div>
              <span className="font-bold text-[14px]">Duo Quest with {s.duo.partnerName}</span>
            </div>
            <span className="text-[12px] text-muted font-semibold">{7 - ((dayOfWeek(today) + 6) % 7)} days left</span>
          </div>
          <div className="mt-2.5 h-2 rounded-full bg-ink-4 overflow-hidden"><div className="a-grow h-2 rounded-full" style={{ width: `${duoPct}%`, background: "linear-gradient(90deg,#3D4EFF,#C8FF3D)" }} /></div>
          <div className="flex justify-between mt-2 text-[12px] text-muted font-semibold"><span>{(s.duo.yourXp + s.duo.partnerXp).toLocaleString()} / {s.duo.targetXp.toLocaleString()} XP</span><span className="text-lime">{duoPct >= Math.round((((dayOfWeek(today) + 6) % 7) + 1) / 7 * 100) ? "On pace" : "Behind pace"}</span></div>
        </Link>
      )}

      <TabBar />
    </div>
  );
}
