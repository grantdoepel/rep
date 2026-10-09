"use client";
import { useEffect, useState } from "react";
import { sync } from "@/lib/supabase";
import { useStore } from "@/lib/store";

export function Reminders({ compact = false, onDark = true }: { compact?: boolean; onDark?: boolean }) {
  const s = useStore();
  const [status, setStatus] = useState<"unsupported" | "denied" | "on" | "off" | "loading">("loading");
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { sync.pushStatus().then(setStatus); }, []);
  if (status === "loading" || status === "unsupported" || status === "on" && compact) return null;
  const ios = typeof navigator !== "undefined" && /iPhone|iPad/.test(navigator.userAgent) && !(window.matchMedia?.("(display-mode: standalone)").matches);
  const enable = async () => { setErr(null); const r = await sync.enablePush(); if (r.ok) setStatus("on"); else setErr(r.error ?? "Couldn't turn that on."); };
  const bg = onDark ? "bg-ink-3" : "bg-ink/8";
  const sub = onDark ? "text-muted" : "opacity-70";
  if (status === "on") return <div className={`${bg} rounded-[18px] px-4 py-3.5 flex items-center gap-3`}><span className="w-2 h-2 rounded-full bg-lime" /><div className="text-[13px]"><span className="font-bold">Reminders are on.</span> <span className={sub}>7pm if you haven't moved, 9pm for a last three minutes, and when a friend nudges you.</span></div></div>;
  if (status === "denied") return <div className={`${bg} rounded-[18px] px-4 py-3.5 text-[13px] ${sub}`}>Notifications are blocked for uvu in your browser settings. Turn them back on there and this will light up.</div>;
  if (!s.online) return null;
  return (
    <div className={`${bg} rounded-[18px] px-4 py-3.5`}>
      <div className="flex items-center gap-3">
        <div className="flex-1"><div className="font-bold text-[14px]">Want a 7pm nudge?</div><div className={`text-[12px] ${sub} mt-0.5 leading-[1.4]`}>{ios ? "On iPhone, add uvu to your Home Screen first (Share → Add to Home Screen), then come back here." : "One a day, only if you haven't moved. Plus friend nudges."}</div></div>
        {!ios && <button onClick={enable} className={`h-10 px-4 rounded-xl font-extrabold text-[13px] shrink-0 ${onDark ? "bg-lime text-ink" : "bg-ink text-lime"}`}>Turn on</button>}
      </div>
      {err && <div className="text-[12px] text-coral mt-2">{err}</div>}
    </div>
  );
}
