"use client";
// PRD 5 · Letters from past-you: the evening card. Shows once a day, only when the promise is at risk
// or the rescue hour has started, and only while a note exists. Tap anywhere to hear (or read) it.
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { track } from "@/lib/analytics";
import { daysAgo, hasNote, promiseAtRisk, readLocalNote, rescueHourStarted, signedNoteUrl } from "@/lib/notes";
import { Icon, haptic } from "@/components/ui";

const TEXT_SECONDS = 6;

export function NotePlayback({ today }: { today: string }) {
  const s = useStore();
  const [eligible, setEligible] = useState(false);
  const [ago, setAgo] = useState("");
  const [phase, setPhase] = useState<"idle" | "loading" | "playing" | "reading" | "fading">("idle");
  const [gone, setGone] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { noteRecordedAt, noteText } = s.profile;
  const promiseDays = s.profile.promiseDays ?? 4;
  const rescueAt = s.profile.rescueAt ?? "21:00";

  // Time-dependent gates run after mount; re-check each minute so the card appears as the rescue hour begins.
  useEffect(() => {
    if (!s.hydrated) return;
    const check = () => {
      const now = new Date();
      const exists = hasNote({ noteRecordedAt, noteText });
      const unplayed = s.notePlayedOn !== today;
      const due = promiseAtRisk(s.log, today, promiseDays) || rescueHourStarted(now, rescueAt);
      setEligible(exists && unplayed && due);
      if (noteRecordedAt) setAgo(daysAgo(noteRecordedAt, now));
    };
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [s.hydrated, s.log, s.notePlayedOn, today, noteRecordedAt, noteText, promiseDays, rescueAt]);

  useEffect(() => () => { audioRef.current?.pause(); audioRef.current = null; }, []);

  function finish() {
    setPhase("fading");
    s.patch(() => ({ notePlayedOn: today }));
    track("note_played", { mode: noteText ? "text" : "voice" });
    setTimeout(() => setGone(true), 500);
  }

  async function play() {
    if (phase !== "idle") return;
    haptic();
    const local = readLocalNote();
    const voice = Boolean(noteRecordedAt) && (local || (s.online && s.userId));
    if (voice) {
      setPhase("loading");
      const src = local ?? (s.userId ? await signedNoteUrl(s.userId) : null);
      if (src) {
        const a = new Audio(src); audioRef.current = a;
        a.onended = finish;
        a.onerror = () => { if (noteText) { setPhase("reading"); setTimeout(finish, TEXT_SECONDS * 1000); } else finish(); };
        try { await a.play(); setPhase("playing"); return; } catch { /* fall through to text */ }
      }
    }
    if (noteText) { setPhase("reading"); setTimeout(finish, TEXT_SECONDS * 1000); return; }
    finish();
  }

  if (!eligible || gone) return null;

  const fade = phase === "fading" ? "opacity-0 translate-y-1" : "opacity-100";

  if (phase === "reading") {
    return (
      <div className={`a-rise rounded-[22px] bg-ink-3 px-5 py-6 transition-all duration-500 ${fade}`} aria-live="polite">
        <div className="t-micro text-muted">A note from you{ago ? ` · ${ago}` : ""}</div>
        <div className="display t-h2 mt-3 leading-[1.15]">&ldquo;{noteText}&rdquo;</div>
      </div>
    );
  }

  return (
    <button onClick={play} className={`press a-rise w-full text-left rounded-[22px] bg-ink-3 hairline px-4 py-3.5 flex items-center gap-3.5 transition-all duration-500 ${fade}`} aria-label="Play a note from you">
      <span className={`w-11 h-11 rounded-full bg-lime flex items-center justify-center shrink-0 ${phase === "playing" ? "a-blink" : ""}`}>
        {phase === "playing" ? <span className="w-3.5 h-3.5 rounded-[3px] bg-ink" /> : phase === "loading" ? <span className="w-3 h-3 rounded-full bg-ink/40" /> : <Icon.Play size={18} color="#0C0D11" />}
      </span>
      <span className="flex-1 min-w-0 t-body font-semibold">{phase === "playing" ? "Listen." : phase === "loading" ? "Finding it." : "A note from you"}</span>
      {ago && <span className="t-small text-muted shrink-0">{ago}</span>}
    </button>
  );
}
