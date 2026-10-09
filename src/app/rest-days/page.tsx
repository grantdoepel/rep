"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useStore } from "@/lib/store";
import type { Environment, Flag, GoalTier } from "@/lib/types";
import { Mascot, TopBar } from "@/components/ui";
import { Reminders } from "@/components/Reminders";
import { Account } from "@/components/Account";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FLAGS: [Flag, string][] = [["knees", "Knees or hips"], ["shoulders", "Shoulders"], ["wrists", "Wrists"], ["low_back", "Low back"], ["seated", "Seated only"], ["low_impact", "Low impact only"]];

export default function RestDays() {
  const s = useStore();
  const router = useRouter();
  const [days, setDays] = useState<number[]>(s.profile.restDays);
  const [goal, setGoal] = useState<GoalTier>(s.profile.goalTier);
  const [env, setEnv] = useState<Environment>(s.profile.environment);
  const [flags, setFlags] = useState<Flag[]>([...s.profile.injuryFlags, ...s.profile.accessibility]);
  const [gymName, setGymName] = useState(s.profile.gymName ?? "");
  const [gymStatus, setGymStatus] = useState<string | null>(null);
  const saveGym = () => { if (!navigator.geolocation) { setGymStatus("No location on this device."); return; } setGymStatus("Finding you…"); navigator.geolocation.getCurrentPosition((pos) => { s.setGym(pos.coords.latitude, pos.coords.longitude, gymName.trim() || "My gym"); setGymStatus("Saved. Arrive here and uvu will ask for a proof shot."); }, () => setGymStatus("Location permission was declined."), { enableHighAccuracy: true, timeout: 10000 }); };
  const toggle = (d: number) => setDays(days.includes(d) ? days.filter((x) => x !== d) : days.length < 2 ? [...days, d] : days);
  const picked = [1, 2, 3, 4, 5, 6, 0].filter((d) => days.includes(d)).map((d) => DAYS[d]);
  const save = () => { s.updateProfile({ restDays: days, goalTier: goal, environment: env, injuryFlags: flags.filter((f) => !["seated", "low_impact"].includes(f)), accessibility: flags.filter((f) => ["seated", "low_impact"].includes(f)) }); router.push("/profile"); };

  return (
    <div className="screen">
      <TopBar title="Settings" back="/profile" />
      <div className="px-6 pt-6">
        <div className="flex items-center gap-3"><svg className="a-bob" width="36" height="36" viewBox="0 0 24 24" fill="#3D4EFF" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg><div className="display t-h2">Rest counts too.</div></div>
        <div className="text-[14px] text-muted mt-3 leading-[1.45]">Pick up to two days a week. On those days a 3-minute Mobility Set keeps your streak, the Set generator plans around them, and the mascot stops nagging.</div>
      </div>
      <div className="flex justify-between px-6 pt-5">{[1, 2, 3, 4, 5, 6, 0].map((d) => { const on = days.includes(d); return <button key={d} onClick={() => toggle(d)} className={`w-[42px] h-14 rounded-[14px] font-extrabold text-[14px] flex flex-col items-center justify-center gap-1 ${on ? "bg-blue text-text" : "bg-ink-3 text-muted"}`}>{DAYS[d][0]}<span className="w-1.5 h-1.5 rounded-full" style={{ background: on ? "#F4F5F7" : "transparent" }} /></button>; })}</div>
      <div className="text-[12px] text-muted px-6 pt-2.5 font-semibold">{days.length === 0 ? "No rest days. The mascot will have opinions about this." : days.length === 1 ? `One rest day: ${picked[0]}. You can add one more.` : `Two rest days: ${picked.join(" and ")}. That's the max.`}</div>

      <div className="mx-6 mt-5"><Mascot line="Rest day. I mean it. Three minutes of stretching and then go sit down. You earned the sitting." /></div>

      <div className="px-6 pt-6"><div className="t-micro text-muted">Daily goal</div>
        <div className="flex bg-ink-3 rounded-full p-1 mt-2.5">{(["casual", "regular", "serious"] as const).map((k) => <button key={k} onClick={() => setGoal(k)} className={`flex-1 h-10 rounded-full font-bold text-[13px] capitalize ${goal === k ? "bg-lime text-ink" : "text-muted"}`}>{k}</button>)}</div></div>
      <div className="px-6 pt-4"><div className="t-micro text-muted">Where you train</div>
        <div className="flex bg-ink-3 rounded-full p-1 mt-2.5">{(["home", "gym", "travel"] as const).map((k) => <button key={k} onClick={() => setEnv(k)} className={`flex-1 h-10 rounded-full font-bold text-[13px] capitalize ${env === k ? "bg-lime text-ink" : "text-muted"}`}>{k}</button>)}</div></div>
      <div className="px-6 pt-4"><div className="t-micro text-muted">Work around</div>
        <div className="flex flex-wrap gap-2 mt-2.5">{FLAGS.map(([f, n]) => <button key={f} onClick={() => setFlags(flags.includes(f) ? flags.filter((x) => x !== f) : [...flags, f])} className={`h-9 px-3 rounded-full border-[1.5px] font-bold text-[12px] ${flags.includes(f) ? "border-lime bg-lime/8" : "border-ink-4 bg-ink-3 text-muted"}`}>{n}</button>)}</div>
        <div className="text-[12px] text-muted mt-2.5 leading-[1.4]">Every track keeps a full tree; movements swap, levels don't shrink. A level cleared at Foundation is cleared.</div></div>

      <div className="px-6 pt-4"><div className="t-micro text-muted">Gym arrival reminder</div>
        <div className="flex gap-2 mt-2.5"><input value={gymName} onChange={(e) => setGymName(e.target.value)} placeholder="Gym name" className="flex-1 h-11 rounded-xl bg-ink-3 border-[1.5px] border-ink-4 px-3.5 text-[14px] outline-none focus:border-lime" /><button onClick={saveGym} className="h-11 px-4 rounded-xl bg-ink-3 font-bold text-[13px] text-lime">{s.profile.gymLat ? "Re-pin" : "Pin here"}</button></div>
        <div className="text-[12px] text-muted mt-2 leading-[1.4]">{gymStatus ?? (s.profile.gymLat ? `Pinned: ${s.profile.gymName}. Arrive and uvu asks for a proof shot.` : "Stand at the gym door and tap Pin here. Only your device keeps the coordinates.")}</div></div>

      <div className="px-6 pt-4"><div className="t-micro text-muted mb-2.5">Account</div><Account /></div>
      <div className="px-6 pt-4"><div className="t-micro text-muted mb-2.5">Reminders</div><Reminders /></div>

      <div className="mt-auto px-6 pb-8 safe-bottom pt-5"><button onClick={save} className="h-14 rounded-2xl bg-lime text-ink font-extrabold text-[16px] w-full">Save</button></div>
    </div>
  );
}
