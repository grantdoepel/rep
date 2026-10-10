"use client";
// PRD 8 · Prescribed Sets. Owned by the plans feature; the store calls planSet() when a plan is active.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DailySet, Movement, Plan } from "./types";
import { MOVEMENT_BY_ID } from "./content";
import { supabase } from "./supabase";

type Recent = Record<string, { date: string; achieved: number; target: number }>;

/** The shape my_plan() / my_plans() hand back. */
export interface PlanRow { id: string; clinic: string; name: string; moves: Plan["moves"]; weeks: number; days_per_week: number; started_at: string }

export function planFromRow(r: PlanRow | null | undefined): Plan | undefined {
  if (!r || !r.id) return undefined;
  const moves = (Array.isArray(r.moves) ? r.moves : []).map((m) => ({ id: String(m.id), name: String(m.name ?? m.id), target: Number(m.target) || 1, unit: m.unit === "seconds" ? "seconds" as const : "reps" as const, cue: m.cue ? String(m.cue) : undefined }));
  return { id: r.id, clinic: r.clinic, moves, weeks: Number(r.weeks) || 1, daysPerWeek: Number(r.days_per_week) || 1, startedAt: r.started_at };
}

/**
 * Custom (clinic-written) moves are not in the catalog. The Set and Done screens look names and cues up in
 * MOVEMENT_BY_ID, so a plan's moves are registered there at runtime: catalog ids keep their real record.
 */
export function registerPlanMoves(plan: Plan | undefined) {
  if (!plan) return;
  for (const m of plan.moves) {
    const existing = MOVEMENT_BY_ID[m.id];
    if (existing && !m.id.startsWith("custom:")) continue;
    const rec: Movement = { id: m.id, name: m.name, track: "core", difficulty: 1, env: ["home", "gym", "travel"], unit: m.unit, cue: m.cue ?? "", flags: [] };
    MOVEMENT_BY_ID[m.id] = rec;
  }
}

// The Set page can be reloaded directly with an active prescribed Set; register from the persisted state too.
if (typeof window !== "undefined") {
  try { const raw = localStorage.getItem("rep.v1"); if (raw) registerPlanMoves((JSON.parse(raw) as { plan?: Plan }).plan); } catch {}
}

export async function pullPlan(sb: SupabaseClient): Promise<Plan | undefined> {
  const { data, error } = await sb.rpc("my_plan");
  if (error) return undefined;
  const plan = planFromRow(data as PlanRow | null);
  registerPlanMoves(plan);
  return plan;
}

/** Today's Set built from the plan, or null to fall back to the normal generator. */
export function planSet(plan: Plan, recent: Recent, today: string): DailySet | null {
  if (!plan || !plan.moves?.length) return null;
  registerPlanMoves(plan);
  return {
    id: `plan_${today}`,
    date: today,
    // Prescribed Sets don't advance crowns: no tracks means applyCrownProgress has nothing to score.
    tracks: [],
    moves: plan.moves.map((m) => {
      const r = recent[m.id];
      const target = r && r.date < today && r.achieved > 0 ? Math.max(m.target, r.achieved) : m.target;
      return { movement: m.id, name: m.name, target, unit: m.unit };
    }),
    plannedMinutes: 3,
    kind: "normal",
    status: "planned",
    planId: plan.id,
  };
}

