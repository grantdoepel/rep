"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useEffect, useState } from "react";

export function useMounted() { const [m, setM] = useState(false); useEffect(() => setM(true), []); return m; }

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
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
  ),
  Back: ({ size = 18 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
  ),
  Send: ({ size = 18 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" /></svg>
  ),
  Thumb: ({ size = 16 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 11v9H4v-9zM7 11l4-8a2 2 0 0 1 2 2v4h5a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 16.8 20H7" /></svg>
  ),
};

export function Mascot({ line, mood = "neutral" }: { line: string; mood?: "neutral" | "worried" | "happy" }) {
  return (
    <div className="flex gap-3 items-start">
      <div className="w-10 h-10 rounded-[14px] bg-coral shrink-0 flex items-center justify-center">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0C0D11" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          {mood === "worried" ? <><path d="M7.5 9.5l3 1M16.5 9.5l-3 1" /><path d="M9 15.5h6" /></> : <><circle cx="9" cy="10" r="1.2" fill="#0C0D11" /><circle cx="15" cy="10" r="1.2" fill="#0C0D11" /><path d="M8.5 15c1 1.2 2.3 1.8 3.5 1.8s2.5-.6 3.5-1.8" /></>}
          <path d="M4 12a8 8 0 1 1 16 0 8 8 0 0 1-16 0z" />
        </svg>
      </div>
      <div className="bg-ink-3 rounded-[4px_18px_18px_18px] px-3.5 py-3 text-[14px] leading-[1.4] text-text-2">{line}</div>
    </div>
  );
}

export function Avatar({ initials, color = "#2A2D38", size = 36, fg = "#F4F5F7", ring }: { initials: string; color?: string; size?: number; fg?: string; ring?: boolean }) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {ring && <div className="absolute inset-0 rounded-full border-2 border-lime a-ring" />}
      <div className="rounded-full flex items-center justify-center font-bold" style={{ width: size, height: size, background: color, color: fg, fontSize: size * 0.36 }}>{initials}</div>
    </div>
  );
}

export function Button({ children, variant = "primary", className = "", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "coral" | "white" }) {
  const base = "h-[56px] rounded-2xl font-extrabold text-[17px] flex items-center justify-center gap-2.5 w-full disabled:opacity-40 active:scale-[.98] transition-transform";
  const v = { primary: "bg-lime text-ink", secondary: "border-[1.5px] border-ink-4 text-text bg-transparent font-bold text-[15px] h-12", ghost: "text-muted font-semibold text-[14px] h-11", coral: "bg-coral text-ink", white: "bg-text text-ink" }[variant];
  return <button className={`${base} ${v} ${className}`} {...rest}>{children}</button>;
}

export function LinkButton({ href, children, variant = "primary", className = "" }: { href: string; children: React.ReactNode; variant?: "primary" | "secondary" | "ghost" | "coral" | "white"; className?: string }) {
  const base = "h-[56px] rounded-2xl font-extrabold text-[17px] flex items-center justify-center gap-2.5 w-full active:scale-[.98] transition-transform";
  const v = { primary: "bg-lime text-ink", secondary: "border-[1.5px] border-ink-4 text-text bg-transparent font-bold text-[15px] h-12", ghost: "text-muted font-semibold text-[14px] h-11", coral: "bg-coral text-ink", white: "bg-text text-ink" }[variant];
  return <Link href={href} className={`${base} ${v} ${className}`}>{children}</Link>;
}

export function Chip({ children, tone = "dim" }: { children: React.ReactNode; tone?: "dim" | "lime" | "coral" | "blue" | "ink" }) {
  const t = { dim: "bg-ink-3 text-muted", lime: "bg-lime/12 text-lime", coral: "bg-coral/15 text-coral", blue: "bg-blue/20 text-sky", ink: "bg-ink text-lime" }[tone];
  return <span className={`text-[11px] font-bold rounded-full px-2.5 py-1 ${t}`}>{children}</span>;
}

export function Eyebrow({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "lime" | "coral" | "sky" }) {
  const c = { muted: "text-muted", lime: "text-lime", coral: "text-coral", sky: "text-sky" }[tone];
  return <div className={`text-[12px] font-bold tracking-[1.5px] uppercase ${c}`}>{children}</div>;
}

export function TopBar({ title, back = "/", right }: { title?: string; back?: string; right?: React.ReactNode }) {
  return (
    <div className="safe-top px-6 pt-10 flex items-center justify-between">
      <Link href={back} aria-label="Back" className="w-10 h-10 rounded-full bg-ink-3 flex items-center justify-center"><Icon.Back /></Link>
      {title && <div className="text-[13px] font-bold text-muted tracking-[1px] uppercase">{title}</div>}
      <div className="w-10 h-10 flex items-center justify-center">{right}</div>
    </div>
  );
}

const tabs = [
  { href: "/", label: "Home", icon: <path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /> },
  { href: "/tree", label: "Tree", icon: <><path d="M3 20h18M5 20V9l7-6 7 6v11" /><path d="M9 20v-6h6v6" /></> },
  { href: "/league", label: "League", icon: <><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" /><path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3" /></> },
  { href: "/friends", label: "Friends", icon: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><circle cx="17" cy="9" r="2.5" /><path d="M15.5 14.5a5 5 0 0 1 6 5" /></> },
];

export function TabBar() {
  const path = usePathname();
  return (
    <nav className="mt-auto flex justify-around items-center pt-3.5 px-2.5 safe-bottom border-t border-ink-3 bg-ink sticky bottom-0">
      {tabs.map((t) => {
        const on = t.href === "/" ? path === "/" : path.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} aria-label={t.label} className="flex flex-col items-center gap-1 min-w-[60px] py-1.5">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={on ? "#C8FF3D" : "#6B7180"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{t.icon}</svg>
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
