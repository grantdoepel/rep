"use client";
// PRD 5 · Letters from past-you. One recording per user: a 10-second voice note (or a ≤140-char line),
// kept locally as a data URL and, when signed in, in the private Storage bucket `notes` at `${userId}/current.<ext>`.
import { supabase } from "./supabase";
import { addDays, dayOfWeek, weekStart } from "./rules";
import type { DayLog, Profile } from "./types";

export const NOTE_LOCAL = "uvu.note";            // data URL of the recording (when ≤ LOCAL_CAP)
export const NOTE_OFFERED_WEEK = "uvu.noteOfferedWeek";
export const NOTE_MAX_SECONDS = 10;
export const NOTE_TEXT_MAX = 140;
const LOCAL_CAP = 200 * 1024;                     // ~200KB; above that we rely on the server copy
const BUCKET = "notes";

// patch_profile treats null as "keep", so a deleted note is stored as "". Treat "" as absent everywhere.
export function hasNote(p: Pick<Profile, "noteRecordedAt" | "noteText">): boolean {
  return Boolean(p.noteRecordedAt) || Boolean(p.noteText);
}

// ---------- recording support ----------
export type NoteMime = { mime: string; ext: string };
export function pickMime(): NoteMime | null {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) return null;
  const candidates: NoteMime[] = [
    { mime: "audio/webm;codecs=opus", ext: "webm" },
    { mime: "audio/webm", ext: "webm" },
    { mime: "audio/mp4;codecs=mp4a.40.2", ext: "mp4" },
    { mime: "audio/mp4", ext: "mp4" },
  ];
  for (const c of candidates) { try { if (MediaRecorder.isTypeSupported(c.mime)) return c; } catch {} }
  return null;
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
}

// ---------- local copy ----------
export function readLocalNote(): string | null { try { return localStorage.getItem(NOTE_LOCAL); } catch { return null; } }
export function clearLocalNote() { try { localStorage.removeItem(NOTE_LOCAL); } catch {} }
export function storeLocalNote(dataUrl: string): boolean {
  if (dataUrl.length > LOCAL_CAP) return false;
  try { localStorage.setItem(NOTE_LOCAL, dataUrl); return true; } catch { return false; }
}

// ---------- server copy ----------
const storagePath = (userId: string, ext: string) => `${userId}/current.${ext}`;
const EXTS = ["webm", "mp4"];

export async function uploadNote(userId: string, blob: Blob, ext: string): Promise<boolean> {
  const sb = supabase(); if (!sb) return false;
  // one recording per user: drop any older format first so a Safari re-record doesn't leave a webm behind
  await sb.storage.from(BUCKET).remove(EXTS.filter((e) => e !== ext).map((e) => storagePath(userId, e))).catch(() => {});
  const { error } = await sb.storage.from(BUCKET).upload(storagePath(userId, ext), blob, { upsert: true, contentType: blob.type || undefined });
  return !error;
}

// Removes the recording and nulls both note columns (clear_note RPC, 0009): patch_profile can't clear a timestamptz.
export async function deleteNoteOnServer(userId: string): Promise<void> {
  const sb = supabase(); if (!sb) return;
  await sb.storage.from(BUCKET).remove(EXTS.map((e) => storagePath(userId, e))).catch(() => {});
  await sb.rpc("clear_note").then(() => {}, () => {});
}

// A 10-minute signed URL for whichever format is on the server.
export async function signedNoteUrl(userId: string): Promise<string | null> {
  const sb = supabase(); if (!sb) return null;
  const { data } = await sb.storage.from(BUCKET).list(userId, { limit: 5 });
  const file = (data ?? []).find((f) => f.name.startsWith("current."));
  if (!file) return null;
  const { data: signed } = await sb.storage.from(BUCKET).createSignedUrl(`${userId}/${file.name}`, 600);
  return signed?.signedUrl ?? null;
}

// ---------- week math ----------
const KEPT: DayLog["kind"][] = ["perfect", "done", "rest", "moved"];
export function keptThisWeek(log: DayLog[], today: string): number {
  const ws = weekStart(today), we = addDays(ws, 6);
  return log.filter((d) => d.date >= ws && d.date <= we && KEPT.includes(d.kind)).length;
}
// Days still ahead this week, today included.
export function daysLeftInWeek(today: string): number { return 7 - ((dayOfWeek(today) + 6) % 7); }
// The promise is at risk when the days left can no longer cover what's missing.
export function promiseAtRisk(log: DayLog[], today: string, promiseDays: number): boolean {
  return daysLeftInWeek(today) < promiseDays - keptThisWeek(log, today);
}
export function rescueHourStarted(now: Date, rescueAt = "21:00"): boolean {
  const [h, m] = rescueAt.split(":").map(Number);
  const start = new Date(now); start.setHours(h || 0, (m || 0) + 60, 0, 0);
  return now >= start;
}

export function daysAgo(iso: string, now: Date): string {
  const d = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 86400000));
  return d === 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
}
