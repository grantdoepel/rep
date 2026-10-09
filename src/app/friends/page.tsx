"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { dayOfWeek, localDate } from "@/lib/rules";
import { Avatar, Icon, TabBar, useMounted } from "@/components/ui";

export default function Friends() {
  const s = useStore();
  const mounted = useMounted();
  const router = useRouter();
  if (!mounted) return <div className="screen" />;
  const today = localDate(new Date(), s.profile.timezone);
  const daysLeft = 7 - ((dayOfWeek(today) + 6) % 7);
  const moving = s.friends.filter((f) => f.movingNow);
  const duo = s.duo;
  const partner = s.friends.find((f) => f.id === duo?.partnerId);
  const you = (duo?.yourXp ?? 0), them = duo?.partnerXp ?? 0, tgt = duo?.targetXp ?? 2000;

  return (
    <div className="screen">
      <div className="safe-top px-6 pt-10 flex items-end justify-between">
        <div><div className="display text-[30px]">Friends</div><div className="text-[13px] text-muted mt-1.5 font-medium">{s.friends.filter((f) => f.doneToday).length} keeping their Rep today</div></div>
        <button aria-label="Add friend" onClick={() => navigator.share?.({ title: "Rep", text: "Keep your Rep with me.", url: location.origin + "/?ref=" + s.profile.username }).catch(() => {})} className="w-11 h-11 rounded-full bg-lime flex items-center justify-center"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0C0D11" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg></button>
      </div>

      {moving.length > 0 && (
        <Link href="/live" className="mx-6 mt-4 bg-lime/6 border-[1.5px] border-lime/25 rounded-2xl px-3.5 py-3 flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-lime a-blink" />
          <div className="flex">{moving.map((f, i) => <div key={f.id} className="w-[26px] h-[26px] rounded-full border-2 border-ink box-border" style={{ background: f.color, marginLeft: i ? -8 : 0 }} />)}</div>
          <div className="flex-1 text-[13px]"><span className="font-bold">{moving.map((f) => f.displayName.split(" ")[0]).join(" and ")}</span> <span className="text-muted">{moving.length === 1 ? "is" : "are"} mid-Set right now</span></div>
          <span className="text-[12px] font-bold text-lime">Join →</span>
        </Link>
      )}

      {duo && (
        <div className="mx-6 mt-4 rounded-[22px] p-[18px] border border-ink-4" style={{ background: "linear-gradient(135deg,#1A1C23,#22263A)" }}>
          <div className="flex items-center justify-between"><div className="text-[11px] font-extrabold text-lime tracking-[1.5px] uppercase">Duo Quest · this week</div><span className="text-[12px] text-muted font-semibold">{daysLeft}d left</span></div>
          <div className="flex items-center gap-3.5 mt-3.5">
            <div className="flex flex-col items-center gap-1.5"><Avatar initials={s.profile.displayName.slice(0, 2).toUpperCase()} color="#C8FF3D" fg="#0C0D11" size={52} /><span className="text-[11px] font-bold">You · {you}</span></div>
            <div className="flex-1">
              <div className="display text-[24px] text-center">{(you + them).toLocaleString()} <span className="text-[14px] text-muted font-semibold">/ {tgt.toLocaleString()}</span></div>
              <div className="mt-2 h-2.5 rounded-full bg-ink overflow-hidden flex"><div className="a-grow h-2.5 bg-lime" style={{ width: `${Math.min(100, (you / tgt) * 100)}%` }} /><div className="a-grow h-2.5 bg-blue" style={{ width: `${Math.min(100, (them / tgt) * 100)}%`, animationDelay: ".3s" }} /></div>
              <div className="text-[11px] text-muted font-semibold text-center mt-1.5">Both win 200 gems, or neither does</div>
            </div>
            <div className="flex flex-col items-center gap-1.5"><Avatar initials={(partner?.displayName ?? duo.partnerName).slice(0, 2).toUpperCase()} color={partner?.color ?? "#3D4EFF"} size={52} /><span className="text-[11px] font-bold">{duo.partnerName} · {them}</span></div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 px-6 pt-4 pb-5">
        <div className="text-[11px] font-bold text-muted tracking-[1px] uppercase pb-0.5">This week</div>
        {s.friends.map((f) => {
          const nudged = s.nudgedToday.includes(f.id);
          const cheered = s.cheered.includes(f.id);
          return (
            <div key={f.id} className={`flex items-center gap-3 px-3.5 py-3 rounded-2xl bg-ink-3 ${f.atRisk && !f.doneToday ? "border-[1.5px] border-coral" : ""}`}>
              <div className="relative"><Avatar initials={f.displayName.split(" ").map((x) => x[0]).join("")} color={f.color} size={42} ring={f.movingNow} />{f.atRisk && !f.doneToday && <div className="absolute -right-0.5 -top-0.5 w-3 h-3 rounded-full bg-coral border-2 border-ink-3 a-blink" />}</div>
              <div className="flex-1"><div className="font-bold text-[14px]">{f.displayName}{f.isDuo && <span className="ml-1.5 text-[10px] text-lime font-bold bg-lime/12 px-1.5 py-0.5 rounded-full">Duo</span>}</div>
                <div className={`text-[12px] font-semibold ${f.atRisk && !f.doneToday ? "text-coral" : f.movingNow ? "text-lime" : "text-muted"}`}>{f.movingNow ? "Moving now" : f.atRisk && !f.doneToday ? `${f.streak}-day streak at risk · no Set yet` : f.doneToday ? `Done today · ${f.streak}-day streak` : `${f.streak}-day streak`}</div></div>
              {f.atRisk && !f.doneToday ? (
                <button onClick={() => s.nudge(f.id)} disabled={nudged} className={`h-[38px] px-3.5 rounded-full font-extrabold text-[13px] ${nudged ? "bg-ink-4 text-muted" : "bg-coral text-ink"}`}>{nudged ? "Sent" : "Nudge"}</button>
              ) : f.doneToday || f.movingNow ? (
                <button onClick={() => s.cheer(f.id)} aria-label={`Cheer ${f.displayName}`} className={`w-[38px] h-[38px] rounded-full flex items-center justify-center ${cheered ? "bg-lime text-ink" : "bg-ink-4 text-text"}`}><Icon.Thumb /></button>
              ) : (
                <div className="flex items-center gap-1"><Icon.Flame size={16} /><span className="font-extrabold text-[14px]">{f.streak}</span></div>
              )}
            </div>
          );
        })}
      </div>

      <Link href="/crew" className="mx-6 mb-5 rounded-[18px] border-[1.5px] border-dashed border-ink-4 px-4 py-3.5 flex items-center gap-3">
        <div className="flex">{[0, 1, 2].map((i) => <div key={i} className="w-7 h-7 rounded-full bg-ink-4 border-2 border-ink box-border" style={{ marginLeft: i ? -8 : 0 }} />)}</div>
        <div className="flex-1"><div className="font-bold text-[14px]">Tuesday Crew</div><div className="text-[12px] text-muted font-semibold">Up to 12 people, one weekly goal</div></div>
        <span className="text-[11px] font-bold text-muted bg-ink-3 px-2 py-1 rounded-full">9 of 12</span>
      </Link>
      <TabBar />
    </div>
  );
}
