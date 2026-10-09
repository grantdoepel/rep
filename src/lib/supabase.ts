"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Crowns, DailySet, Profile, Streak } from "./types";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseEnabled = Boolean(URL && KEY);

let client: SupabaseClient | null = null;
export function supabase(): SupabaseClient | null {
  if (!supabaseEnabled) return null;
  if (!client) client = createBrowserClient(URL!, KEY!);
  return client;
}

async function userId(): Promise<string | null> {
  const sb = supabase(); if (!sb) return null;
  const { data } = await sb.auth.getUser();
  return data.user?.id ?? null;
}

// Fire-and-forget sync. The app is local-first; these keep the server in step when configured.
export const sync = {
  async profile(p: Profile) {
    const sb = supabase(); const uid = await userId(); if (!sb || !uid) return;
    await sb.from("profiles").upsert({ id: uid, username: p.username, display_name: p.displayName, goal_tier: p.goalTier, environment: p.environment, difficulty_tier: p.tier, timezone: p.timezone, rest_days: p.restDays, injury_flags: p.injuryFlags, accessibility_flags: p.accessibility, why_text: p.whyText ?? null, why_who: p.whyWho ?? null });
  },
  async setResult(_localId: string, set: DailySet, crowns: Crowns, streak: Streak) {
    const sb = supabase(); const uid = await userId(); if (!sb || !uid) return;
    // Server-side scoring: the edge function recomputes XP from set_results so the client can't spoof it.
    await sb.functions.invoke("complete_set", { body: { set, crowns, streak } });
  },
  async signInWithOAuth(provider: "apple" | "google") {
    const sb = supabase(); if (!sb) return;
    await sb.auth.signInWithOAuth({ provider, options: { redirectTo: typeof window !== "undefined" ? window.location.origin + "/auth/callback" : undefined } });
  },
  async signInWithEmail(email: string) {
    const sb = supabase(); if (!sb) return { ok: false };
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: typeof window !== "undefined" ? window.location.origin + "/auth/callback" : undefined } });
    return { ok: !error, error: error?.message };
  },
};
