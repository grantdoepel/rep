"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { localDate } from "@/lib/rules";
import { track } from "@/lib/analytics";
import { analyzePhoto, shrink, uid, type FoodItem } from "@/lib/food";
import { Button, Chip, Icon, TopBar } from "@/components/ui";

const blank = (): FoodItem => ({ name: "", portion: "", kcal: 0, protein: 0, carbs: 0, fat: 0 });
const cell = "bg-ink-3 rounded-xl px-3 h-11 t-body text-text outline-none border border-transparent focus:border-lime min-w-0";

export default function MealCapture() {
  const s = useStore();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [manual, setManual] = useState(false);
  const [photo, setPhoto] = useState<{ base64: string; dataUrl: string; thumb: string } | null>(null);
  const [items, setItems] = useState<FoodItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [meta, setMeta] = useState<{ confidence: "low" | "medium" | "high"; note?: string } | null>(null);

  useEffect(() => { const t = setTimeout(() => { if (new URLSearchParams(window.location.search).get("manual")) { setManual(true); setItems([blank()]); } }, 0); return () => clearTimeout(t); }, []);
  useEffect(() => { if (s.hydrated && !s.fuel) router.replace("/fast"); }, [s.hydrated, s.fuel, router]);

  const run = async (b64: string, n: string) => {
    setBusy(true); setError("");
    try {
      const a = await analyzePhoto(b64, n);
      setItems(a.items.length ? a.items : [blank()]); setMeta({ confidence: a.confidence, note: a.note });
      if (!a.items.length) setError("No food found in that photo. Add it by hand or try another shot.");
      track("fuel_photo_counted", { items: a.items.length, confidence: a.confidence });
    } catch (e) { setError((e as Error).message); setItems((x) => (x.length ? x : [blank()])); track("fuel_photo_failed", {}); }
    setBusy(false);
  };

  const pick = async (f: File | undefined) => {
    if (!f) return;
    try { const p = await shrink(f); setPhoto(p); setManual(false); await run(p.base64, note); }
    catch (e) { setError((e as Error).message); }
  };

  const edit = (k: number, key: keyof FoodItem, v: string) => setItems((xs) => xs.map((x, j) => (j === k ? { ...x, [key]: key === "name" || key === "portion" ? v : Math.max(0, Math.round(Number(v) || 0)) } : x)));
  const total = items.reduce((a, x) => ({ kcal: a.kcal + x.kcal, protein: a.protein + x.protein }), { kcal: 0, protein: 0 });
  const valid = items.filter((x) => x.name.trim() && (x.kcal > 0 || x.protein > 0));

  const save = () => {
    if (!valid.length) return;
    const now = new Date();
    const entry = { id: uid(), date: localDate(now, s.profile.timezone), at: now.toISOString(), items: valid.map((x) => ({ ...x, name: x.name.trim() })), source: photo ? "photo" as const : "manual" as const, thumb: photo?.thumb, confidence: meta?.confidence };
    s.patch((x) => (x.fuel ? { fuel: { ...x.fuel, meals: [...x.fuel.meals.filter((m) => m.date >= localDate(new Date(now.getTime() - 35 * 864e5))), entry] }, toast: `Logged ${total.kcal.toLocaleString()} kcal` } : {}));
    track("fuel_meal_saved", { source: entry.source, items: entry.items.length, kcal: total.kcal });
    router.push("/fast");
  };

  const showEditor = manual || photo;

  return (
    <div className="screen pb-10">
      <TopBar title="Log a meal" back="/fast" />
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" aria-hidden="true" tabIndex={-1} onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />

      {!showEditor && (
        <div className="px-6 pt-6 grid gap-4">
          <h1 className="display t-h1">Snap it, check it, log it</h1>
          <p className="t-body text-text-2">Take a photo of your plate. AI estimates each item&apos;s calories and protein, and you fix anything it got wrong before it&apos;s saved.</p>
          <button onClick={() => fileRef.current?.click()} className="press aspect-[4/3] max-w-full rounded-[26px] border-2 border-dashed border-ink-4 bg-ink-2 flex flex-col items-center justify-center gap-3 text-lime">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8a2 2 0 0 1 2-2h2l2-2h6l2 2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><circle cx="12" cy="13" r="4" /></svg>
            <span className="font-extrabold text-[17px]">Take a photo</span>
            <span className="t-small text-muted">or choose one from your library</span>
          </button>
          <button onClick={() => { setManual(true); setItems([blank()]); }} className="press t-body text-muted underline underline-offset-2 min-h-[44px]">Add by hand instead</button>
          {error && <p className="t-small text-amber" role="alert">{error}</p>}
        </div>
      )}

      {showEditor && (
        <div className="px-6 pt-4 grid gap-4">
          {photo && (
            <div className="relative rounded-[22px] overflow-hidden bg-ink-2">
              <img src={photo.dataUrl} alt="Your meal" className="w-full max-h-[260px] object-cover" />
              {busy && <div className="absolute inset-0 bg-ink/70 flex flex-col items-center justify-center gap-2"><div className="w-10 h-10 rounded-full border-4 border-lime border-t-transparent animate-spin" /><span className="t-small font-bold">Counting your plate</span></div>}
              <button onClick={() => fileRef.current?.click()} className="press absolute top-3 right-3 bg-ink/80 rounded-full px-3 h-9 t-small font-bold">Retake</button>
            </div>
          )}
          {meta && !busy && (
            <div className="flex items-start gap-2">
              <Chip tone={meta.confidence === "high" ? "lime" : "dim"}>{meta.confidence} confidence</Chip>
              {meta.note && <p className="t-small text-muted">{meta.note}</p>}
            </div>
          )}
          {error && <p className="t-small text-amber" role="alert">{error}</p>}

          {photo && (
            <div className="flex gap-2">
              <input aria-label="Add a detail for the estimate" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a detail: cooked in butter, large bowl" className={`${cell} flex-1`} />
              <button disabled={busy} onClick={() => run(photo.base64, note)} className="press h-11 px-4 rounded-xl border-[1.5px] border-ink-4 font-bold disabled:opacity-40">Recount</button>
            </div>
          )}

          {!busy && (
            <div className="grid gap-3">
              <div className="flex items-center justify-between"><div className="t-micro text-muted">Items</div><div className="t-small text-muted">kcal · protein g</div></div>
              {items.map((x, k) => (
                <div key={k} className="grid gap-2 rounded-2xl bg-ink-2 p-3">
                  <div className="flex gap-2">
                    <input aria-label="Food" value={x.name} onChange={(e) => edit(k, "name", e.target.value)} placeholder="Food" className={`${cell} flex-1`} />
                    <button onClick={() => setItems((xs) => (xs.length > 1 ? xs.filter((_, j) => j !== k) : [blank()]))} aria-label="Remove item" className="press w-11 h-11 rounded-xl flex items-center justify-center text-muted-2"><Icon.Close size={16} /></button>
                  </div>
                  <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-2">
                    <input aria-label="Portion" value={x.portion} onChange={(e) => edit(k, "portion", e.target.value)} placeholder="Portion" className={cell} />
                    <input aria-label="Calories" type="number" inputMode="numeric" value={x.kcal || ""} onChange={(e) => edit(k, "kcal", e.target.value)} placeholder="kcal" className={`${cell} t-num`} />
                    <input aria-label="Protein grams" type="number" inputMode="numeric" value={x.protein || ""} onChange={(e) => edit(k, "protein", e.target.value)} placeholder="g" className={`${cell} t-num`} />
                  </div>
                </div>
              ))}
              <button onClick={() => setItems((xs) => [...xs, blank()])} className="press h-11 rounded-xl border-[1.5px] border-dashed border-ink-4 t-small font-bold text-muted">Add an item</button>
              <div className="flex items-baseline justify-between hairline pt-3"><span className="t-micro text-muted">Total</span><span><span className="t-num text-[24px]">{total.kcal.toLocaleString()}</span><span className="t-small text-muted"> kcal · {total.protein} g protein</span></span></div>
              <Button onClick={save} disabled={!valid.length}>Log this meal</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
