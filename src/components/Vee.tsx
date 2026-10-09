"use client";
import React from "react";

/**
 * Vee — the uvu mascot. The face spells the name: two u-shaped eyes and a v for a mouth.
 * Drawn as code so it scales, animates, and changes mood without assets.
 */
export type Mood = "neutral" | "happy" | "proud" | "worried" | "sleepy" | "sweaty";

const C = { body: "#FF6B4A", bodyDark: "#E0553A", ink: "#0C0D11", lime: "#C8FF3D", bone: "#F4F5F7", sky: "#8FB0FF" };

export function Vee({ size = 64, mood = "neutral", bob = false, className = "" }: { size?: number; mood?: Mood; bob?: boolean; className?: string }) {
  const eye = (cx: number) => {
    switch (mood) {
      case "worried": return <><circle cx={cx} cy="49" r="5.5" fill={C.ink} /><circle cx={cx + 1.8} cy="47.2" r="1.8" fill={C.bone} /></>;
      case "sleepy": return <path d={`M ${cx - 6} 49 h 12`} stroke={C.ink} strokeWidth="3.5" strokeLinecap="round" fill="none" />;
      case "proud": return <path d={`M ${cx - 6} 51 a 6 6 0 0 1 12 0`} stroke={C.ink} strokeWidth="3.5" strokeLinecap="round" fill="none" />;   // ∩ smug
      default: return <path d={`M ${cx - 6} 45 a 6 6 0 0 0 12 0`} stroke={C.ink} strokeWidth="3.5" strokeLinecap="round" fill="none" />;        // u happy-closed
    }
  };
  const mouth = (() => {
    switch (mood) {
      case "worried": return <path d="M 42 67 L 50 61 L 58 67" stroke={C.ink} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />;   // ^
      case "happy": return <path d="M 40 61 L 50 71 L 60 61" stroke={C.ink} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />;        // big v
      case "proud": return <path d="M 42 63 L 50 69 L 58 63" stroke={C.ink} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />;
      case "sleepy": return <ellipse cx="50" cy="66" rx="3.5" ry="4.5" fill={C.ink} />;                                                                                // o yawn
      default: return <path d="M 43 62 L 50 68 L 57 62" stroke={C.ink} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />;             // v
    }
  })();
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={`${bob ? "a-bob" : ""} ${className}`} role="img" aria-label={`Vee, the uvu mascot, looking ${mood}`}>
      {/* body: a rounded coral drop with a lime v-crest. The crest is the mark. */}
      <path d="M 50 12 C 74 12 88 28 88 52 C 88 74 72 90 50 90 C 28 90 12 74 12 52 C 12 28 26 12 50 12 Z" fill={C.body} />
      <path d="M 24 72 C 30 86 70 86 76 72 C 70 80 30 80 24 72 Z" fill={C.bodyDark} opacity="0.55" />
      <path d="M 41 12 L 50 22 L 59 12" stroke={C.lime} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* cheeks */}
      {(mood === "happy" || mood === "proud") && <><circle cx="29" cy="61" r="4" fill={C.lime} opacity="0.7" /><circle cx="71" cy="61" r="4" fill={C.lime} opacity="0.7" /></>}
      {/* sweat */}
      {mood === "sweaty" && <path d="M 74 36 c 0 -5 5 -9 5 -13 c 0 4 5 8 5 13 a 5 5 0 0 1 -10 0 z" fill={C.sky} />}
      {/* face: u v u */}
      {eye(36)}
      {eye(64)}
      {mouth}
      {mood === "sleepy" && <text x="78" y="30" fontSize="14" fontWeight="800" fill={C.lime} fontFamily="system-ui, sans-serif">z</text>}
    </svg>
  );
}
