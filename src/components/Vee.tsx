"use client";
import React from "react";

/**
 * Vee — the uvu mascot.
 * A small coral character with a lime v-crest. Big eyes do the acting; the arms do the posing.
 * The happy face closes the eyes into two u's over the v mouth — the name, spelled: u v u.
 * Drawn as code so it scales, animates and changes mood without assets.
 */
export type Mood = "neutral" | "happy" | "proud" | "worried" | "sleepy" | "sweaty";

const C = {
  body: "#FF6B4A",
  bodyDark: "#D9502F",
  bodyLight: "#FF8E72",
  belly: "#FFB39E",
  ink: "#0C0D11",
  lime: "#C8FF3D",
  limeDark: "#9CD41A",
  bone: "#F4F5F7",
  sky: "#8FB0FF",
};

type Pt = [number, number];
// arm poses: shoulder → hand, per side (left is viewer-left)
const ARMS: Record<Mood, { l: [Pt, Pt]; r: [Pt, Pt] }> = {
  neutral: { l: [[23, 60], [15, 76]], r: [[77, 60], [85, 76]] },
  happy:   { l: [[23, 58], [9, 42]],  r: [[77, 58], [91, 42]] },
  proud:   { l: [[23, 60], [14, 74]], r: [[77, 56], [90, 32]] },
  worried: { l: [[23, 60], [30, 70]], r: [[77, 60], [70, 70]] },
  sleepy:  { l: [[23, 60], [14, 76]], r: [[77, 58], [62, 70]] },
  sweaty:  { l: [[23, 60], [15, 76]], r: [[77, 56], [70, 36]] },
};