/** 1-based week of the plan for a local date; clamps to [1, weeks]. */
export function planWeek(plan: Plan, today: string): number {
  const start = new Date(plan.startedAt);
  const startDay = Number.isNaN(start.getTime()) ? today : `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
  const days = Math.round((Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10)) - Date.UTC(+startDay.slice(0, 4), +startDay.slice(5, 7) - 1, +startDay.slice(8, 10))) / 86_400_000);
  return Math.min(plan.weeks, Math.max(1, Math.floor(days / 7) + 1));
}

// ---------- RPC wrappers ----------
/** A plan link opened before sign-in waits here; Home sends the patient back to /plan once there is a session. */
export const PENDING_PLAN_KEY = "uvu.pendingPlan";
export function pendingPlanCode(): string | null { try { return localStorage.getItem(PENDING_PLAN_KEY); } catch { return null; } }
export function setPendingPlanCode(code: string | null) { try { if (code) localStorage.setItem(PENDING_PLAN_KEY, code); else localStorage.removeItem(PENDING_PLAN_KEY); } catch {} }

export async function previewPlan(code: string): Promise<{ clinic: string; name: string; weeks: number; days: number; moves: number } | null> {
  const sb = supabase(); if (!sb) return null;
  const { data, error } = await sb.rpc("plan_preview", { p_code: code });
  if (error || !data) return null;
  const d = data as Record<string, unknown>;
  return { clinic: String(d.clinic), name: String(d.name), weeks: Number(d.weeks), days: Number(d.days), moves: Number(d.moves ?? 0) };
}

export async function joinPlan(code: string): Promise<{ ok: boolean; clinic?: string; name?: string; error?: string }> {
  const sb = supabase(); if (!sb) return { ok: false, error: "offline" };
  const { data, error } = await sb.rpc("join_plan", { p_code: code.trim().toLowerCase() });
  if (error) return { ok: false, error: error.message };
  const d = (data ?? {}) as { clinic?: string; name?: string };
  return { ok: true, clinic: d.clinic, name: d.name };
}

export async function endPlan(): Promise<boolean> {
  const sb = supabase(); if (!sb) return false;
  const { data, error } = await sb.rpc("end_plan");
  return !error && data === true;
}

// ---------- prescriber side (/pro) ----------
export interface Prescriber { id: string; orgName: string }
export interface PatientRow { label: string; week: number; done: number; due: number; last_done: string | null; ended: boolean }
export interface ProPlan { id: string; name: string; code: string; moves: Plan["moves"]; weeks: number; daysPerWeek: number; createdAt: string; members: number; adherence: number | null; lastDone: string | null; patients: PatientRow[] }
export interface AdherenceRow { user_label: string; week: number; day: string; kind: string; moves: { id: string; name: string; achieved: number; target: number }[]; start_day: string }

export async function myPrescriber(): Promise<Prescriber | null> {
  const sb = supabase(); if (!sb) return null;
  const { data, error } = await sb.rpc("my_prescriber");
  if (error || !data) return null;
  const d = data as { id: string; org_name: string };
  return { id: d.id, orgName: d.org_name };
}

export async function becomePrescriber(org: string): Promise<{ ok: boolean; error?: string }> {
  const sb = supabase(); if (!sb) return { ok: false, error: "offline" };
  const { error } = await sb.rpc("become_prescriber", { p_org: org });
  return { ok: !error, error: error?.message };
}

export async function createPlan(input: { name: string; moves: { id?: string; name: string; target: number; unit: "reps" | "seconds"; cue?: string }[]; weeks: number; days: number }): Promise<{ ok: boolean; code?: string; error?: string }> {
  const sb = supabase(); if (!sb) return { ok: false, error: "offline" };
  const { data, error } = await sb.rpc("create_plan", { p_name: input.name, p_moves: input.moves, p_weeks: input.weeks, p_days: input.days });
  if (error) return { ok: false, error: error.message };
  return { ok: true, code: String(data) };
}

export async function myPlans(): Promise<ProPlan[]> {
  const sb = supabase(); if (!sb) return [];
  const { data, error } = await sb.rpc("my_plans");
  if (error || !data) return [];
  type R = { id: string; name: string; code: string; moves: Plan["moves"]; weeks: number; days_per_week: number; created_at: string; members: number; adherence: number | null; last_done: string | null; patients: PatientRow[] };
  return (data as R[]).map((r) => ({ id: r.id, name: r.name, code: r.code, moves: r.moves ?? [], weeks: r.weeks, daysPerWeek: r.days_per_week, createdAt: r.created_at, members: r.members ?? 0, adherence: r.adherence === null || r.adherence === undefined ? null : Number(r.adherence), lastDone: r.last_done, patients: r.patients ?? [] }));
}

export async function planAdherence(planId: string): Promise<AdherenceRow[]> {
  const sb = supabase(); if (!sb) return [];
  const { data, error } = await sb.rpc("plan_adherence", { p_plan_id: planId });
  if (error || !data) return [];
  return data as AdherenceRow[];
}
