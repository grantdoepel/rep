"use client";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { Avatar, Icon, TopBar } from "@/components/ui";

export default function Live() {
  const s = useStore();
  const router = useRouter();
  const moving = s.friends.filter((f) => f.movingNow);
  return (
    <div className="screen">
      <TopBar back="/friends" right={<div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-lime a-blink" /><span className="text-[12px] font-bold text-lime tracking-[1.5px] uppercase">Live</span></div>} />
      <div className="px-6 pt-4"><div className="display t-h1">Moving right now</div><div className="text-[13px] text-muted mt-1.5 font-medium">{moving.length} people you know · 212 in your league</div></div>
      <div className="flex flex-col gap-2.5 px-6 pt-5">
        {moving.length === 0 && <div className="bg-ink-3 rounded-[20px] p-5 text-[14px] text-muted leading-[1.4]">Nobody you know is mid-Set this minute. Start one and you'll be the one they join.</div>}
        {moving.map((f, i) => (
          <div key={f.id} className={`bg-ink-3 rounded-[20px] p-4 ${i === 0 ? "border-[1.5px] border-lime/35" : ""}`}>
            <div className="flex items-center gap-3"><Avatar initials={f.displayName.split(" ").map((x) => x[0]).join("")} color={f.color} size={44} ring /><div className="flex-1"><div className="font-bold text-[15px]">{f.displayName.split(" ")[0]}</div><div className="text-[12px] text-muted font-semibold">{i === 0 ? "Push + Core · move 2 of 4" : "Legs · Crown test"} · {3 + i * 2}:{String(10 + i * 30).padStart(2, "0")} in</div></div>{f.isCrew && <span className="text-[11px] font-bold text-lime bg-lime/12 px-2 py-1 rounded-full">Crew</span>}</div>
            <div className="mt-3 h-1.5 rounded-full bg-ink-4 overflow-hidden"><div className="a-grow h-1.5 bg-lime" style={{ width: `${40 + i * 25}%` }} /></div>
            {i === 0 && <button onClick={() => { s.startSet("normal"); router.push("/set"); }} className="mt-3 w-full h-[46px] rounded-[14px] bg-lime text-ink font-extrabold text-[14px] flex items-center justify-center gap-2"><Icon.Play color="#0C0D11" size={16} />Join the same Set</button>}
          </div>
        ))}
      </div>
      <div className="mx-6 mt-5 bg-ink-2 rounded-[18px] px-4 py-3.5">
        <div className="flex items-center justify-between"><div className="font-bold text-[14px] capitalize">{s.leagueTier} league, last hour</div><div className="text-[12px] text-muted font-semibold">212 moving</div></div>
        <div className="flex items-end gap-1 h-10 mt-3">{[30, 45, 40, 60, 55, 75, 70, 90, 100].map((h, i) => <div key={i} className="flex-1 rounded-[3px]" style={{ height: `${h}%`, background: i === 8 ? "#C8FF3D" : "#2A2D38" }} />)}</div>
        <div className="text-[12px] text-muted mt-2">Evening rush. You're not the only one who put it off.</div>
      </div>
      <div className="mt-auto px-6 pb-8 safe-bottom pt-5"><button onClick={() => { s.startSet("normal"); router.push("/set"); }} className="h-[58px] rounded-2xl bg-text text-ink font-extrabold text-[17px] w-full">Start my own Set</button></div>
    </div>
  );
}
