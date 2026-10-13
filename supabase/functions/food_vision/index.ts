// Edge function: a meal photo in, an itemised calorie and macro estimate out.
// Signed-in users only (verify_jwt), 40 scans per user per day, photos are never stored.
// Secrets: ANTHROPIC_API_KEY (required), FOOD_VISION_MODEL (optional, defaults below).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const DAILY_LIMIT = 40;
const MAX_B64 = 6_000_000;

const TOOL = {
  name: "record_meal",
  description: "Record the foods visible in the photo with estimated portions, calories and macronutrients.",
  input_schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        description: "One entry per distinct food or drink. Empty if the photo shows no food.",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Short plain name, e.g. 'Grilled chicken breast'" },
            portion: { type: "string", description: "Estimated portion in everyday units, e.g. '6 oz', '1 cup', '2 slices'" },
            kcal: { type: "number" }, protein: { type: "number", description: "grams" }, carbs: { type: "number", description: "grams" }, fat: { type: "number", description: "grams" },
          },
          required: ["name", "portion", "kcal", "protein", "carbs", "fat"],
        },
      },
      confidence: { type: "string", enum: ["low", "medium", "high"], description: "How confident the estimate is overall. Low when portions, sauces or oils are hard to see." },
      note: { type: "string", description: "One short sentence the person should know, e.g. that oil or dressing could add calories. Optional." },
    },
    required: ["items", "confidence"],
  },
};

const SYSTEM = `You estimate the nutrition of meals from photos for a fitness app. Identify each distinct food and drink, estimate the portion from visual cues (plate size, utensils, hands, packaging), and give calories and grams of protein, carbs and fat for that portion using standard nutrition references. Count visible sauces, dressings, oils and drinks. When something is ambiguous, pick the most likely option and lower the confidence. Never moralise about food choices. If the image is not food, return an empty items list with low confidence.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  const auth = req.headers.get("Authorization") ?? "";
  const url = Deno.env.get("SUPABASE_URL")!;
  const sb = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return json({ error: "Sign in to use photo counting." }, 401);

  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return json({ error: "Photo counting isn't switched on yet. Add the meal by hand for now." }, 503);

  let body: { image?: string; mediaType?: string; note?: string };
  try { body = await req.json(); } catch { return json({ error: "That request couldn't be read." }, 400); }
  const image = String(body.image ?? "");
  const mediaType = ["image/jpeg", "image/png", "image/webp"].includes(String(body.mediaType)) ? String(body.mediaType) : "image/jpeg";
  if (!image || image.length > MAX_B64 || !/^[A-Za-z0-9+/=]+$/.test(image.slice(0, 200))) return json({ error: "That photo is too large or unreadable. Try again." }, 400);
  const note = String(body.note ?? "").slice(0, 300);

  // rate limit with the service role: count today's scans for this user
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const since = new Date(); since.setUTCHours(0, 0, 0, 0);
  const { count } = await admin.from("food_scans").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", since.toISOString());
  if ((count ?? 0) >= DAILY_LIMIT) return json({ error: `That's ${DAILY_LIMIT} photos today. Add the rest by hand; the counter resets tomorrow.` }, 429);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: Deno.env.get("FOOD_VISION_MODEL") ?? "claude-sonnet-5-5",
      max_tokens: 1200,
      system: SYSTEM,
      tools: [TOOL],
      tool_choice: { type: "tool", name: "record_meal" },
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
        { type: "text", text: note ? `The person adds: ${note}` : "Estimate this meal." },
      ] }],
    }),
  });
  if (!res.ok) {
    console.error("anthropic", res.status, await res.text().catch(() => ""));
    return json({ error: "The photo couldn't be counted right now. Try again or add it by hand." }, 502);
  }
  const out = await res.json();
  const use = (out.content ?? []).find((c: { type: string }) => c.type === "tool_use");
  const raw = (use?.input ?? {}) as { items?: Record<string, unknown>[]; confidence?: string; note?: string };
  const n = (v: unknown, max: number) => { const x = Math.round(Number(v) || 0); return Math.max(0, Math.min(max, x)); };
  const items = (raw.items ?? []).slice(0, 20).map((i) => ({
    name: String(i.name ?? "Food").slice(0, 60), portion: String(i.portion ?? "").slice(0, 40),
    kcal: n(i.kcal, 3000), protein: n(i.protein, 300), carbs: n(i.carbs, 500), fat: n(i.fat, 300),
  }));
  const confidence = ["low", "medium", "high"].includes(String(raw.confidence)) ? raw.confidence : "low";
  const result = { items, confidence, note: raw.note ? String(raw.note).slice(0, 200) : undefined };

  await admin.from("food_scans").insert({ user_id: user.id, kcal: items.reduce((a, i) => a + i.kcal, 0), item_count: items.length, confidence });
  return json(result);
});
