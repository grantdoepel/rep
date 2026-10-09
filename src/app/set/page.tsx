"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { MOVEMENT_BY_ID, TRACKS } from "@/lib/content";
import { Icon } from "@/components/ui";

const GYM_SWAP: Record<string, string> = { full_pushup: "bench press", knee_pushup: "incline bench", bodyweight_squat: "goblet squat", split_squat: "leg press", door_row: "lat pulldown", table_row: "seated row" };

export default function SetPage() {
  const s = useStore();
  const router = useRouter();
  const [i, setI] = useState(0);
  const [secs, setSecs] = useState(0);
  const [hold, setHold] = useState<{ running: boolean; t: number }>({ running: false, t: 0 });
  const [audio, setAudio] = useState(false);
  const synth = useRef<SpeechSynthesis | null>(null);
  const finishing = useRef(false);

  useEffect(() => { if (s.hydrated && !s.active && !finishing.current) router.replace("/"); }, [s.hydrated, s.active, router]);
  useEffect(() => { const t = setInterval(() => setSecs((x) => x + 1), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { if (!hold.running) return; const t = setInterval(() => setHold((h) => ({ ...h, t: h.t + 1 })), 1000); return () => clearInterval(t); }, [hold.running]);
  useEffect(() => { if (typeof window !== "undefined") synth.current = window.speechSynthesis ?? null; }, []);

  const set = s.active;
  const move = set?.moves[i];
  const mv = move ? MOVEMENT_BY_ID[move.movement] : undefined;
  const speak = (text: string) => { if (!audio || !synth.current) return; synth.current.cancel(); const u = new SpeechSynthesisUtterance(text); u.rate = 1; synth.current.speak(u); };
  useEffect(() => { if (mv && move) speak(`${mv.name}. Target ${move.target} ${mv.unit}. ${mv.cue}`); /* eslint-disable-next-line */ }, [i, audio]);
  if (!set || !move || !mv) return <div className="screen" />;
  const achieved = mv.unit === "seconds" ? (hold.running || move.achieved === undefined ? hold.t : move.achieved) : (move.achieved ?? 0);
  const hit = achieved >= move.target;
  const isLast = i === set.moves.length - 1;
  const trackName = TRACKS.find((t) => t.id === mv.track)?.name;
  const level = s.crowns[mv.track]?.level ?? 1;


  const setReps = (n: number) => s.recordMove(i, Math.max(0, Math.min(n, 99)));
  const next = () => {
    if (mv.unit === "seconds" && (hold.running || move.achieved === undefined)) s.recordMove(i, hold.t);
    if (isLast) { finishing.current = true; const r = s.finishSet(); router.push(`/done?xp=${r.xp}&perfect=${r.perfect ? 1 : 0}&crowns=${r.crownUps.join(",")}`); return; }
    setI(i + 1); setHold({ running: false, t: 0 });
  };
  const m = Math.floor(secs / 60), sec = secs % 60;

  return (
    <div className="screen bg-ink">
      <div className="safe-top px-6 pt-10">
        <div className="flex items-center justify-between">
          <Link href="/" aria-label="Close" className="w-10 h-10 rounded-full bg-ink-3 flex items-center justify-center"><Icon.Close /></Link>
          <div className="text-[13px] font-bold text-muted tracking-[1px] uppercase">Move {i + 1} of {set.moves.length}</div>
          <button onClick={() => setAudio(!audio)} aria-label="Toggle audio mode" className={`w-10 h-10 rounded-full flex items-center justify-center ${audio ? "bg-lime text-ink" : "bg-ink-3 text-muted"}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M3 10v4h4l5 4V6L7 10zM16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12" /></svg>
          </button>
        </div>
        <div className="flex gap-1.5 mt-4">{set.moves.map((_, j) => <div key={j} className="flex-1 h-[5px] rounded-full" style={{ background: j < i ? "#C8FF3D" : j === i ? "#6E8A1F" : "#2A2D38" }} />)}</div>
      </div>

      <div className="mx-6 mt-5 rounded-[28px] bg-ink-2 h-[260px] relative overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0" style={{ background: "radial-gradient(circle at 50% 80%, rgba(200,255,61,.18), transparent 60%)" }} />
        <svg className="a-bob" width="200" height="180" viewBox="0 0 220 200" fill="none" stroke="#C8FF3D" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" aria-label={mv.name}><circle cx="52" cy="78" r="16" fill="#C8FF3D" stroke="none" /><path d="M68 96 L150 118 L200 130" /><path d="M88 101 L84 150" /><path d="M118 108 L112 150" /><path d="M200 130 L206 160" /></svg>
        <div className="absolute left-5 top-5 text-[11px] font-bold bg-text/10 rounded-full px-2.5 py-1.5">{trackName} · Crown {level}{set.kind === "rescue" ? " · Rescue" : set.kind === "rest" ? " · Rest day" : ""}</div>
        <div className="absolute right-5 top-4 display text-[30px]">{m}:{String(sec).padStart(2, "0")}</div>
        <div className="absolute left-5 right-5 bottom-4 text-[13px] text-text-2 leading-[1.4]">{mv.cue}</div>
      </div>

      <div className="px-6 pt-5">
        <div className="display text-[34px]">{mv.name}</div>
        <div className="text-[14px] text-muted mt-2 font-medium">Target <span className="text-text font-bold">{move.target} {mv.unit === "seconds" ? "sec" : "reps"}</span>{s.profile.environment !== "gym" && GYM_SWAP[mv.id] && <> · gym swap: {GYM_SWAP[mv.id]}</>}</div>
      </div>

      <div className="mx-6 mt-5 bg-ink-3 rounded-[22px] px-5 py-4">
        <div className="text-[12px] font-bold text-muted tracking-[1px] uppercase">{mv.unit === "seconds" ? "Hold" : "How many did you get?"}</div>
        <div className="flex items-center justify-between mt-3">
          {mv.unit === "seconds" ? (
            <>
              <div><div className={`display text-[64px] a-pop ${hit ? "text-lime" : ""}`}>{achieved}<span className="text-[20px] text-muted">s</span></div><div className={`text-[12px] font-bold mt-1 ${hit ? "text-lime" : "text-muted"}`}>{hit ? "Target hit" : `${move.target - achieved}s to go`}</div></div>
              <button onClick={() => { if (hold.running) { s.recordMove(i, hold.t); setHold({ ...hold, running: false }); } else { setHold({ running: true, t: 0 }); } }} className={`w-[76px] h-[76px] rounded-full font-extrabold text-[14px] ${hold.running ? "bg-coral text-ink" : "bg-lime text-ink"}`}>{hold.running ? "Stop" : move.achieved ? "Redo" : "Start"}</button>
            </>
          ) : (
            <>
              <button onClick={() => setReps(achieved - 1)} aria-label="One fewer" className="w-14 h-14 rounded-full bg-ink-4 text-[28px] font-medium">−</button>
              <div className="text-center"><div className={`display text-[64px] a-pop ${hit ? "text-lime" : ""}`} key={achieved}>{achieved}</div><div className={`text-[12px] font-bold mt-1 ${hit ? "text-lime" : "text-muted"}`}>{hit ? `Target hit · counts toward Crown ${level}` : `${move.target - achieved} short of target`}</div></div>
              <button onClick={() => setReps(achieved + 1)} aria-label="One more" className="w-14 h-14 rounded-full bg-lime text-ink text-[28px] font-semibold">+</button>
            </>
          )}
        </div>
      </div>

      <div className="mt-auto px-6 pb-8 safe-bottom flex flex-col gap-2.5 pt-4">
        <button onClick={next} className="h-[58px] rounded-2xl bg-lime text-ink font-extrabold text-[17px]">{isLast ? "Finish Set" : "Next move"}</button>
        {mv.regression && <button onClick={() => s.swapEasier(i)} className="h-12 rounded-[14px] border-[1.5px] border-ink-4 text-muted font-bold text-[14px]">Too hard today → swap to {MOVEMENT_BY_ID[mv.regression].name.toLowerCase()}</button>}
      </div>
    </div>
  );
}
