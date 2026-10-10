"use client";
// PRD 8 · Prescribed Sets. Owned by the plans feature; the store calls planSet() when a plan is active.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DailySet, Plan } from "./types";

export async function pullPlan(_sb: SupabaseClient): Promise<Plan | undefined> {
  return undefined; // filled in by the plans feature (my_plan RPC)
}

/** Today's Set built from the plan, or null to fall back to the normal generator. */
export function planSet(_plan: Plan, _recent: Record<string, { date: string; achieved: number; target: number }>, _today: string): DailySet | null {
  return null;
}
