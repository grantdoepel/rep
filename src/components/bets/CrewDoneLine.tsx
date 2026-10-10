"use client";
// PRD 3 · Crews: one line on the Done screen. Counts you as done (the Set just finished).
import { useStore } from "@/lib/store";

export function CrewDoneLine() {
  const s = useStore();
  const crew = s.crew;
  if (!crew || crew.members.length === 0) return null;
  const done = crew.members.filter((m) => m.doneToday || m.isYou).length;
  return <div className="t-small font-semibold opacity-75">Your crew: {done} of {crew.members.length} done today</div>;
}
