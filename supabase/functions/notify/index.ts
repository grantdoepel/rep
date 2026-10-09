// Edge function: Web Push delivery for uvu.
//   kind "nudge":   { to: uuid, from: string }  — called by the nudges trigger via pg_net
//   kind "evening": {}                           — called hourly by pg_cron; picks users at local 19:00 / 21:00 who haven't moved
// Auth: x-job-secret must match the Vault 'job_secret'. Secrets come from Vault via private_push_config() (service role only).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const LINES = {
  seven: (streak: number) => `${streak} days. It's 7pm. Today's Set is 10 minutes. You vs. you.`,
  nine: (streak: number) => `${streak} days. Three minutes. I swapped today's Set for something you can do in socks.`,
  dayOne: () => "Day one is the only day that's ever hard. Five minutes.",
  nudge: (from: string) => `${from}: beat yesterday. I'm watching.`,
};

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
    const { data: users } = await sb.from("profiles").select("id, timezone, streaks(current, last_counted_date), push_subscriptions(endpoint, keys)");
    for (const u of users ?? []) {
      const subs = (u.push_subscriptions ?? []) as Sub[];
      if (!subs.length) continue;
      let h = -1, today = "";
      try {
        const parts = new Intl.DateTimeFormat("en-CA", { timeZone: u.timezone, hour: "2-digit", hour12: false, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
        const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
        h = Number(get("hour")) % 24; today = `${get("year")}-${get("month")}-${get("day")}`;
      } catch { continue; }
      const st = Array.isArray(u.streaks) ? u.streaks[0] : u.streaks;
      if (!st || st.last_counted_date === today) continue;
      const line = h === 19 ? (st.current > 0 ? LINES.seven(st.current) : LINES.dayOne()) : h === 21 && st.current > 0 ? LINES.nine(st.current) : null;
      if (!line) continue;
      await push(u.id, subs, { title: "uvu", body: line, url: "/" });
    }
  }

  return new Response(JSON.stringify({ sent }), { headers: { "Content-Type": "application/json" } });
});
