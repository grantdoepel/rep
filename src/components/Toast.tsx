"use client";
import { useEffect } from "react";
import { useStore } from "@/lib/store";

// Global toast + invite-link intake. Lives in the layout so it works on any route.
export function Toast() {
  const s = useStore();
  useEffect(() => {
    if (!s.hydrated) return;
    const u = new URL(window.location.href);
    const code = u.searchParams.get("invite");
    if (code) { u.searchParams.delete("invite"); window.history.replaceState({}, "", u.pathname + (u.search || "")); s.acceptInvite(code); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.hydrated]);
  useEffect(() => { if (!s.toast) return; const t = setTimeout(s.dismissToast, 4500); return () => clearTimeout(t); }, [s.toast, s.dismissToast]);
  if (!s.toast) return null;
  return (
    <div role="status" className="fixed left-1/2 -translate-x-1/2 bottom-[92px] z-50 max-w-[360px] w-[calc(100%-48px)] bg-lime text-ink rounded-2xl px-4 py-3 text-[14px] font-bold shadow-lg a-rise">{s.toast}</div>
  );
}
