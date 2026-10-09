// Edge function: evening streak-at-risk pushes and nudge delivery via Web Push.
// Called by pg_cron through pg_net, or manually. Needs VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY secrets.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const LINES = {
  seven: (streak: number) => `${streak} days. It's 7pm. Today's Set is 10 minutes. I'll wait.`,
  nine: (streak: number) => `${streak} days. Three minutes. I swapped today's Set for something you can do in socks.`,
  nudge: (from: string) => `${from} says: keep your Rep.`,
};

Deno.serve(async (req: Request) => {
  if (req.headers.get("x-job-secret") !== Deno.env.get("JOB_SECRET")) return new Response("forbidden", { status: 403 });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  webpush.setVapidDetails("mailto:hello@rep.app", Deno.env.get("VAPID_PUBLIC_KEY")!, Deno.env.get("VAPID_PRIVATE_KEY")!);
  const { kind } = await req.json().catch(() => ({ kind: "evening" }));
  let sent = 0;
  if (kind === "evening") {
    const { data: users } = await sb.from("profiles").select("id, timezone, streaks(current, last_counted_date), push_subscriptions(endpoint, keys)");
    for (const u of users ?? []) {
      const local = new Date(new Date().toLocaleString("en-US", { timeZone: u.timezone }));
      const h = local.getHours(); const today = local.toISOString().slice(0, 10);
      const st = Array.isArray(u.streaks) ? u.streaks[0] : u.streaks;
      if (!st || st.last_counted_date === today || st.current === 0) continue;
      const line = h === 19 ? LINES.seven(st.current) : h === 21 ? LINES.nine(st.current) : null;
      if (!line) continue;
      for (const sub of u.push_subscriptions ?? []) { try { await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, JSON.stringify({ title: "Rep", body: line, url: "/" })); sent++; } catch { await sb.from("push_subscriptions").delete().eq("endpoint", sub.endpoint); } }
    }
  }
  return new Response(JSON.stringify({ sent }), { headers: { "Content-Type": "application/json" } });
});
