"use client";
// PRD 3 · Crews: the Home card. One line of faces, one bar, one number.
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { Avatar, Section } from "@/components/ui";

export function CrewCard({ daysLeft = 7 }: { daysLeft?: number }) {
  const s = useStore();
  const router = useRouter();
  const crew = s.crew;

  if (!crew) {
    if (!s.online) return null;
    return (
      <Section title="Crew">
        <div className="t-small text-muted">Three to six people, one target. Start one.</div>
        <button onClick={() => router.push("/crew")} className="press mt-2 h-11 -ml-3 px-3 rounded-xl text-[14px] font-semibold text-lime">Start a crew</button>
      </Section>
    );
  }

  const pct = crew.targetXp > 0 ? Math.min(100, (crew.xp / crew.targetXp) * 100) : 0;
  const members = [...crew.members].sort((a, b) => Number(b.isYou ?? false) - Number(a.isYou ?? false));
  return (
    <Section title={crew.name} right={crew.kept ? <span className="t-small font-bold text-lime">kept</span> : <span className="t-small text-muted-2 font-semibold">{daysLeft} day{daysLeft === 1 ? "" : "s"} left</span>}>
      <button onClick={() => router.push("/crew")} className="press block w-full text-left" aria-label={`${crew.name}: ${crew.xp} of ${crew.targetXp} XP together`}>
        <div className="flex items-center gap-2">
          {members.map((m) => (
            <div key={m.id} className={`rounded-full ${m.doneToday ? "ring-2 ring-lime ring-offset-2 ring-offset-ink" : ""}`}>
              <Avatar initials={m.displayName.split(" ").map((x) => x[0]).join("").slice(0, 2).toUpperCase()} color={m.color} fg={m.isYou ? "#0C0D11" : "#F4F5F7"} size={40} />
            </div>
          ))}
        </div>
        <div className="mt-3 h-2 rounded-full bg-ink-4 overflow-hidden"><div className="a-grow h-2 rounded-full bg-lime" style={{ width: `${pct}%` }} /></div>
        <div className="mt-1.5 t-small text-muted">{crew.xp.toLocaleString()} of {crew.targetXp.toLocaleString()} {crew.kept ? "· kept" : "together"}</div>
      </button>
    </Section>
  );
}
