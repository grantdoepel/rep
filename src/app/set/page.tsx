"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { MOVEMENT_BY_ID, TRACKS } from "@/lib/content";
import { Icon, Ring, haptic } from "@/components/ui";

const GYM_SWAP: Record<string, string> = { full_pushup: "bench press", knee_pushup: "incline bench", bodyweight_squat: "goblet squat", split_squat: "leg press", door_row: "lat pulldown", table_row: "seated row" };

export default function SetPage() {
  const s = useStore();
  const router = useRouter();
  const [i, setI] = useState(0);
  const [secs, setSecs] = useState(0);
  const [hold, setHold] = useState<{ running: boolean; t: number }>({ running: false, t: 0 });
  const [audio, setAudio] = useState(false);
  const [beatKey, setBeatKey] = useState(0);
  const beaten = useRef<Set<number>>(new Set());
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

  const today = s.active?.date ?? "";
  const prev = move ? s.recent[move.movement] : undefined;
  const last = prev && prev.date < today ? prev.achieved : null;
  const isHold = mv?.unit === "seconds";
  const achieved = !move ? 0 : isHold ? (hold.running || move.achieved === undefined ? hold.t : move.achieved) : (move.achieved ?? 0);

  // the moment: first time this move passes last time
  useEffect(() => {
    if (last === null || beaten.current.has(i) || achieved <= last) return;
    beaten.current.add(i); haptic([14, 60, 22]); setBeatKey((k) => k + 1);
    speak("That's yesterday beaten.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [achieved, last, i]);

  if (!set || !move || !mv) return <div className="screen" />;
  const hit = achieved >= move.target;
  const beat = last !== null && achieved > last;
  const isLast = i === set.moves.length - 1;
  const trackName = TRACKS.find((t) => t.id === mv.track)?.name;
  const level = s.crowns[mv.track]?.level ?? 1;
  const ringValue = Math.min(1, achieved / Math.max(1, move.target));

  const setReps = (n: number) => { s.recordMove(i, Math.max(0, Math.min(n, 99))); haptic(6); };
  const tapRing = () => {
    if (!isHold) { setReps(achieved + 1); return; }
    if (hold.running) { s.recordMove(i, hold.t); setHold({ ...hold, running: false }); haptic(10); }
    else { setHold({ running: true, t: 0 }); haptic(10); }
  };
  const next = () => {
    const pendingHold = isHold && (hold.running || move.achieved === undefined);
    if (isLast) { finishing.current = true; const r = s.finishSet(pendingHold ? { index: i, achieved: hold.t } : undefined); router.push(`/done?xp=${r.xp}&perfect=${r.perfect ? 1 : 0}&crowns=${r.crownUps.join(",")}&beats=${r.beats}&moves=${r.moves}`); return; }
    if (pendingHold) s.recordMove(i, hold.t);
    setI(i + 1); setHold({ running: false, t: 0 });
  };
  const m = Math.floor(secs / 60), sec = secs % 60;

  return (
    <div className="screen bg-ink">
      <div className="safe-top px-6 pt-8">
        <div className="flex items-center justify-between">
          <Link href="/" aria-label="Close" className="press w-11 h-11 -ml-2 rounded-full flex items-center justify-center"><Icon.Close /></Link>
          <div className="t-micro text-muted">{set.kind === "rescue" ? "Rescue · " : set.kind === "rest" ? "Rest day · " : ""}Move {i + 1} of {set.moves.length} · <span className="t-num tracking-normal">{m}:{String(sec).padStart(2, "0")}</span></div>
          <button onClick={() => setAudio(!audio)} aria-label={audio ? "Turn voice off" : "Turn voice on"} aria-pressed={audio} className={`press w-11 h-11 -mr-2 rounded-full flex items-center justify-center ${audio ? "text-lime" : "text-muted"}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M3 10v4h4l5 4V6L7 10zM16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12" /></svg>
          </button>
        </div>
        <div className="flex gap-1.5 mt-4">{set.moves.map((_, j) => <div key={j} className="flex-1 h-1 rounded-full" style={{ background: j < i ? "#C8FF3D" : j === i ? "#6E8A1F" : "#262A35" }} />)}</div>
      </div>

      <div className="px-6 pt-7">
        <div className="t-micro text-muted">{trackName} · Crown {level}</div>
        <div className="display t-h1 mt-1.5">{mv.name}</div>
        <div className="t-small text-muted mt-2 leading-[1.45]">{mv.cue}{s.profile.environment !== "gym" && GYM_SWAP[mv.id] && <span className="text-muted-2"> · at a gym: {GYM_SWAP[mv.id]}</span>}</div>
      </div>

      {/* the ring is the control: tap to count, tap to start and stop a hold */}
      <div className="flex-1 flex flex-col items-center justify-center py-4">
        <button onClick={tapRing} aria-label={isHold ? (hold.running ? "Stop the hold" : "Start the hold") : "Count one more"} className="press relative">
          <Ring value={ringValue} size={248} width={14} color={beat ? "#C8FF3D" : hit ? "#C8FF3D" : "#F4F5F7"} track="rgba(244,245,247,0.07)">
            <div className="text-center">
              <div key={beatKey} className={`display t-hero ${beat || hit ? "text-lime" : "text-text"} ${beatKey ? "a-beat" : ""}`} style={{ fontSize: 84 }}>{achieved}</div>
              <div className="t-small font-semibold text-muted -mt-1">{isHold ? (hold.running ? "tap to stop" : achieved > 0 ? "tap to redo" : "tap to start") : `of ${move.target} · tap for +1`}</div>
            </div>
          </Ring>
          {isHold && hold.running && <span className="absolute inset-0 rounded-full border-2 border-lime a-ring pointer-events-none" />}
        </button>

        {/* the ledger line */}
        <div className="mt-5 flex items-center gap-5">
          <div className="text-center"><div className="t-micro text-muted-2">Last time</div><div className={`t-num text-[22px] ${last === null ? "text-muted-2" : "ghost"}`}>{last === null ? "—" : `${last}${isHold ? "s" : ""}`}</div></div>
          <div className="w-px h-8 bg-ink-4" />
          <div className="text-center"><div className="t-micro text-muted-2">Target</div><div className={`t-num text-[22px] ${hit ? "text-lime" : ""}`}>{move.target}{isHold ? "s" : ""}</div></div>
          <div className="w-px h-8 bg-ink-4" />
          <div className="text-center min-w-[88px]"><div className="t-micro text-muted-2">Verdict</div><div className={`t-small font-bold mt-0.5 ${beat ? "text-lime" : "text-muted"}`}>{last === null ? "First time" : beat ? "Beat it" : achieved === last ? "Matched" : `${last - achieved + 1} to beat`}</div></div>
        </div>

        {!isHold && <button onClick={() => setReps(achieved - 1)} aria-label="One fewer" className="press mt-4 h-10 px-4 rounded-full text-muted t-small font-bold">− one</button>}
      </div>

      <div className="px-6 pb-8 safe-bottom flex flex-col gap-2">
        <button onClick={next} className="press h-[58px] rounded-2xl bg-lime text-ink font-extrabold text-[17px]">{isLast ? "Finish Set" : "Next move"}</button>
        {mv.regression && <button onClick={() => s.swapEasier(i)} className="press h-11 rounded-xl text-muted font-bold text-[14px]">Too hard today · swap to {MOVEMENT_BY_ID[mv.regression].name.toLowerCase()}</button>}
      </div>
    </div>
  );
}
