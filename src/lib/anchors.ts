"use client";
// PRD 6 · Anchors. Two anchors beyond the evening reminder: "when I get home" (geofence on open)
// and "when I tap my tag" (a QR / NFC sticker that opens /go?t=<code>).
import type { Profile } from "./types";
import { supabase } from "./supabase";
import { localDate } from "./rules";

const TAG_LOCAL = "uvu.tagLocal";
const FIRED = "uvu.anchorFired";
export const HOME_RADIUS_M = 150;

// ---------- tag code ----------
/** The device's fallback code when there's no account yet (or we're offline). Stable per device. */
export function localTagCode(): string {
  try {
    const have = localStorage.getItem(TAG_LOCAL);
    if (have) return have;
    const bytes = new Uint8Array(5); crypto.getRandomValues(bytes);
    const code = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    localStorage.setItem(TAG_LOCAL, code);
    return code;
  } catch { return "local0000a"; }
}

/** Server-minted code when signed in (ensure_tag_code RPC); the local fallback otherwise. */
export async function ensureTagCode(online: boolean): Promise<{ code: string; local: boolean }> {
  if (online) {
    const sb = supabase();
    if (sb) {
      try {
        const { data, error } = await sb.rpc("ensure_tag_code");
        if (!error && typeof data === "string" && data) return { code: data, local: false };
      } catch {}
    }
  }
  return { code: localTagCode(), local: true };
}

/** Does a scanned code belong to this user/device? */
export function tagMatches(t: string | null, profile: Profile): boolean {
  if (!t) return false;
  const code = t.trim().toLowerCase();
  if (profile.tagCode && code === profile.tagCode.toLowerCase()) return true;
  try { const local = localStorage.getItem(TAG_LOCAL); if (local && code === local.toLowerCase()) return true; } catch {}
  return false;
}

export function goUrl(code: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://uvu.app";
  return `${origin}/go?t=${code}`;
}

// ---------- home ----------
export function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1); const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
export function nearHome(lat: number, lng: number, profile: Profile): boolean {
  if (profile.homeLat == null || profile.homeLng == null) return false;
  return haversineM(lat, lng, profile.homeLat, profile.homeLng) <= HOME_RADIUS_M;
}

// ---------- once-per-local-day guards ----------
export function anchorFiredToday(kind: "home" | "tag", tz?: string): boolean {
  try { return localStorage.getItem(`${FIRED}.${kind}`) === localDate(new Date(), tz); } catch { return false; }
}
export function markAnchorFired(kind: "home" | "tag", tz?: string) {
  try { localStorage.setItem(`${FIRED}.${kind}`, localDate(new Date(), tz)); } catch {}
}

// ---------- QR (byte mode, EC level L, versions 1–5; up to 106 bytes) ----------
// A ~40-char /go URL fits in version 3 (29×29). No dependency: the whole encoder is below.
const CAP = [0, 17, 32, 53, 78, 106];          // data bytes per version at EC L
const EC_LEN = [0, 7, 10, 15, 20, 26];          // EC codewords per version at EC L (one block each)
const TOTAL = [0, 26, 44, 70, 100, 134];        // total codewords

const EXP = new Uint8Array(512); const LOG = new Uint8Array(256);
(() => { let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; })();
const gmul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

function rsEncode(data: Uint8Array, ecLen: number): Uint8Array {
  let gen = [1];
  for (let i = 0; i < ecLen; i++) { const next = new Array(gen.length + 1).fill(0); for (let j = 0; j < gen.length; j++) { next[j] ^= gen[j]; next[j + 1] ^= gmul(gen[j], EXP[i]); } gen = next; }
  const out = new Uint8Array(ecLen);
  for (const d of data) { const f = d ^ out[0]; out.copyWithin(0, 1); out[ecLen - 1] = 0; if (f) for (let j = 0; j < ecLen; j++) out[j] ^= gmul(gen[j + 1], f); }
  return out;
}

export interface QrMatrix { size: number; version: number; modules: boolean[][]; mask: number }