export function Vee({ size = 64, mood = "neutral", bob = false, className = "" }: { size?: number; mood?: Mood; bob?: boolean; className?: string }) {
  const arms = ARMS[mood];
  const Arm = ({ p, fist }: { p: [Pt, Pt]; fist?: boolean }) => (
    <g>
      <path d={`M ${p[0][0]} ${p[0][1]} L ${p[1][0]} ${p[1][1]}`} stroke={C.body} strokeWidth="10" strokeLinecap="round" fill="none" />
      <circle cx={p[1][0]} cy={p[1][1]} r={fist ? 7.2 : 6.6} fill={C.body} />
      <circle cx={p[1][0] - 1.5} cy={p[1][1] - 1.5} r={2.4} fill={C.bodyLight} opacity="0.7" />
    </g>
  );

  // eyes: white, pupil, highlight — the pupil offset gives the glance
  const Eye = ({ cx }: { cx: number }) => {
    const side = cx < 50 ? -1 : 1;
    if (mood === "happy") {
      // closed-happy u: the "u" of uvu
      return <path d={`M ${cx - 7} 44 a 7 7 0 0 0 14 0`} stroke={C.ink} strokeWidth="4.5" strokeLinecap="round" fill="none" />;
    }
    const look: Record<Exclude<Mood, "happy">, Pt> = { neutral: [side * 0.8, 1], proud: [1.6, -1.6], worried: [side * -0.6, 2.2], sleepy: [0, 2.5], sweaty: [2.2, 0.6] };
    const [dx, dy] = look[mood];
    const pupil = mood === "worried" ? 4 : 5;
    return (
      <g>
        <ellipse cx={cx} cy="46" rx="9.5" ry="11" fill={C.bone} />
        <circle cx={cx + dx} cy={46 + dy} r={pupil} fill={C.ink} />
        <circle cx={cx + dx + 1.8} cy={46 + dy - 2} r="1.6" fill={C.bone} />
        {/* lids */}
        {mood === "sleepy" && <path d={`M ${cx - 10} 46 a 10 11 0 0 1 20 0 Z`} fill={C.body} />}
        {mood === "proud" && side === 1 && <path d={`M ${cx - 10} 43 a 10 11 0 0 1 20 0 L ${cx + 10} 35 L ${cx - 10} 35 Z`} fill={C.body} />}
        {mood === "sweaty" && <path d={`M ${cx - 10} 40 a 10 11 0 0 1 20 0 L ${cx + 10} 33 L ${cx - 10} 33 Z`} fill={C.body} />}
      </g>
    );
  };

  // brows: a thick stroke whose tilt carries the emotion
  const Brow = ({ cx }: { cx: number }) => {
    const side = cx < 50 ? -1 : 1;
    const d: Record<Mood, string | null> = {
      neutral: `M ${cx - 6} 31.5 Q ${cx} 29.5 ${cx + 6} 31.5`,
      happy: `M ${cx - 7} 31 Q ${cx} 27 ${cx + 7} 31`,
      proud: side === 1 ? `M ${cx - 7} 29 Q ${cx} 24 ${cx + 7} 28` : `M ${cx - 7} 32 Q ${cx} 29 ${cx + 7} 31`,
      worried: `M ${cx - 7} ${side === -1 ? 34 : 29} Q ${cx} ${side === -1 ? 29 : 30} ${cx + 7} ${side === -1 ? 29 : 34}`,
      sleepy: `M ${cx - 7} 33 Q ${cx} 32 ${cx + 7} 33`,
      sweaty: `M ${cx - 7} ${side === -1 ? 30 : 32} Q ${cx} 29 ${cx + 7} ${side === -1 ? 32 : 30}`,
    };
    return d[mood] ? <path d={d[mood]!} stroke={C.ink} strokeWidth="3.6" strokeLinecap="round" fill="none" /> : null;
  };

  const mouth = (() => {
    switch (mood) {
      case "happy":
        // wide open v-smile with a lime tongue
        return (
          <g>
            <path d="M 37 59 L 50 74 L 63 59 C 57 63 43 63 37 59 Z" fill={C.ink} />
            <path d="M 44 66 L 50 72.5 L 56 66 C 53 68 47 68 44 66 Z" fill={C.lime} />
          </g>
        );
      case "proud":
        return <path d="M 41 63 L 50 69 L 59 61" stroke={C.ink} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />;   // lopsided v
      case "worried":
        return <path d="M 43 68 Q 50 62 57 68" stroke={C.ink} strokeWidth="3.6" strokeLinecap="round" fill="none" />;                           // small frown
      case "sleepy":
        return <ellipse cx="50" cy="67" rx="4.5" ry="6" fill={C.ink} />;                                                                           // yawn
      case "sweaty":
        return <path d="M 42 66 Q 46 63 50 66 Q 54 69 58 65" stroke={C.ink} strokeWidth="3.6" strokeLinecap="round" fill="none" />;             // wobbly
      default:
        return <path d="M 42 62 L 50 69 L 58 62" stroke={C.ink} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />;    // v
    }
  })();

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={`${bob ? "a-bob" : ""} ${className}`} role="img" aria-label={`Vee, the uvu mascot, looking ${mood}`}>
      {/* ground shadow */}
      <ellipse cx="50" cy="94" rx="24" ry="3" fill={C.ink} opacity="0.18" />
      {/* feet */}
      <ellipse cx="39" cy="90" rx="9" ry="5" fill={C.bodyDark} />
      <ellipse cx="61" cy="90" rx="9" ry="5" fill={C.bodyDark} />
      {/* back arm (the one behind the body when raised across) */}
      <Arm p={arms.l} />
      {/* body: egg, heavier at the bottom */}
      <path d="M 50 13 C 70 13 83 27 83 48 C 83 71 71 88 50 88 C 29 88 17 71 17 48 C 17 27 30 13 50 13 Z" fill={C.body} />
      <path d="M 22 66 C 28 84 72 84 78 66 C 72 78 28 78 22 66 Z" fill={C.bodyDark} opacity="0.5" />
      <ellipse cx="50" cy="74" rx="16" ry="10" fill={C.belly} />
      <ellipse cx="38" cy="24" rx="9" ry="4" fill={C.bone} opacity="0.16" transform="rotate(-25 38 24)" />
      {/* crest: the v, as a tuft */}
      <path d="M 40 7 L 50 19 L 60 7" stroke={C.limeDark} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M 40 6 L 50 17 L 60 6" stroke={C.lime} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* face */}
      {(mood === "happy" || mood === "proud") && <><ellipse cx="27" cy="58" rx="4.5" ry="3" fill={C.lime} opacity="0.75" /><ellipse cx="73" cy="58" rx="4.5" ry="3" fill={C.lime} opacity="0.75" /></>}
      <Eye cx={38} />
      <Eye cx={62} />
      <Brow cx={38} />
      <Brow cx={62} />
      {mouth}
      {/* front arm */}
      <Arm p={arms.r} fist={mood === "proud"} />
      {/* props */}
      {mood === "sweaty" && <><path d="M 24 30 c 0 -4 4 -7 4 -10 c 0 3 4 6 4 10 a 4 4 0 0 1 -8 0 z" fill={C.sky} /><path d="M 30 14 c 0 -3 3 -5 3 -7 c 0 2 3 4 3 7 a 3 3 0 0 1 -6 0 z" fill={C.sky} opacity="0.8" /></>}
      {mood === "sleepy" && <><text x="80" y="22" fontSize="13" fontWeight="800" fill={C.lime} fontFamily="Outfit, system-ui, sans-serif">z</text><text x="89" y="12" fontSize="9" fontWeight="800" fill={C.lime} fontFamily="Outfit, system-ui, sans-serif" opacity="0.7">z</text></>}
      {mood === "proud" && <><path d="M 92 20 l 1.5 4 l 4 1.5 l -4 1.5 l -1.5 4 l -1.5 -4 l -4 -1.5 l 4 -1.5 z" fill={C.lime} /><circle cx="6" cy="30" r="1.8" fill={C.lime} opacity="0.8" /></>}
    </svg>
  );
}
