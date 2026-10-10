"use client";
// PRD 6 · the "when I get home" anchor. Mounted once in the root layout; renders nothing.
//
// Honest limitation: a PWA has no background geofencing. This fires when the app is OPENED at home
// (hour >= 16, home pinned, today not done, once per local day), never while the app is closed.
// The evening push remains the thing that gets the app opened; this makes the open land in the Set.
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useStore } from "@/lib/store";
import { track } from "@/lib/analytics";
import { anchorFiredToday, markAnchorFired, nearHome } from "@/lib/anchors";
import { localDate } from "@/lib/rules";

export function AnchorWatcher() {
  const s = useStore();
  const router = useRouter();
  const pathname = usePathname();
  const busy = useRef(false);

  useEffect(() => {
    if (!s.hydrated || !s.onboarded) return;
    if (pathname !== "/") return;                                   // only from Home, never mid-Set
    const p = s.profile;
    if (p.anchor !== "home" || p.homeLat == null || p.homeLng == null) return;
    if (s.active) return;
    const now = new Date();
    const today = localDate(now, p.timezone);
    // wait for the store's rollover: on the first open of a day `today` is stale and `active` gets cleared
    if (!s.today || s.today.date !== today) return;
    if (s.today.status === "done") return;
    const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: p.timezone }).formatToParts(now).find((x) => x.type === "hour")?.value ?? now.getHours());
    if (hour < 16) return;
    if (anchorFiredToday("home", p.timezone)) return;
    if (busy.current || typeof navigator === "undefined" || !navigator.geolocation) return;
    busy.current = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        busy.current = false;
        if (!nearHome(pos.coords.latitude, pos.coords.longitude, p)) return;
        markAnchorFired("home", p.timezone);
        track("anchor_fired", { kind: "home" });
        s.startSet("normal", "anchor");
        s.patch(() => ({ toast: "You're home. Your Set is here." }));
        router.push("/set");
      },
      () => { busy.current = false; },
      { maximumAge: 5 * 60 * 1000, timeout: 8000 },
    );
  }, [s.hydrated, s.onboarded, s.profile, s.today, s.active, pathname, router, s]);

  return null;
}
