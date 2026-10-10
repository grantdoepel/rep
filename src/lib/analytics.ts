"use client";
// Event analytics. Fire-and-forget to the events table when signed in; a local ring buffer otherwise.
// Names used across the app: set_started, set_done, rescue_shown, rescue_done, push_opened, invite_sent,
// crew_joined, anchor_fired, note_recorded, note_played, test_done, plan_joined, day_moved.
import { sync } from "./supabase";

const LOCAL = "uvu.events";
export function track(name: string, props: Record<string, unknown> = {}) {
  try {
    const raw = localStorage.getItem(LOCAL); const buf = raw ? (JSON.parse(raw) as unknown[]) : [];
    buf.push({ name, props, at: new Date().toISOString() }); if (buf.length > 200) buf.splice(0, buf.length - 200);
    localStorage.setItem(LOCAL, JSON.stringify(buf));
  } catch {}
  sync.track(name, props).catch(() => {});
}
