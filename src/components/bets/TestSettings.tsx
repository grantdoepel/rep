"use client";
// PRD 7 · The Test Set, Settings slot. Birth year and sex, only so the monthly Test can be compared to published norms.
import { useState } from "react";
import { useStore } from "@/lib/store";

const SEXES: { k: "f" | "m" | "none"; label: string }[] = [{ k: "f", label: "F" }, { k: "m", label: "M" }, { k: "none", label: "Prefer not" }];

export function TestSettings() {
  const s = useStore();
  const [year, setYear] = useState(s.profile.birthYear ? String(s.profile.birthYear) : "");
  // a birth year arriving from the server after mount replaces the field (derived state, no effect)
  const [seenYear, setSeenYear] = useState(s.profile.birthYear);
  if (s.profile.birthYear !== seenYear) { setSeenYear(s.profile.birthYear); if (s.profile.birthYear) setYear(String(s.profile.birthYear)); }
  const sex: "f" | "m" | "none" = s.profile.sex ?? "none";

  const saveYear = (v: string) => {
    const digits = v.replace(/\D/g, "").slice(0, 4);
    setYear(digits);
    if (digits.length === 4) { const n = Number(digits); const now = new Date().getFullYear(); if (n >= now - 110 && n <= now - 10 && n !== s.profile.birthYear) s.patchProfile({ birthYear: n }); }
    else if (digits.length === 0 && s.profile.birthYear) s.patchProfile({ birthYear: undefined });
  };
  const pick = (k: "f" | "m" | "none") => { if (k === sex) return; s.patchProfile({ sex: k === "none" ? undefined : k }); };

  return (
    <div className="px-6 pt-4">
      <div className="t-micro text-muted">Test Set</div>
      <div className="flex bg-ink-3 rounded-full p-1 mt-2.5" role="radiogroup" aria-label="Sex">
        {SEXES.map((o) => <button key={o.k} role="radio" aria-checked={sex === o.k} onClick={() => pick(o.k)} className={`flex-1 h-10 rounded-full font-bold text-[13px] ${sex === o.k ? "bg-lime text-ink" : "text-muted"}`}>{o.label}</button>)}
      </div>
      <div className="flex items-center gap-3 mt-2">
        <input value={year} onChange={(e) => saveYear(e.target.value)} inputMode="numeric" pattern="[0-9]*" maxLength={4} placeholder="YYYY" aria-label="Birth year" className="w-[108px] h-11 rounded-xl bg-ink-3 border-[1.5px] border-ink-4 px-3.5 text-[14px] t-num outline-none focus:border-lime" />
        <span className="t-small text-muted font-semibold">Birth year</span>
      </div>
      <div className="text-[12px] text-muted mt-2 leading-[1.4]">Only used to compare your monthly Test to published norms. Never shared.</div>
    </div>
  );
}
