// Edge function: Web Push delivery for uvu.
//   kind "nudge":   { to: uuid, from: string }  — called by the nudges trigger via pg_net
//   kind "evening": {}                           — called every 10 minutes by pg_cron (rep_evening10); picks users whose local
//                                                  clock is in [rescue_at, rescue_at + 10min) with no kept day_log row for today
// Auth: x-job-secret must match the Vault 'job_secret'. Secrets come from Vault via private_push_config() (service role only).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const LINES = {
  evening: (days: number) => `You said ${days} days. Tonight is one of them.`,
  nudge: (from: string) => `${from}: beat yesterday. I'm watching.`,
};
const KEPT = ["perfect", "done", "rest", "moved"];
const WINDOW_MIN = 10;   // must match the rep_evening10 cadence in 0007_evening.sql

type Sub = { endpoint: string; keys: { p256dh: string; auth: string } };

Deno.serve(async (req: Request) => {
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: cfg, error: cfgErr } = await sb.rpc("private_push_config");
  if (cfgErr || !cfg?.job_secret || !cfg?.vapid_public || !cfg?.vapid_private) return new Response("push not configured", { status: 500 });
  if (req.headers.get("x-job-secret") !== cfg.job_secret) return new Response("forbidden", { status: 403 });
  webpush.setVapidDetails("mailto:hello@uvu.app", cfg.vapid_public, cfg.vapid_private);

  const body = await req.json().catch(() => ({}));
  const kind = body.kind ?? "evening";
  let sent = 0;

  const push = async (userId: string, subs: Sub[], payload: { title: string; body: string; url: string }) => {
    for (const sub of subs) {
      try { await webpush.sendNotification(sub, JSON.stringify(payload)); sent++; }
      catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await sb.from("push_subscriptions").delete().eq("user_id", userId).eq("endpoint", sub.endpoint);
      }
    }
  };

  if (kind === "nudge" && body.to) {
    const { data: subs } = await sb.from("push_subscriptions").select("endpoint, keys").eq("user_id", body.to);
    await push(body.to, (subs ?? []) as Sub[], { title: "uvu", body: LINES.nudge(String(body.from ?? "A friend")), url: "/" });
  }

  if (kind === "evening") {
    const { data: users } = await sb.from("profiles").select("id, timezone, rescue_at, promise_days, push_subscriptions(endpoint, keys)");
    const nowD = new Date();
    type Cand = { id: string; today: string; days: number; subs: Sub[] };
    const cands: Cand[] = [];
    for (const u of users ?? []) {
      const subs = (u.push_subscriptions ?? []) as Sub[];
      if (!subs.length) continue;
      let mins = -1, today = "";
      try {
        const parts = new Intl.DateTimeFormat("en-CA", { timeZone: u.timezone, hour: "2-digit", minute: "2-digit", hour12: false, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(nowD);
        const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
        mins = (Number(get("hour")) % 24) * 60 + Number(get("minute")); today = `${get("year")}-${get("month")}-${get("day")}`;
      } catch { continue; }
      const m = /^(\d{1,2}):(\d{2})/.exec(String(u.rescue_at ?? "21:00"));
      const rescue = m ? Number(m[1]) * 60 + Number(m[2]) : 21 * 60;
      if (mins < rescue || mins >= rescue + WINDOW_MIN) continue;
      cands.push({ id: u.id, today, days: Number(u.promise_days ?? 4), subs });
    }
    if (cands.length) {
      // one query: who among the candidates already has a kept day for their local today
      const { data: kept } = await sb.from("day_log").select("user_id, date").in("user_id", cands.map((c) => c.id)).in("date", [...new Set(cands.map((c) => c.today))]).in("kind", KEPT);
      const done = new Set((kept ?? []).map((r: { user_id: string; date: string }) => `${r.user_id}:${r.date}`));
      for (const c of cands) {
        if (done.has(`${c.id}:${c.today}`)) continue;
        await push(c.id, c.subs, { title: "uvu", body: LINES.evening(c.days), url: "/" });
      }
    }
  }

  return new Response(JSON.stringify({ sent }), { headers: { "Content-Type": "application/json" } });
});
