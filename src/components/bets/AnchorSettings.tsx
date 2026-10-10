"use client";
// PRD 6 · Anchors (Settings slot). Where the daily Set gets attached: a time, coming home, or a tag.
import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { track } from "@/lib/analytics";
import { ensureTagCode, goUrl, qrDataUrl, qrSvg } from "@/lib/anchors";
import { useMounted } from "@/components/ui";

type Anchor = NonNullable<ReturnType<typeof useStore>["profile"]["anchor"]>;

const OPTIONS: { id: Anchor; title: string; desc: string }[] = [
  { id: "time", title: "At a time", desc: "The evening reminder, when you usually do it." },
  { id: "home", title: "When I get home", desc: "Pin home. When you open uvu at home in the evening, your Set is waiting." },
  { id: "tag", title: "When I tap my tag", desc: "A sticker on the fridge. Tap your phone to it and the Set starts." },
];

export function AnchorSettings(_props: Record<string, unknown>) {
  const s = useStore();
  const mounted = useMounted();
  const anchor: Anchor = s.profile.anchor ?? "time";
  const [homeStatus, setHomeStatus] = useState<string | null>(null);
  const [fetched, setFetched] = useState<{ code: string; local: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  // the tag code: the profile's server-minted one when we have it, else what ensureTagCode gave us
  const code = s.profile.tagCode ? { code: s.profile.tagCode, local: false } : fetched;

  useEffect(() => {
    if (anchor !== "tag" || !s.hydrated || s.profile.tagCode) return;
    let live = true;
    ensureTagCode(s.online).then((r) => { if (!live) return; setFetched(r); if (!r.local) s.patch((x) => ({ profile: { ...x.profile, tagCode: r.code } })); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor, s.hydrated, s.online, s.profile.tagCode]);

  const url = code ? goUrl(code.code) : null;
  const svg = useMemo(() => (url ? qrSvg(url, 280) : null), [url]);

  const choose = (kind: Anchor) => {
    if (kind === anchor) return;
    s.patchProfile({ anchor: kind });
    track("anchor_set", { kind });
  };

  const pinHome = () => {
    if (!navigator.geolocation) { setHomeStatus("No location on this device."); return; }
    setHomeStatus("Finding you…");
    navigator.geolocation.getCurrentPosition(
      (pos) => { s.patchProfile({ homeLat: pos.coords.latitude, homeLng: pos.coords.longitude }); setHomeStatus("Pinned. Open uvu here after 4pm and your Set is waiting."); },
      () => setHomeStatus("Location permission was declined."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const print = () => { if (svg) window.open(qrDataUrl(svg), "_blank", "noopener"); };
  const copy = async () => { if (!url) return; try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { setHomeStatus(null); } };

  return (
    <div className="px-6 pt-4">
      <div className="t-micro text-muted">When does your Set happen?</div>
      <div role="radiogroup" aria-label="When does your Set happen?" className="mt-2.5 flex flex-col gap-2">
        {OPTIONS.map((o) => {
          const on = mounted && anchor === o.id;
          return (
            <button key={o.id} role="radio" aria-checked={on} onClick={() => choose(o.id)} className={`press w-full text-left rounded-[18px] px-4 py-3.5 flex items-start gap-3 border-[1.5px] ${on ? "border-lime bg-lime/8" : "border-ink-4 bg-ink-3"}`}>
              <span aria-hidden="true" className={`mt-[3px] w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center ${on ? "border-lime" : "border-muted-2"}`}>{on && <span className="w-2.5 h-2.5 rounded-full bg-lime" />}</span>
              <span className="flex-1 min-w-0"><span className="block font-bold text-[15px]">{o.title}</span><span className="block text-[12px] text-muted mt-0.5 leading-[1.4]">{o.desc}</span></span>
            </button>
          );
        })}
      </div>

      {mounted && anchor === "home" && (
        <div className="mt-3 rounded-[18px] bg-ink-3 px-4 py-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0"><div className="font-bold text-[14px]">Home</div><div className="text-[12px] text-muted mt-0.5 leading-[1.4]">{homeStatus ?? (s.profile.homeLat != null ? "Pinned. Only your device keeps the coordinates." : "Stand in your doorway and tap Pin home.")}</div></div>
            <button onClick={pinHome} className="press h-11 px-4 rounded-xl bg-ink-4 font-bold text-[13px] text-lime shrink-0">{s.profile.homeLat != null ? "Re-pin" : "Pin home"}</button>
          </div>
        </div>
      )}

      {mounted && anchor === "tag" && (
        <div className="mt-3 rounded-[18px] bg-ink-3 px-4 pt-4 pb-3.5 flex flex-col items-center">
          {svg ? (
            <div className="w-[280px] h-[280px] rounded-[14px] overflow-hidden" dangerouslySetInnerHTML={{ __html: svg }} />
          ) : (
            <div className="w-[280px] h-[280px] rounded-[14px] bg-ink-4 a-blink" aria-label="Making your tag" />
          )}
          <div className="t-num text-[18px] mt-3 tracking-[0.12em] text-text">{code ? code.code : "··········"}</div>
          <div className="text-[12px] text-muted mt-1 leading-[1.4] text-center">{code?.local ? "This tag lives on this device until you sign in." : "Scan it, or write the link to an NFC sticker."}</div>
          <div className="flex gap-2 w-full mt-3">
            <button onClick={print} disabled={!svg} className="press flex-1 h-11 rounded-xl bg-ink-4 font-bold text-[13px] text-lime disabled:opacity-40">Print</button>
            <button onClick={copy} disabled={!url} className="press flex-1 h-11 rounded-xl bg-ink-4 font-bold text-[13px] text-text disabled:opacity-40">{copied ? "Copied" : "Copy link"}</button>
          </div>
          <div className="text-[12px] text-muted-2 mt-3 font-semibold">Order a lime sticker with uvu Plus — coming.</div>
        </div>
      )}
    </div>
  );
}
