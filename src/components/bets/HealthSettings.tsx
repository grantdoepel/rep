"use client";
// PRD 4 · Settings slot. A toggle that reads workouts from Health (native build only); in the PWA it is
// disabled and says so plainly. Under it, the last three days credited from elsewhere.
import { useState } from "react";
import { useStore } from "@/lib/store";
import { getAdapter } from "@/lib/health";
import { useMounted } from "@/components/ui";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function pretty(date: string) { const [, m, d] = date.split("-").map(Number); return `${MONTHS[(m ?? 1) - 1]} ${d}`; }

export function HealthSettings(_props?: Record<string, unknown>) {
  const s = useStore();
  const mounted = useMounted();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const available = mounted && getAdapter().available();
  const on = !!s.profile.healthConnected && available;
  const credited = s.log.filter((l) => l.kind === "moved").sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 3);

  const toggle = async () => {
    if (!available || busy) return;
    if (on) { s.patchProfile({ healthConnected: false }); setNote(null); return; }
    setBusy(true);
    const ok = await getAdapter().requestPermission().catch(() => false);
    s.patchProfile({ healthConnected: ok });
    setNote(ok ? null : "Health permission was declined. You can allow it in the system Settings.");
    setBusy(false);
  };

  return (
    <div className="px-6 pt-4">
      <div className="t-micro text-muted">Count workouts from Health</div>
      <div className="flex items-center justify-between gap-3 mt-2.5 min-h-11">
        <div className="min-w-0">
          <div className="t-body font-semibold text-text">Workouts of 20 minutes or more</div>
          <div className="t-small text-muted">Keep the streak. XP still comes from a Set.</div>
        </div>
        <button role="switch" aria-checked={on} aria-label="Count workouts from Health" disabled={!available || busy} onClick={toggle}
          className={`press shrink-0 w-[52px] h-[32px] rounded-full relative transition-colors ${on ? "bg-lime" : "bg-ink-4"} ${!available ? "opacity-50" : ""}`}>
          <span className="absolute top-1 left-1 w-6 h-6 rounded-full" style={{ background: on ? "#0C0D11" : "#A0A6B4", transform: on ? "translateX(20px)" : "none", transition: "transform .18s ease-out" }} />
        </button>
      </div>
      {!available && <div className="t-small text-muted mt-2 leading-[1.4]">Available in the App Store app. Until then, Home asks you after 4pm.</div>}
      {available && note && <div className="t-small text-muted mt-2 leading-[1.4]">{note}</div>}
      {on && (
        <div className="mt-3 rounded-[18px] bg-ink-3 px-4 py-1">
          {credited.length === 0 && <div className="t-small text-muted py-2.5">No days credited yet. A 20-minute workout counts the day.</div>}
          {credited.map((l) => (
            <div key={l.date} className="flex items-center justify-between py-2.5 [&+&]:border-t [&+&]:border-ink-4">
              <span className="t-small font-semibold text-text">{pretty(l.date)}</span>
              <span className="t-small text-muted">{l.source ?? "Health"}</span>
            </div>
          ))}
          <button onClick={toggle} className="press h-11 -mx-1 px-1 t-small font-bold text-muted text-left w-full">Disconnect</button>
        </div>
      )}
    </div>
  );
}
