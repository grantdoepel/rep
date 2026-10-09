"use client";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";

// Front camera by default (never rear: nobody in a gym should feel filmed). Downscaled to ~640px, kept 24h, shown to Duo + Crew.
export function ProofShot({ onDone }: { onDone?: () => void }) {
  const s = useStore();
  const video = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [taken, setTaken] = useState<string | null>(null);
  const today = s.proofShots.find((p) => p.date === (s.lastDone?.date ?? ""));

  useEffect(() => () => { stream?.getTracks().forEach((t) => t.stop()); }, [stream]);

  const start = async () => {
    setErr(null);
    try {
      const st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 960 } }, audio: false });
      setStream(st); setOpen(true);
      requestAnimationFrame(() => { if (video.current) { video.current.srcObject = st; video.current.play().catch(() => {}); } });
    } catch { setErr("Camera not available. Totally fine; the Set still counts."); }
  };
  const snap = () => {
    const v = video.current; if (!v) return;
    const w = 640, h = Math.round((v.videoHeight / v.videoWidth) * w) || 853;
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const ctx = c.getContext("2d")!; ctx.translate(w, 0); ctx.scale(-1, 1); ctx.drawImage(v, 0, 0, w, h);
    const url = c.toDataURL("image/jpeg", 0.8);
    setTaken(url); stream?.getTracks().forEach((t) => t.stop()); setStream(null);
  };
  const keep = () => { if (taken) s.addProofShot(taken); setOpen(false); setTaken(null); onDone?.(); };
  const retake = () => { setTaken(null); start(); };

  if (today && !open) return (
    <div className="flex items-center gap-3 bg-ink/8 rounded-[18px] px-4 py-3">
      <img src={today.dataUrl} alt="Your proof shot" className="w-12 h-16 object-cover rounded-lg" />
      <div className="flex-1"><div className="font-extrabold text-[14px]">Proof shot sent</div><div className="text-[12px] opacity-70">Your Duo and Crew can see it for 24 hours.</div></div>
    </div>
  );

  if (!open) return (
    <div>
      <button onClick={start} className="w-full h-[50px] rounded-[14px] bg-ink/10 font-extrabold text-[15px] flex items-center justify-center gap-2">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
        Proof shot (optional)
      </button>
      {err && <div className="text-[12px] opacity-70 mt-2 text-center">{err}</div>}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-ink flex flex-col">
      <div className="safe-top px-6 pt-10 flex items-center justify-between text-text">
        <button onClick={() => { stream?.getTracks().forEach((t) => t.stop()); setStream(null); setOpen(false); setTaken(null); }} className="w-10 h-10 rounded-full bg-ink-3 flex items-center justify-center" aria-label="Close camera"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
        <div className="text-[12px] font-bold text-lime tracking-[1.5px] uppercase">Proof shot</div>
        <div className="w-10" />
      </div>
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="relative w-full max-w-[360px] aspect-[3/4] rounded-[28px] overflow-hidden bg-ink-2">
          {taken ? <img src={taken} alt="Preview" className="w-full h-full object-cover" /> : <video ref={video} playsInline muted className="w-full h-full object-cover" style={{ transform: "scaleX(-1)" }} />}
          <div className="absolute left-4 top-4 text-[11px] font-bold bg-ink/70 text-text rounded-full px-2.5 py-1.5">Front camera · sweaty is the point</div>
        </div>
      </div>
      <div className="px-6 pb-10 safe-bottom flex flex-col gap-2.5 text-text">
        {taken ? <>
          <button onClick={keep} className="h-14 rounded-2xl bg-lime text-ink font-extrabold text-[16px]">Send to Duo and Crew</button>
          <button onClick={retake} className="h-11 rounded-xl text-muted font-bold text-[14px]">Retake</button>
        </> : (
          <button onClick={snap} aria-label="Take photo" className="w-[76px] h-[76px] rounded-full bg-text mx-auto border-[6px] border-ink-4" />
        )}
      </div>
    </div>
  );
}
