"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useEffect, useState } from "react";
import { Vee, type Mood } from "./Vee";

export function useMounted() { const [m, setM] = useState(false); useEffect(() => setM(true), []); return m; }

/** Haptic tap where the platform allows it; silently nothing elsewhere. */
export function haptic(pattern: number | number[] = 12) { try { navigator.vibrate?.(pattern); } catch {} }

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export const Icon = {
  Flame: ({ size = 24, color = "#FF6B4A", className = "" }: { size?: number; color?: string; className?: string }) => (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true"><path d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3 1-3s0 2 2 2c0-4-1-6 2-10z" /></svg>
  ),
  Gem: ({ size = 16, color = "#C8FF3D" }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 3h12l4 6-10 13L2 9z" /><path d="M11 3 8 9l4 13 4-13-3-6" /></svg>
  ),
  Check: ({ size = 16, color = "#0C0D11" }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>
  ),
  Play: ({ size = 18, color = "#C8FF3D" }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true"><path d="M7 4l13 8-13 8z" /></svg>
  ),
  Crown: ({ size = 18, filled = true, color = "#C8FF3D" }: { size?: number; filled?: boolean; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : "none"} stroke={color} strokeWidth="2" aria-hidden="true"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" /></svg>
  ),
  Close: ({ size = 18 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} strokeWidth="2.4" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
  ),
  Back: ({ size = 18 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} strokeWidth="2.4" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
  ),
  Send: ({ size = 18 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} strokeWidth="2.4" aria-hidden="true"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" /></svg>
  ),
  Thumb: ({ size = 16 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} strokeWidth="2.4" aria-hidden="true"><path d="M7 11v9H4v-9zM7 11l4-8a2 2 0 0 1 2 2v4h5a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 16.8 20H7" /></svg>
  ),
  Arrow: ({ size = 16 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} strokeWidth="2.6" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
  ),
  Up: ({ size = 14 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} strokeWidth="3" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6" /></svg>
  ),
};

/** The uvu mark: u-v-u as one stroke. `accent` colours the v. */
export function Mark({ height = 24, color = "#F4F5F7", accent = "#C8FF3D", draw = false }: { height?: number; color?: string; accent?: string; draw?: boolean }) {
  const w = Math.round(height * 1.6);
  return (
    <svg width={w} height={height} viewBox="30 70 160 100" aria-hidden="true">
      <path d="M 36 80 V 114 a 26 26 0 0 0 52 0 V 80 L 110 160 L 132 80 V 114 a 26 26 0 0 0 52 0 V 80" fill="none" stroke={color} strokeWidth="17" strokeLinecap="round" strokeLinejoin="round" className={draw ? "a-draw" : ""} style={draw ? ({ "--len": 520 } as React.CSSProperties) : undefined} />
      <path d="M 88 80 L 110 160 L 132 80" fill="none" stroke={accent} strokeWidth="17" strokeLinecap="round" strokeLinejoin="round" className={draw ? "a-draw d3" : ""} style={draw ? ({ "--len": 170 } as React.CSSProperties) : undefined} />
    </svg>
  );
}

export function Wordmark({ size = 22 }: { size?: number }) {
  return <div className="display" style={{ fontSize: size, letterSpacing: "-0.05em" }}>uvu<span className="text-lime">.</span></div>;
}

