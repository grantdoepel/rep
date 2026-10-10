"use client";
// PRD 5 · Letters from past-you: the offer on the Done screen (lime ground, ink text).
// Shown at most once a week, after a perfect Set or once the week's promise is kept.
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { track } from "@/lib/analytics";
import { localDate, weekStart } from "@/lib/rules";
import { NOTE_MAX_SECONDS, NOTE_OFFERED_WEEK, NOTE_TEXT_MAX, blobToDataUrl, clearLocalNote, keptThisWeek, pickMime, storeLocalNote, uploadNote } from "@/lib/notes";
import { Vee } from "@/components/Vee";
import { haptic } from "@/components/ui";

type Stage = "offer" | "recording" | "review" | "text" | "saving" | "kept";

export function NoteOffer({ perfect }: { perfect: boolean }) {
  const s = useStore();
  const [show, setShow] = useState(false);
  const [stage, setStage] = useState<Stage>("offer");
  const [elapsed, setElapsed] = useState(0);            // tenths of a second while recording
  const [text, setText] = useState("");
  const [blob, setBlob] = useState<Blob | null>(null);
  const mimeRef = useRef<ReturnType<typeof pickMime>>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewRef = useRef<HTMLAudioElement | null>(null);

  // Eligibility is decided once, after mount (dates and localStorage are browser-only).
  const decidedRef = useRef<boolean | null>(null);   // survives StrictMode's double effect so the weekly gate isn't self-defeating
  useEffect(() => {
    if (!s.hydrated) return;
    if (decidedRef.current === null) {
      const today = s.today?.date ?? localDate(new Date(), s.profile.timezone);
      const ws = weekStart(today);
      let offered: string | null = null;
      try { offered = localStorage.getItem(NOTE_OFFERED_WEEK); } catch {}
      const kept = keptThisWeek(s.log, today);
      const promise = s.profile.promiseDays ?? 4;
      decidedRef.current = offered !== ws && (perfect || kept >= promise);
      if (decidedRef.current) { try { localStorage.setItem(NOTE_OFFERED_WEEK, ws); } catch {} }
    }
    if (!decidedRef.current) return;
    const id = setTimeout(() => setShow(true), 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.hydrated]);

  useEffect(() => () => teardown(), []);

  function teardown() {
    if (timerRef.current) clearInterval(timerRef.current); timerRef.current = null;
    if (stopRef.current) clearTimeout(stopRef.current); stopRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null;
    recRef.current = null;
  }

  async function startRecording() {
    const mime = pickMime();
    if (!mime) { setStage("text"); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const rec = new MediaRecorder(stream, { mimeType: mime.mime });
      mimeRef.current = mime; recRef.current = rec; chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const b = new Blob(chunksRef.current, { type: mime.mime });
        teardown();
        if (b.size === 0) { setStage("offer"); return; }
        setBlob(b); setStage("review");
      };
      rec.start(250);
      setElapsed(0); setStage("recording"); haptic();
      timerRef.current = setInterval(() => setElapsed((e) => Math.min(NOTE_MAX_SECONDS * 10, e + 1)), 100);
      stopRef.current = setTimeout(() => stopRecording(), NOTE_MAX_SECONDS * 1000);   // hard stop at 10s
    } catch {
      teardown(); setStage("text");
    }
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current); timerRef.current = null;
    if (stopRef.current) clearTimeout(stopRef.current); stopRef.current = null;
    const rec = recRef.current;
    if (rec && rec.state !== "inactive") rec.stop(); else teardown();
    haptic();
  }

  function again() {
    previewRef.current?.pause(); previewRef.current = null;
    setBlob(null); setStage("offer");
    void startRecording();
  }

  function preview() {
    if (!blob) return;
    previewRef.current?.pause();
    const a = new Audio(URL.createObjectURL(blob)); previewRef.current = a; a.play().catch(() => {});
  }

  async function keepVoice() {
    if (!blob || !mimeRef.current) return;
    setStage("saving");
    const now = new Date().toISOString();
    const dataUrl = await blobToDataUrl(blob).catch(() => null);
    const local = dataUrl ? storeLocalNote(dataUrl) : false;
    if (!local) clearLocalNote();
    if (s.online && s.userId) await uploadNote(s.userId, blob, mimeRef.current.ext);
    s.patchProfile({ noteRecordedAt: now, noteText: "" });
    track("note_recorded", { mode: "voice" });
    setStage("kept");
  }

  function keepText() {
    const t = text.trim().slice(0, NOTE_TEXT_MAX);
    if (!t) return;
    clearLocalNote();
    s.patchProfile({ noteText: t, noteRecordedAt: new Date().toISOString() });
    track("note_recorded", { mode: "text" });
    setStage("kept");
  }

  if (!show) return null;

  if (stage === "kept") {
    return (
      <div className="a-rise rounded-[18px] bg-ink/8 px-4 py-3 flex items-center gap-3">
        <Vee size={40} mood="proud" />
        <div className="t-body font-semibold">Kept. You&apos;ll hear it when you need it.</div>
      </div>
    );
  }

  if (stage === "text") {
    const left = NOTE_TEXT_MAX - text.length;
    return (
      <div className="a-rise rounded-[18px] bg-ink/8 px-4 py-3.5">
        <div className="flex items-center gap-3">
          <Vee size={40} mood="happy" />
          <div className="t-body font-semibold">Or write it.</div>
        </div>
        <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, NOTE_TEXT_MAX))} rows={2} maxLength={NOTE_TEXT_MAX} placeholder="You said you'd move today. Three minutes." aria-label="Your note" className="mt-3 w-full rounded-xl bg-ink text-text placeholder:text-muted px-3.5 py-3 text-[15px] leading-[1.4] outline-none resize-none" />
        <div className="mt-2 flex items-center justify-between">
          <span className="t-small opacity-60 t-num">{left}</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setShow(false)} className="press h-11 px-3 font-bold text-[14px] opacity-70">Not now</button>
            <button onClick={keepText} disabled={!text.trim()} className="press h-11 px-5 rounded-xl bg-ink text-text font-extrabold text-[14px] disabled:opacity-40">Keep</button>
          </div>
        </div>
      </div>
    );
  }

  if (stage === "recording" || stage === "review" || stage === "saving") {
    const filled = stage === "recording" ? Math.floor(elapsed / 10) + (elapsed % 10 > 0 ? 1 : 0) : NOTE_MAX_SECONDS;
    const secs = Math.min(NOTE_MAX_SECONDS, Math.ceil(elapsed / 10));
    return (
      <div className="a-rise rounded-[18px] bg-ink text-text px-4 py-4" aria-live="polite">
        <div className="flex items-center justify-between">
          <div className="t-small font-bold text-muted">{stage === "recording" ? "Recording" : stage === "saving" ? "Keeping it" : "Listen back, or keep it"}</div>
          <div className="t-num text-[14px] text-muted">{stage === "recording" ? `${secs}s` : `${NOTE_MAX_SECONDS}s`}</div>
        </div>
        <div className="mt-3 grid grid-cols-10 gap-1" role="progressbar" aria-valuemin={0} aria-valuemax={NOTE_MAX_SECONDS} aria-valuenow={secs}>
          {Array.from({ length: NOTE_MAX_SECONDS }, (_, i) => <div key={i} className={`h-2 rounded-full transition-colors duration-200 ${i < filled ? "bg-lime" : "bg-ink-4"}`} />)}
        </div>
        {stage === "recording" ? (
          <div className="mt-4 flex flex-col items-center gap-2">
            <button onClick={stopRecording} aria-label="Stop recording" className="press w-[72px] h-[72px] rounded-full bg-ink border-[3px] border-lime flex items-center justify-center"><span className="w-5 h-5 rounded-[4px] bg-lime" /></button>
            <div className="t-small text-muted">Tap to stop. It stops itself at ten.</div>
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-2">
            <button onClick={preview} disabled={stage === "saving"} className="press h-11 px-3 font-bold text-[14px] text-muted disabled:opacity-40">Play</button>
            <div className="flex-1" />
            <button onClick={again} disabled={stage === "saving"} className="press h-11 px-4 rounded-xl bg-ink-3 font-bold text-[14px] disabled:opacity-40">Again</button>
            <button onClick={keepVoice} disabled={stage === "saving"} className="press h-11 px-5 rounded-xl bg-lime text-ink font-extrabold text-[14px] disabled:opacity-60">{stage === "saving" ? "Keeping…" : "Keep"}</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="a-rise rounded-[18px] bg-ink/8 px-4 py-3.5 flex items-center gap-3">
      <Vee size={40} mood="happy" />
      <div className="flex-1 min-w-0">
        <div className="t-body font-semibold leading-[1.3]">Leave a note for the you who wants to skip.</div>
        <div className="mt-2.5 flex items-center gap-2">
          <button onClick={startRecording} className="press h-11 px-5 rounded-xl bg-ink text-text font-extrabold text-[14px]">Record</button>
          <button onClick={() => setShow(false)} className="press h-11 px-3 font-bold text-[14px] opacity-70">Not now</button>
        </div>
      </div>
    </div>
  );
}
