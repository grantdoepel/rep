"use client";
// PRD 8 · Prescribed Sets: one eyebrow line above the Set card while a plan is active.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { endPlan, pendingPlanCode, planSet, planWeek, registerPlanMoves } from "@/lib/plans";
import { generateSet, localDate } from "@/lib/rules";
import { track } from "@/lib/analytics";

export function PlanBadge(_props: Record<string, unknown>) {
  const s = useStore();
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [today, setToday] = useState<string | null>(null);
  const plan = s.plan;

  useEffect(() => { setToday(localDate(new Date(), s.profile.timezone)); }, [s.profile.timezone]);
  // a plan link opened before sign-in: finish the consent once there is a session
  useEffect(() => { const c = s.online ? pendingPlanCode() : null; if (c && !s.plan) router.replace(`/plan?c=${encodeURIComponent(c)}`); }, [s.online, s.plan, router]);
  // names and cues for custom moves render through the catalog lookup
  useEffect(() => { registerPlanMoves(plan); }, [plan]);
  // while a plan is active, today's planned Set on Home is the plan (the store builds it on Start too)
  useEffect(() => {
    if (!plan || !today || !s.today || s.today.date !== today || s.today.status === "done" || s.today.planId === plan.id) return;
    const next = planSet(plan, s.recent, today);
    if (next) s.patch(() => ({ today: next }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, today, s.today?.date, s.today?.status, s.today?.planId]);

  if (!plan || !today) return null;
  const week = planWeek(plan, today);

  const end = async () => {
    setBusy(true);
    await endPlan().catch(() => false);
    track("plan_ended", { plan_id: plan.id, week });
    s.patch((x) => {
      const t = localDate(new Date(), x.profile.timezone);
      const regen = x.today && x.today.status !== "done" ? generateSet(x.profile, x.crowns, t) : x.today;
      return { plan: undefined, today: regen, toast: `You left ${plan.clinic}'s plan.` };
    });
    s.refresh().catch(() => {});
    setBusy(false); setConfirm(false);
  };

  return (
    <div className="mx-6 mt-4 flex items-center justify-between gap-3 min-h-[28px]">
      <div className="t-micro text-muted truncate">From {plan.clinic} · week {week} of {plan.weeks}</div>
      {!confirm ? (
        <button onClick={() => setConfirm(true)} className="press t-micro text-muted-2 underline underline-offset-2 min-h-[44px] -my-2 px-2 -mr-2 shrink-0">End</button>
      ) : (
        <div className="flex items-center gap-1 shrink-0 -my-2 -mr-2">
          <span className="t-micro text-text-2">Leave the plan?</span>
          <button disabled={busy} onClick={end} className="press t-micro text-lime min-h-[44px] px-2">{busy ? "…" : "Yes"}</button>
          <button disabled={busy} onClick={() => setConfirm(false)} className="press t-micro text-muted-2 min-h-[44px] px-2">Keep</button>
        </div>
      )}
    </div>
  );
}