export function qrMatrix(text: string): QrMatrix {
  const bytes = new TextEncoder().encode(text);
  let version = 1; while (version <= 5 && bytes.length > CAP[version]) version++;
  if (version > 5) throw new Error("qr: text too long for versions 1–5");
  const size = 17 + 4 * version;
  const dataLen = TOTAL[version] - EC_LEN[version];

  // 1. bit stream: mode 0100, 8-bit count, bytes, terminator, pad to bytes, pad codewords
  const bits: number[] = [];
  const push = (v: number, n: number) => { for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1); };
  push(0b0100, 4); push(bytes.length, 8); for (const b of bytes) push(b, 8);
  push(0, Math.min(4, dataLen * 8 - bits.length)); while (bits.length % 8) bits.push(0);
  const data = new Uint8Array(dataLen);
  for (let i = 0; i < bits.length; i += 8) data[i / 8] = parseInt(bits.slice(i, i + 8).join(""), 2);
  for (let i = bits.length / 8, k = 0; i < dataLen; i++, k++) data[i] = k % 2 === 0 ? 0xec : 0x11;
  const ec = rsEncode(data, EC_LEN[version]);
  const codewords = new Uint8Array(TOTAL[version]); codewords.set(data); codewords.set(ec, dataLen);

  // 2. function patterns
  const m: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const fn: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const setF = (r: number, c: number, dark: boolean) => { if (r >= 0 && c >= 0 && r < size && c < size) { m[r][c] = dark; fn[r][c] = true; } };
  for (let i = 0; i < size; i++) { setF(6, i, i % 2 === 0); setF(i, 6, i % 2 === 0); }                  // timing
  const finder = (cr: number, cc: number) => { for (let dr = -4; dr <= 4; dr++) for (let dc = -4; dc <= 4; dc++) { const d = Math.max(Math.abs(dr), Math.abs(dc)); setF(cr + dr, cc + dc, d !== 2 && d !== 4); } };
  finder(3, 3); finder(3, size - 4); finder(size - 4, 3);
  if (version >= 2) { const a = size - 7; for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) setF(a + dr, a + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1); }   // alignment
  for (let i = 0; i < 9; i++) { setF(8, i, false); setF(i, 8, false); }                                  // reserve format areas
  for (let i = 0; i < 8; i++) { setF(8, size - 1 - i, false); setF(size - 1 - i, 8, false); }

  // 3. data placement, zigzag from the right
  let bi = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
      const c = right - j; const upward = ((right + 1) & 2) === 0; const r = upward ? size - 1 - vert : vert;
      if (!fn[r][c] && bi < codewords.length * 8) { m[r][c] = ((codewords[bi >>> 3] >>> (7 - (bi & 7))) & 1) === 1; bi++; }
    }
  }

  // 4. choose the mask with the lowest penalty
  const maskFn = (k: number, r: number, c: number) => [(r + c) % 2 === 0, r % 2 === 0, c % 3 === 0, (r + c) % 3 === 0, (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0, ((r * c) % 2) + ((r * c) % 3) === 0, (((r * c) % 2) + ((r * c) % 3)) % 2 === 0, (((r + c) % 2) + ((r * c) % 3)) % 2 === 0][k];
  const applyMask = (k: number) => { for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (!fn[r][c] && maskFn(k, r, c)) m[r][c] = !m[r][c]; };
  const drawFormat = (mask: number) => {
    const d = (1 << 3) | mask; let rem = d; for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const f = ((d << 10) | rem) ^ 0x5412; const bit = (i: number) => ((f >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) setF(i, 8, bit(i)); setF(7, 8, bit(6)); setF(8, 8, bit(7)); setF(8, 7, bit(8)); for (let i = 9; i < 15; i++) setF(8, 14 - i, bit(i));
    for (let i = 0; i < 8; i++) setF(8, size - 1 - i, bit(i)); for (let i = 8; i < 15; i++) setF(size - 15 + i, 8, bit(i)); setF(size - 8, 8, true);
  };
  const penalty = () => {
    let p = 0;
    const line = (get: (i: number) => boolean) => { let run = 1; let s = ""; for (let i = 0; i < size; i++) { s += get(i) ? "1" : "0"; if (i > 0 && get(i) === get(i - 1)) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; } for (let i = 0; (i = s.indexOf("10111010000", i)) >= 0; i++) p += 40; for (let i = 0; (i = s.indexOf("00001011101", i)) >= 0; i++) p += 40; };
    for (let i = 0; i < size; i++) { line((j) => m[i][j]); line((j) => m[j][i]); }
    for (let r = 0; r < size - 1; r++) for (let c = 0; c < size - 1; c++) { const v = m[r][c]; if (m[r][c + 1] === v && m[r + 1][c] === v && m[r + 1][c + 1] === v) p += 3; }
    let dark = 0; for (const row of m) for (const v of row) if (v) dark++;
    p += 10 * (Math.ceil(Math.abs(dark * 20 - size * size * 10) / (size * size)) - 1);
    return p;
  };
  let best = 0; let bestP = Infinity;
  for (let k = 0; k < 8; k++) { applyMask(k); drawFormat(k); const p = penalty(); if (p < bestP) { bestP = p; best = k; } applyMask(k); }
  applyMask(best); drawFormat(best);
  return { size, version, modules: m, mask: best };
}

/** Inline SVG of the QR: lime modules on Night with a 4-module quiet zone. `px` is the rendered size. */
export function qrSvg(text: string, px = 280, opts: { fg?: string; bg?: string; quiet?: number } = {}): string {
  const { fg = "#C8FF3D", bg = "#0C0D11", quiet = 4 } = opts;
  const q = qrMatrix(text); const n = q.size + quiet * 2;
  let d = "";
  for (let r = 0; r < q.size; r++) for (let c = 0; c < q.size; c++) if (q.modules[r][c]) d += `M${c + quiet} ${r + quiet}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" role="img" aria-label="QR code"><rect width="${n}" height="${n}" fill="${bg}"/><path d="${d}" fill="${fg}"/></svg>`;
}
export const qrDataUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
