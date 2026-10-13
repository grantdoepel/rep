"use client";
// Fuel · meals. A photo goes to the food_vision edge function, which asks a vision model for an itemised
// estimate. The person always confirms or edits before anything is logged: the model guesses, you decide.
import type { FastingInputs, FastingPlan, FuelLog } from "./fasting";
import { supabase } from "./supabase";

export interface FoodItem { name: string; portion: string; kcal: number; protein: number; carbs: number; fat: number }
export interface MealEntry { id: string; date: string; at: string; items: FoodItem[]; source: "photo" | "manual"; thumb?: string; confidence?: "low" | "medium" | "high" }
export interface Fuel { inputs: FastingInputs; plan: FastingPlan; log: FuelLog; meals: MealEntry[] }
export interface Analysis { items: FoodItem[]; confidence: "low" | "medium" | "high"; note?: string }

export const mealKcal = (m: MealEntry) => m.items.reduce((a, i) => a + (i.kcal || 0), 0);
export const mealProtein = (m: MealEntry) => m.items.reduce((a, i) => a + (i.protein || 0), 0);
export function dayTotals(meals: MealEntry[], date: string) {
  const ms = meals.filter((m) => m.date === date);
  return { kcal: Math.round(ms.reduce((a, m) => a + mealKcal(m), 0)), protein: Math.round(ms.reduce((a, m) => a + mealProtein(m), 0)), meals: ms };
}

/** Downscale a camera photo before it leaves the phone: faster upload, cheaper model call, no full-res food pics on a server. */
export async function shrink(file: File, max = 1024, quality = 0.82): Promise<{ base64: string; dataUrl: string; thumb: string }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("That photo couldn't be read. Try another one.")); i.src = url; });
    const draw = (size: number, q: number) => {
      const k = Math.min(1, size / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas"); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL("image/jpeg", q);
    };
    const dataUrl = draw(max, quality);
    return { dataUrl, base64: dataUrl.split(",")[1], thumb: draw(160, 0.7) };
  } finally { URL.revokeObjectURL(url); }
}

export async function analyzePhoto(base64: string, note: string): Promise<Analysis> {
  const sb = supabase();
  if (!sb) throw new Error("Photo counting needs the uvu server. Add the meal by hand for now.");
  const { data: sess } = await sb.auth.getSession();
  if (!sess.session) throw new Error("Sign in to use photo counting. You can add meals by hand without an account.");
  const { data, error } = await sb.functions.invoke("food_vision", { body: { image: base64, mediaType: "image/jpeg", note } });
  if (error) {
    let msg = "The photo couldn't be counted. Try again or add it by hand.";
    try { const body = await (error as { context?: Response }).context?.json(); if (body?.error) msg = body.error; } catch {}
    throw new Error(msg);
  }
  const a = data as Analysis;
  if (!a || !Array.isArray(a.items)) throw new Error("The photo couldn't be counted. Try again or add it by hand.");
  return a;
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
