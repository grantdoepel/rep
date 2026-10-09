"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Crowns, DailySet, DuoQuest, Friend, LeagueRow, LeagueTier, Profile, Streak } from "./types";

const COLORS = ["#3D4EFF", "#FF6B4A", "#8FB0FF", "#FFB347", "#B48CFF", "#2A2D38"];
const colorFor = (id: string) => COLORS[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];

export interface Pulled { userId: string; inviteCode: string; friends: Friend[]; league: LeagueRow[]; leagueTier?: LeagueTier; duo?: DuoQuest }

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
  async currentUser(): Promise<{ id: string; email?: string; name?: string } | null> {
    const sb = supabase(); if (!sb) return null;
    const { data } = await sb.auth.getUser();
    const u = data.user; if (!u) return null;
    const m = (u.user_metadata ?? {}) as Record<string, unknown>;
    return { id: u.id, email: u.email ?? undefined, name: (m.full_name as string) || (m.name as string) || undefined };
  },
  async profile(p: Profile) {
    const sb = supabase(); const uid = await userId(); if (!sb || !uid) return;
    await sb.from("profiles").upsert({ id: uid, username: p.username, display_name: p.displayName, goal_tier: p.goalTier, environment: p.environment, difficulty_tier: p.tier, timezone: p.timezone, rest_days: p.restDays, injury_flags: p.injuryFlags, accessibility_flags: p.accessibility, why_text: p.whyText ?? null, why_who: p.whyWho ?? null });
  },
  async setResult(_localId: string, set: DailySet, crowns: Crowns, streak: Streak) {
    const sb = supabase(); const uid = await userId(); if (!sb || !uid) return;
    // Server-side scoring: the edge function recomputes XP from set_results so the client can't spoof it.
    await sb.functions.invoke("complete_set", { body: { set, crowns, streak } });
  },
  // Everything social comes from the server once signed in. Local-first still holds: the store keeps its own copy.
  async pull(): Promise<Pulled | null> {
    const sb = supabase(); const uid = await userId(); if (!sb || !uid) return null;
    const [code, fr, lg, duo] = await Promise.all([sb.rpc("my_invite_code"), sb.rpc("get_friends"), sb.rpc("get_league"), sb.rpc("get_duo")]);
    type FR = { id: string; username: string; display_name: string; streak: number; xp_week: number; done_today: boolean; at_risk: boolean; moving_now: boolean; is_duo: boolean; is_crew: boolean };
    type LR = { user_id: string; display_name: string; goal_tier: "casual" | "regular" | "serious"; sets: number; xp: number; perfect: number; is_you: boolean; is_friend: boolean; tier: LeagueTier };
    const friends: Friend[] = ((fr.data ?? []) as FR[]).map((f) => ({ id: f.id, username: f.username, displayName: f.display_name, streak: f.streak, xpWeek: f.xp_week, doneToday: f.done_today, atRisk: f.at_risk, movingNow: f.moving_now, isDuo: f.is_duo, isCrew: f.is_crew, color: colorFor(f.id) }));
    const rows = (lg.data ?? []) as LR[];
    const league: LeagueRow[] = rows.map((r) => ({ id: r.user_id, displayName: r.is_you ? "You" : r.display_name, goalTier: r.goal_tier, sets: r.sets, xp: r.xp, perfect: r.perfect, isYou: r.is_you, isFriend: r.is_friend, isDuo: friends.some((f) => f.id === r.user_id && f.isDuo) }));
    const d = duo.data as (Record<string, unknown> | null);
    const duoQ: DuoQuest | undefined = d ? { partnerId: String(d.partnerId), partnerName: String(d.partnerName).split(" ")[0], targetXp: Number(d.targetXp), yourXp: Number(d.yourXp), partnerXp: Number(d.partnerXp), weekStart: String(d.weekStart), status: d.status as DuoQuest["status"], wagerYou: (d.wagerYou as string) ?? undefined, wagerPartner: (d.wagerPartner as string) ?? undefined } : undefined;
    return { userId: uid, inviteCode: String(code.data ?? ""), friends, league, leagueTier: rows[0]?.tier, duo: duoQ };
  },
  async acceptInvite(code: string): Promise<{ ok: boolean; name?: string; error?: string }> {
    const sb = supabase(); if (!sb) return { ok: false, error: "offline" };
    const { data, error } = await sb.rpc("accept_invite", { p_code: code });
    if (error) return { ok: false, error: error.message };
    return { ok: true, name: (data as { display_name?: string })?.display_name };
  },
  async setDuo(partnerId: string) { const sb = supabase(); if (!sb) return { ok: false }; const { error } = await sb.rpc("set_duo", { p_partner: partnerId }); return { ok: !error, error: error?.message }; },
  async setWager(text: string) { const sb = supabase(); if (!sb) return; await sb.rpc("set_wager", { p_text: text }); },
  async nudge(toId: string) { const sb = supabase(); if (!sb) return false; const { data, error } = await sb.rpc("send_nudge", { p_to: toId }); return !error && data === true; },
  async presence(setId: string, move: number) { const sb = supabase(); const uid = await userId(); if (!sb || !uid) return; await sb.rpc("set_presence", { p_set_id: setId, p_move: move }).then(() => {}, () => {}); },
  async pushStatus(): Promise<"unsupported" | "denied" | "on" | "off"> {
    if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported";
    if (Notification.permission === "denied") return "denied";
    const reg = await navigator.serviceWorker.getRegistration(); const sub = await reg?.pushManager.getSubscription();
    return sub ? "on" : "off";
  },
  async enablePush(): Promise<{ ok: boolean; error?: string }> {
    const sb = supabase(); const uid = await userId(); if (!sb || !uid) return { ok: false, error: "Sign in first so reminders can find you." };
    try {
      const { data: key } = await sb.rpc("vapid_public_key"); if (!key) return { ok: false, error: "Push isn't configured yet." };
      const perm = await Notification.requestPermission(); if (perm !== "granted") return { ok: false, error: "Notifications were declined." };
      const reg = await navigator.serviceWorker.ready;
      const raw = atob(String(key).replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(String(key).length / 4) * 4, "="));
      const appKey = Uint8Array.from(raw, (c) => c.charCodeAt(0));
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appKey });
      const j = sub.toJSON();
      const { error } = await sb.rpc("save_push_subscription", { p_endpoint: j.endpoint, p_keys: j.keys });
      return error ? { ok: false, error: error.message } : { ok: true };
    } catch (e) { return { ok: false, error: (e as Error).message }; }
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
