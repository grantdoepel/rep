"use client";
// PRD 3 · Crews. Owned by the crews feature; the store only holds `s.crew` (pulled through pullCrew).
// One crew per person, up to six people, one shared weekly XP target: members × 300. Monday reset.
import { useEffect, useRef } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Crew } from "./types";
import { supabase } from "./supabase";
import { useStore } from "./store";
import { track } from "./analytics";

const COLORS = ["#3D4EFF", "#FF6B4A", "#8FB0FF", "#FFB347", "#B48CFF", "#2A2D38"];
const colorFor = (id: string) => COLORS[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];

type MemberRow = { id: string; display_name: string; done_today: boolean; done_at: string | null; streak: number; is_you: boolean; is_captain?: boolean };
type StateRow = { id: string; name: string; code: string; created_at?: string; week_start: string; xp: number; target_xp: number; kept: boolean; members: MemberRow[] };

function toCrew(r: StateRow): Crew {
  const members = (r.members ?? []).map((m) => ({ id: m.id, displayName: m.display_name, doneToday: !!m.done_today, doneAt: m.done_at ?? undefined, streak: Number(m.streak ?? 0), color: m.is_you ? "#C8FF3D" : colorFor(m.id), isYou: !!m.is_you, isCaptain: !!m.is_captain }));
  // you first; the rest keep join order
  members.sort((a, b) => Number(b.isYou) - Number(a.isYou));
  return { id: r.id, name: r.name, code: r.code, createdAt: r.created_at ?? undefined, weekStart: r.week_start, xp: Number(r.xp ?? 0), targetXp: Number(r.target_xp ?? 0), kept: !!r.kept, members };
}

/** The caller's crew from crew_state, or undefined when not in one. Called from sync.pull(). */
export async function pullCrew(sb: SupabaseClient): Promise<Crew | undefined> {
  const { data, error } = await sb.rpc("crew_state");
  if (error || !data) return undefined;
  return toCrew(data as StateRow);
}

type Result<T> = { ok: true; value: T } | { ok: false; error: string };
const fail = (e: { message?: string } | null | undefined, fallback: string): Result<never> => ({ ok: false, error: e?.message ?? fallback });

export async function createCrew(name: string): Promise<Result<string>> {
  const sb = supabase(); if (!sb) return { ok: false, error: "Crews need an account." };
  const { data, error } = await sb.rpc("create_crew", { p_name: name.trim() });
  if (error || !data) return fail(error, "Couldn't start that crew.");
  track("crew_created", { name_len: name.trim().length });
  return { ok: true, value: String(data) };
}

export async function joinCrew(code: string, via: "code" | "link" = "code"): Promise<Result<string>> {
  const sb = supabase(); if (!sb) return { ok: false, error: "Crews need an account." };
  const { data, error } = await sb.rpc("join_crew", { p_code: code.trim().toLowerCase() });
  if (error || !data) return fail(error, "That code didn't work.");
  track("crew_joined", { via });
  return { ok: true, value: String(data) };
}

export async function leaveCrew(): Promise<Result<true>> {
  const sb = supabase(); if (!sb) return { ok: false, error: "Crews need an account." };
  const { error } = await sb.rpc("leave_crew");
  if (error) return fail(error, "Couldn't leave right now.");
  track("crew_left");
  return { ok: true, value: true };
}

export function crewInviteUrl(code: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/?crew=${code}`;
}

// ---------- pending join: a ?crew= link opened before sign-in waits until there is a session ----------
const PENDING = "uvu.pendingCrew";
export function setPendingCrew(code: string) { try { localStorage.setItem(PENDING, code.trim().toLowerCase()); } catch {} }
export function getPendingCrew(): string | null { try { return localStorage.getItem(PENDING); } catch { return null; } }
export function clearPendingCrew() { try { localStorage.removeItem(PENDING); } catch {} }

/** Joins the pending crew once the store is online, refreshes, and toasts. Mounted from Toast (any route). */
export function useCrewPendingJoin() {
  const s = useStore();
  const busy = useRef(false);
  useEffect(() => {
    if (!s.hydrated || !s.online || busy.current) return;
    const code = getPendingCrew();
    if (!code) return;
    busy.current = true;
    clearPendingCrew();
    joinCrew(code, "link").then(async (r) => {
      if (r.ok) await s.refresh();
      s.patch(() => ({ toast: r.ok ? `You're in ${r.value}.` : r.error }));
      busy.current = false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.hydrated, s.online]);
}

/** Intake for a ?crew=<code> link. Parks the code; useCrewPendingJoin joins once there is a session.
 *  If no session shows up within a moment, say what will happen. */
export function useCrewLinkIntake() {
  const s = useStore();
  const online = useRef(s.online);
  useEffect(() => { online.current = s.online; }, [s.online]);
  useEffect(() => {
    if (!s.hydrated) return;
    const u = new URL(window.location.href);
    const code = u.searchParams.get("crew");
    if (!code) return;
    u.searchParams.delete("crew");
    window.history.replaceState({}, "", u.pathname + (u.search || ""));
    setPendingCrew(code);
    const t = setTimeout(() => { if (!online.current && getPendingCrew()) s.patch(() => ({ toast: "Sign in and you'll join the crew automatically." })); }, 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.hydrated]);
}

/** Days left in the crew's week (Mon..Sun), 7 on Monday, 1 on Sunday. */
export function crewDaysLeft(dow: number) { return 7 - ((dow + 6) % 7); }

/** Week N since the crew was created (1-based). */
export function crewWeekNumber(crew: Crew, today: string): number {
  if (!crew.createdAt) return 1;
  const a = new Date(crew.createdAt.slice(0, 10) + "T12:00:00Z").getTime();
  const b = new Date(today + "T12:00:00Z").getTime();
  return Math.max(1, Math.floor((b - a) / (7 * 86400000)) + 1);
}

export function formatDoneAt(iso: string | undefined, tz?: string): string {
  if (!iso) return "not yet";
  try { return "done " + new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz }).format(new Date(iso)).toLowerCase().replace(" ", ""); } catch { return "done"; }
}
