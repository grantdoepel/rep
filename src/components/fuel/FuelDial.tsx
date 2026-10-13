"use client";
// The 24-hour dial: midnight at the top, the eating window as a lime arc, training as dots, now as a ring.
import type { DayPlan } from "@/lib/fasting";

const C = 150;
const pt = (h: number, r: number): [number, number] => { const a = (h / 24) * Math.PI * 2 - Math.PI / 2; return [C + r * Math.cos(a), C + r * Math.sin(a)]; };
export function arc(h1: number, h2: number, r: number) {
  let span = h2 - h1; if (span <= 0) span += 24; span = Math.min(span, 23.99);
  const [x1, y1] = pt(h1, r), [x2, y2] = pt(h1 + span, r);
  return `M${x1.toFixed(2)} ${y1.toFixed(2)} A${r} ${r} 0 ${span > 12 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

export interface DialMarks { am?: number; pm?: number }

export function FuelDial({ day, prevEnd, hour, state, center, sub, marks, size = 300 }: {
  day: DayPlan; prevEnd: number; hour: number; state: "fast" | "eat" | "after";
  center: string; sub: string; marks: DialMarks; size?: number;
}) {
  const eating = state === "eat";
  return (
    <svg width={size} height={size} viewBox="0 0 300 300" role="img" aria-label={`${eating ? "Eating" : "Fasting"}. ${center} ${sub}.`} style={{ maxWidth: "100%", height: "auto" }}>
      <circle cx={C} cy={C} r={120} fill="none" stroke="#1A1C24" strokeWidth={18} />
      <path d={arc(day.start, day.end, 120)} fill="none" stroke="#C8FF3D" strokeOpacity={eating ? 1 : 0.28} strokeWidth={18} />
      {!eating && <path d={arc(day.start, day.end, 120)} fill="none" stroke="#C8FF3D" strokeWidth={4} strokeDasharray="2 6" strokeLinecap="round" />}
      {state === "fast" && <path d={arc(prevEnd % 24, hour, 120)} fill="none" stroke="#3A3F4D" strokeWidth={18} strokeLinecap="round" />}
      {state === "after" && hour - day.end > 0.05 && <path d={arc(day.end, hour, 120)} fill="none" stroke="#3A3F4D" strokeWidth={18} strokeLinecap="round" />}
      {Array.from({ length: 24 }, (_, h) => { const [x1, y1] = pt(h, 135), [x2, y2] = pt(h, h % 6 === 0 ? 142 : 139); return <line key={h} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#3A3F4D" strokeWidth={h % 6 === 0 ? 2 : 1} />; })}
      {marks.am !== undefined && (() => { const [x, y] = pt(marks.am, 120); return <circle cx={x} cy={y} r={6} fill="#F4F5F7" />; })()}
      {marks.pm !== undefined && (() => { const [x, y] = pt(marks.pm, 120); return <circle cx={x} cy={y} r={6} fill="#FFB347" />; })()}
      {(() => { const [x, y] = pt(hour, 120); return <circle cx={x} cy={y} r={11} fill="#0C0D11" stroke="#F4F5F7" strokeWidth={3} />; })()}
      {([[0, "12a"], [6, "6a"], [12, "12p"], [18, "6p"]] as const).map(([h, t]) => { const [x, y] = pt(h, 94); return <text key={t} x={x} y={y + 4} textAnchor="middle" fontSize="10" fill="#7D8494" fontWeight="700">{t}</text>; })}
      <text x={C} y={114} textAnchor="middle" fontSize="11" fontWeight="700" letterSpacing="1.6" fill={eating ? "#C8FF3D" : "#A0A6B4"}>{eating ? "EATING" : "FASTING"}</text>
      <text x={C} y={168} textAnchor="middle" fontSize="58" fontWeight="800" fill="#F4F5F7" letterSpacing="-2.5" style={{ fontFamily: "var(--font-display)" }}>{center}</text>
      <text x={C} y={194} textAnchor="middle" fontSize="12.5" fill="#A0A6B4">{sub}</text>
    </svg>
  );
}

/** A small ring for week rows and the Home card: just the window and training dots. */
export function MiniDial({ day, marks, size = 48, hour }: { day: DayPlan; marks: DialMarks; size?: number; hour?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 300 300" aria-hidden="true" className="shrink-0">
      <circle cx={C} cy={C} r={120} fill="none" stroke="#262A35" strokeWidth={40} />
      <path d={arc(day.start, day.end, 120)} fill="none" stroke="#C8FF3D" strokeWidth={40} />
      {marks.am !== undefined && (() => { const [x, y] = pt(marks.am, 120); return <circle cx={x} cy={y} r={22} fill="#F4F5F7" />; })()}
      {marks.pm !== undefined && (() => { const [x, y] = pt(marks.pm, 120); return <circle cx={x} cy={y} r={22} fill="#FFB347" />; })()}
      {hour !== undefined && (() => { const [x, y] = pt(hour, 120); return <circle cx={x} cy={y} r={30} fill="#0C0D11" stroke="#F4F5F7" strokeWidth={14} />; })()}
    </svg>
  );
}