/** Progress ring. value 0..1. Children sit in the middle. */
export function Ring({ value, size = 120, width = 10, color = "#C8FF3D", track = "rgba(244,245,247,0.08)", children, className = "" }: { value: number; size?: number; width?: number; color?: string; track?: string; children?: React.ReactNode; className?: string }) {
  const r = (size - width) / 2, c = 2 * Math.PI * r, v = Math.max(0, Math.min(1, value));
  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={width} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v)} style={{ transition: "stroke-dashoffset 600ms cubic-bezier(.2,.9,.2,1)" }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

/** Seven-day pulse: the week drawn as one line. kinds: perfect | done | rest | frozen | missed | moved | today | future.
 *  "moved" is a hollow lime dot (credited from elsewhere, no XP). `target` (1-based) draws a small hairline tick at that day: the Promise's mark. */
export function Pulse({ days, width = 320, height = 72, target }: { days: { label: string; kind: string }[]; width?: number; height?: number; target?: number }) {
  const n = days.length, pad = 14, step = (width - pad * 2) / (n - 1);
  const y = (k: string) => (k === "perfect" ? 12 : k === "done" || k === "moved" ? 18 : k === "rest" || k === "frozen" ? 26 : k === "today" ? 30 : 36);
  const pts = days.map((d, i) => [pad + i * step, y(d.kind)] as const);
  const lastReal = days.reduce((a, d, i) => (["perfect", "done", "rest", "frozen", "missed", "moved"].includes(d.kind) ? i : a), -1);
  const path = pts.slice(0, Math.max(1, lastReal + 1)).map(([x, yy], i) => `${i ? "L" : "M"} ${x} ${yy}`).join(" ");
  const tickX = target !== undefined && target >= 1 && target <= n ? pad + (target - 1) * step : undefined;
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" aria-label="This week" role="img" style={{ maxWidth: width, display: "block" }}>
      {tickX !== undefined && <line x1={tickX} y1={1} x2={tickX} y2={7} stroke="#7D8494" strokeWidth="1" strokeLinecap="round" />}
      {lastReal > 0 && <path d={path} fill="none" stroke="#F4F5F7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="a-draw" style={{ "--len": 600 } as React.CSSProperties} />}
      {pts.map(([x, yy], i) => {
        const k = days[i].kind;
        const on = k === "perfect" || k === "done";
        const fill = on ? "#C8FF3D" : k === "rest" || k === "frozen" ? "#8FB0FF" : k === "missed" ? "#2A2D38" : k === "today" || k === "moved" ? "#0C0D11" : "transparent";
        return (
          <g key={i}>
            {k === "today" && <circle cx={x} cy={yy} r="10" fill="none" stroke="#C8FF3D" strokeWidth="2" className="a-ring" style={{ transformBox: "fill-box", transformOrigin: "center" }} />}
            <circle cx={x} cy={yy} r={k === "future" ? 4 : 6} fill={fill} stroke={k === "future" ? "#2A2D38" : k === "today" || k === "moved" ? "#C8FF3D" : "none"} strokeWidth="2" />
            <text x={x} y={height - 4} textAnchor="middle" fontSize="11" fontWeight="700" fill={k === "today" ? "#F4F5F7" : "#7D8494"}>{days[i].label}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** The voice. A line, not a character, until there is real illustration. */
export function Mascot({ line, mood = "neutral" }: { line: string; mood?: Mood }) {
  return (
    <div className="flex gap-3 items-start">
      <Vee size={40} mood={mood} className="shrink-0 -mt-1" />
      <div className="t-body text-text-2 pt-1">{line}</div>
    </div>
  );
}

export function Avatar({ initials, color = "#262A35", size = 36, fg = "#F4F5F7", ring }: { initials: string; color?: string; size?: number; fg?: string; ring?: boolean }) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {ring && <div className="absolute inset-0 rounded-full border-2 border-lime a-ring" />}
      <div className="rounded-full flex items-center justify-center font-bold" style={{ width: size, height: size, background: color, color: fg, fontSize: size * 0.36 }}>{initials}</div>
    </div>
  );
}

const btn = {
  base: "press rounded-2xl font-extrabold flex items-center justify-center gap-2.5 w-full disabled:opacity-40",
  primary: "h-[56px] text-[17px] bg-lime text-ink",
  ink: "h-[56px] text-[17px] bg-ink text-lime",
  secondary: "h-12 text-[15px] font-bold border-[1.5px] border-ink-4 text-text bg-transparent",
  ghost: "h-11 text-[14px] font-semibold text-muted",
  coral: "h-[56px] text-[17px] bg-coral text-ink",
  white: "h-[56px] text-[17px] bg-text text-ink",
};
type Variant = "primary" | "ink" | "secondary" | "ghost" | "coral" | "white";
export function Button({ children, variant = "primary", className = "", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={`${btn.base} ${btn[variant]} ${className}`} {...rest}>{children}</button>;
}
export function LinkButton({ href, children, variant = "primary", className = "" }: { href: string; children: React.ReactNode; variant?: Variant; className?: string }) {
  return <Link href={href} className={`${btn.base} ${btn[variant]} ${className}`}>{children}</Link>;
}

export function Chip({ children, tone = "dim" }: { children: React.ReactNode; tone?: "dim" | "lime" | "coral" | "blue" | "ink" | "ghost" }) {
  const t = { dim: "bg-ink-3 text-muted", lime: "bg-lime/12 text-lime", coral: "bg-coral/15 text-coral", blue: "bg-blue/20 text-sky", ink: "bg-ink text-lime", ghost: "bg-ghost-fill text-sky" }[tone];
  return <span className={`text-[11px] font-bold rounded-full px-2.5 py-1 whitespace-nowrap ${t}`}>{children}</span>;
}

export function Eyebrow({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "lime" | "coral" | "sky" }) {
  const c = { muted: "text-muted", lime: "text-lime", coral: "text-coral", sky: "text-sky" }[tone];
  return <div className={`t-micro ${c}`}>{children}</div>;
}

/** Section header with a hairline above. Sections, not cards, are how a screen is divided. */
export function Section({ title, right, children, className = "" }: { title: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`hairline mx-6 pt-5 pb-1 ${className}`}>
      <div className="flex items-center justify-between mb-3"><div className="t-micro text-muted">{title}</div>{right}</div>
      {children}
    </section>
  );
}

/** A tappable surface. Use only when the whole thing is one action. */
export function Surface({ children, tone = "raised", className = "" }: { children: React.ReactNode; tone?: "raised" | "lime" | "outline"; className?: string }) {
  const t = { raised: "bg-ink-3", lime: "bg-lime text-ink", outline: "border-[1.5px] border-ink-4" }[tone];
  return <div className={`rounded-[22px] ${t} ${className}`}>{children}</div>;
}

export function TopBar({ title, back = "/", right }: { title?: string; back?: string; right?: React.ReactNode }) {
  return (
    <div className="safe-top px-6 pt-8 flex items-center justify-between">
      <Link href={back} aria-label="Back" className="press w-11 h-11 -ml-2 rounded-full flex items-center justify-center"><Icon.Back /></Link>
      {title && <div className="t-micro text-muted">{title}</div>}
      <div className="w-11 h-11 flex items-center justify-center">{right}</div>
    </div>
  );
}

const tabs = [
  { href: "/", label: "Today", icon: <><path d="M4 8v4a3 3 0 0 0 6 0V8M10 8l2 10 2-10M14 8v4a3 3 0 0 0 6 0V8" /></> },
  { href: "/tree", label: "Crowns", icon: <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" /> },
  { href: "/league", label: "League", icon: <><path d="M3 20h18" /><path d="M6 20v-7h4v7M14 20V9h4v11M10 20V4h4v16" /></> },
  { href: "/friends", label: "Friends", icon: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><circle cx="17" cy="9" r="2.5" /><path d="M15.5 14.5a5 5 0 0 1 6 5" /></> },
];

export function TabBar() {
  const path = usePathname();
  return (
    <nav className="mt-auto flex justify-around items-center pt-2.5 px-2.5 safe-bottom hairline bg-ink sticky bottom-0 z-20">
      {tabs.map((t) => {
        const on = t.href === "/" ? path === "/" : path.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} aria-label={t.label} aria-current={on ? "page" : undefined} className="press flex flex-col items-center gap-1 min-w-[64px] min-h-[48px] py-1.5 justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={on ? "#C8FF3D" : "#7D8494"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{t.icon}</svg>
            <span className={`text-[11px] ${on ? "font-bold text-lime" : "font-semibold text-muted-2"}`}>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function Confetti({ colors = ["#0C0D11", "#FF6B4A", "#3D4EFF", "#0C0D11", "#FF6B4A"] }: { colors?: string[] }) {
  return <>{colors.map((c, i) => <div key={i} className="a-fall absolute w-2.5 h-3.5 rounded-[2px] pointer-events-none" style={{ left: 40 + i * 70, background: c, animationDelay: `${i * 0.55}s` }} />)}</>;
}

/** Counts a number up from 0 for the reward moment. */
export function CountUp({ to, duration = 900, className = "" }: { to: number; duration?: number; className?: string }) {
  const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const [v, setV] = useState(reduced ? to : 0);
  useEffect(() => {
    if (reduced) return;
    let raf = 0; const t0 = performance.now();
    const step = (t: number) => { const k = Math.min(1, (t - t0) / duration); const e = 1 - Math.pow(1 - k, 3); setV(Math.round(to * e)); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
  }, [to, duration, reduced]);
  return <span className={className}>{v}</span>;
}
