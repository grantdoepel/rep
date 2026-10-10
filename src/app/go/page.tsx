"use client";
// PRD 6 · /go?t=<code> — the tag landing. A QR or NFC sticker opens this; if the code is yours,
// today's Set starts right away. Nothing is stored here; the code is checked against the profile.
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { useStore } from "@/lib/store";
import { track } from "@/lib/analytics";
import { markAnchorFired, tagMatches } from "@/lib/anchors";
import { localDate } from "@/lib/rules";
import { useMounted } from "@/components/ui";
import { Vee } from "@/components/Vee";

type View = "blank" | "starting" | "done" | "wrong";

function GoInner() {
  const s = useStore();
  const router = useRouter();
  const q = useSearchParams();
  const mounted = useMounted();
  const t = q.get("t");
  const tracked = useRef(false);

  // derived, not stored: the store already holds everything the verdict needs
  // "blank" also covers the first open of a new day: the store's rollover effect replaces `today`
  // (and clears `active`) right after hydration, so we start only once today's Set is current.
  let view: View = "blank";
  const today = mounted ? localDate(new Date(), s.profile.timezone) : "";
  const current = !!s.today && s.today.date === today;
  if (mounted && s.hydrated && s.onboarded) {
    if (!tagMatches(t, s.profile)) view = "wrong";
    else if (current) view = s.today!.status === "done" ? "done" : "starting";
  }

  useEffect(() => {
    if (!s.hydrated) return;
    if (!s.onboarded) { router.replace("/start"); return; }
    if (view === "wrong" && !tracked.current) { tracked.current = true; track("anchor_fired", { kind: "tag", ok: false }); }
    if (view !== "starting") return;
    // already mid-Set: just take them back to it
    if (!s.active && !tracked.current) { tracked.current = true; s.startSet("normal", "anchor"); markAnchorFired("tag", s.profile.timezone); track("anchor_fired", { kind: "tag", ok: true }); }
    const timer = setTimeout(() => router.replace("/set"), 600);
    return () => clearTimeout(timer);
  }, [view, s.hydrated, s.onboarded, s.active, s.profile.timezone, router, s]);

  if (view === "blank") return <div className="screen" />;

  if (view === "starting") {
    return (
      <div className="screen items-center justify-center px-6">
        <Vee size={88} mood="happy" bob />
        <div role="status" className="mt-6 bg-lime text-ink rounded-2xl px-5 py-3.5 text-[16px] font-extrabold a-rise">Your Set is here.</div>
      </div>
    );
  }

  if (view === "done") {
    return (
      <div className="screen px-6 safe-top pt-14 pb-8 safe-bottom">
        <Vee size={72} mood="proud" />
        <div className="display t-h1 mt-6">Done for today.</div>
        <div className="t-body text-muted mt-2">The tag knows. Tomorrow it starts the next one.</div>
        <Link href="/" className="press mt-8 flex items-center justify-center h-[56px] rounded-2xl bg-lime text-ink font-extrabold text-[17px]">Home</Link>
      </div>
    );
  }

  return (
    <div className="screen px-6 safe-top pt-14 pb-8 safe-bottom">
      <Vee size={72} mood="worried" />
      <div className="display t-h1 mt-6">That tag isn&rsquo;t yours.</div>
      <div className="t-body text-muted mt-2">A tag starts the Set of the person who printed it. Make your own in Settings.</div>
      <Link href="/rest-days" className="press mt-8 flex items-center justify-center h-[56px] rounded-2xl bg-lime text-ink font-extrabold text-[17px]">Settings</Link>
      <Link href="/" className="press mt-2 h-11 flex items-center justify-center font-semibold text-[14px] text-muted">Home</Link>
    </div>
  );
}

export default function Go() { return <Suspense fallback={<div className="screen" />}><GoInner /></Suspense>; }
