"use client";
// PRD 8 · /plan?c=<code>: the patient's consent screen. Says who is asking, what they will see, and nothing else.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { Account } from "@/components/Account";
import { Button, Icon, TopBar } from "@/components/ui";
import { joinPlan, previewPlan, setPendingPlanCode } from "@/lib/plans";
import { track } from "@/lib/analytics";

type Preview = { clinic: string; name: string; weeks: number; days: number; moves: number };
const DEMO: Preview = { clinic: "Northside Physio", name: "Knee rehab · phase 2", weeks: 6, days: 5, moves: 3 };

const SHARED = ["The dates you do your Set", "The three moves and your numbers", "Nothing else: no location, no notes, no other Sets"];

export default function PlanJoin() {
  const s = useStore();
  const router = useRouter();
  const [code, setCode] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);
  const [demoOut, setDemoOut] = useState(false);   // ?demo=1&out=1: the signed-out screen with sample data
  const [preview, setPreview] = useState<Preview | null | "missing">(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const u = new URL(window.location.href);
    const c = (u.searchParams.get("c") ?? u.searchParams.get("plan") ?? "").trim().toLowerCase();
    setCode(c); setDemo(u.searchParams.get("demo") === "1"); setDemoOut(u.searchParams.get("out") === "1");
  }, []);

  useEffect(() => {
    if (code === null) return;
    if (demo) { setPreview(DEMO); return; }
    if (!code) { setPreview("missing"); return; }
    previewPlan(code).then((p) => setPreview(p ?? "missing"));
  }, [code, demo]);
  // remember the code across sign-in (the auth callback lands on Home)
  useEffect(() => { if (code && !demo && !s.online && preview && preview !== "missing") setPendingPlanCode(code); }, [code, demo, s.online, preview]);

  if (code === null) return <div className="screen" />;

  const clinic = preview && preview !== "missing" ? preview.clinic : "your clinic";
  const share = async () => {
    if (!code || busy) return;
    setBusy(true); setError(null);
    const r = demo ? { ok: true, clinic: DEMO.clinic, name: DEMO.name } : await joinPlan(code);
    if (!r.ok) { setBusy(false); setError(r.error === "offline" ? "Sign in first." : "That link didn't work. Ask for a new one."); return; }
    setPendingPlanCode(null);
    track("plan_joined", { code, clinic: r.clinic });
    s.patch(() => ({ toast: `You're on ${r.clinic ?? clinic}'s plan. Tomorrow's Set is theirs.` }));
    await s.refresh().catch(() => {});
    router.replace("/");
  };

  return (
    <div className="screen">
      <TopBar title="Prescribed Set" back="/" />
      <div className="px-6 pt-4 flex-1 flex flex-col">
        {demo && <div className="t-micro text-coral mb-3">Demo · nothing is saved</div>}

        {preview === "missing" ? (
          <>
            <div className="display t-h1">That link has expired.</div>
            <div className="t-body text-muted mt-3">Ask {clinic} to send a new one. Your Sets carry on as usual.</div>
            <div className="mt-auto pb-8 safe-bottom"><Button variant="secondary" onClick={() => router.replace("/")}>Back to today</Button></div>
          </>
        ) : (!s.online && !demo) || (demo && demoOut) ? (
          <>
            <div className="t-micro text-muted">Invitation</div>
            <div className="display t-h1 mt-2">Sign in to join {clinic}</div>
            <div className="t-body text-muted mt-3">A plan follows you across devices, so it needs an account. Sign in and this link will finish the job.</div>
            <div className="mt-5"><Account /></div>
            <div className="mt-auto pb-8 safe-bottom"><Link href="/" onClick={() => setPendingPlanCode(null)} className="block text-center t-small font-bold text-muted-2 min-h-[44px] leading-[44px]">No thanks</Link></div>
          </>
        ) : (
          <>
            <div className="t-micro text-lime">{preview ? `${preview.name} · ${preview.weeks} wk · ${preview.days} days a week` : "Loading"}</div>
            <div className="display t-h1 mt-2">{preview ? `${preview.clinic} wants to see your Sets.` : " "}</div>
            <div className="t-body text-muted mt-3">Say yes and their {preview?.moves ?? 3} moves become your daily Set for {preview?.weeks ?? "a few"} weeks. You can leave any time from Home.</div>

            <div className="mt-6 bg-ink-3 rounded-[22px] p-5">
              <div className="t-micro text-muted">What they will see</div>
              <ul className="mt-3 flex flex-col gap-3">
                {SHARED.map((line) => (
                  <li key={line} className="flex items-start gap-3">
                    <span className="mt-[3px] w-5 h-5 rounded-full bg-lime/12 flex items-center justify-center shrink-0"><Icon.Check size={12} color="#C8FF3D" /></span>
                    <span className="t-body font-semibold text-text-2">{line}</span>
                  </li>
                ))}
              </ul>
            </div>

            {error && <div className="t-small text-coral font-semibold mt-4">{error}</div>}

            <div className="mt-auto pt-6 pb-8 safe-bottom flex flex-col gap-2">
              <Button onClick={share} disabled={busy || !preview}>{busy ? "Joining" : "Share"}</Button>
              <Link href="/" onClick={() => setPendingPlanCode(null)} className="block text-center t-small font-bold text-muted-2 min-h-[44px] leading-[44px]">No thanks</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
