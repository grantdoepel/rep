// Edge function: the client sends its finished Set; we store it and let Postgres score it (complete_set RPC).
// XP is never trusted from the client.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  const auth = req.headers.get("Authorization") ?? "";
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });
  const { set } = await req.json();
  const moves = (set.moves ?? []).map((m: { movement: string; target: number; unit: string; achieved?: number }) => ({ movement: m.movement, target: Number(m.target), unit: m.unit, achieved: Math.max(0, Math.min(999, Number(m.achieved ?? 0))) }));
  const { data: row, error } = await sb.from("sets").insert({ user_id: user.id, date: set.date, kind: set.kind ?? "normal", status: "active", tracks: set.tracks, moves, planned_minutes: set.plannedMinutes ?? 10, started_at: new Date().toISOString() }).select("id").single();
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  const { data, error: e2 } = await sb.rpc("complete_set", { p_set_id: row.id });
  if (e2) return new Response(JSON.stringify({ error: e2.message }), { status: 400 });
  return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
});
