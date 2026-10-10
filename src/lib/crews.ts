"use client";
// PRD 3 · Crews. Owned by the crews feature; the store only holds `s.crew`.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Crew } from "./types";

export async function pullCrew(_sb: SupabaseClient): Promise<Crew | undefined> {
  return undefined; // filled in by the crews feature (crew_state RPC)
}
