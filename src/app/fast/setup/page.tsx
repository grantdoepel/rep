"use client";
import { useMemo, useState } from "react";
import { useNow } from "@/lib/useNow";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { localDate } from "@/lib/rules";
import { track } from "@/lib/analytics";
import { generatePlan, planSummary, screen, windowLabel, KIND_LABEL, type FastingInputs, type Screening, type TrainingDay } from "@/lib/fasting";
import { Button, TopBar } from "@/components/ui";
import { MiniDial } from "@/components/fuel/FuelDial";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) { return <label htmlFor={htmlFor} className="t-micro text-muted block mb-2">{children}</label>; }
const field = "w-full bg-ink-3 rounded-2xl px-4 h-12 t-body text-text border border-transparent focus:border-lime outline-none";

export default function FuelSetup() {
  const s = useStore();
  const router = useRouter();
  const existing = s.fuel?.inputs;
  const now = useNow(60000);
  const today = now ? localDate(now, s.profile.timezone) : "";

  const [weight, setWeight] = useState(existing ? String(existing.weightLb) : "");
  const [ft, setFt] = useState(existing ? String(Math.floor(existing.heightIn / 12)) : "");
  const [inch, setInch] = useState(existing ? String(existing.heightIn % 12) : "");
  const [birthYear, setBirthYear] = useState(String(existing?.birthYear ?? s.profile.birthYear ?? ""));
  const [sex, setSex] = useState<"m" | "f">(existing?.sex ?? s.profile.sex ?? "m");
  const [goal, setGoal] = useState(existing ? String(existing.goalLb) : "");
  const [goalDate, setGoalDate] = useState(existing?.goalDate ?? "");
  const [amTime, setAmTime] = useState(existing?.amTime ?? "06:00");
  const [pmTime, setPmTime] = useState(existing?.pmTime ?? "18:30");
  const [pmMinutes, setPmMinutes] = useState(String(existing?.pmMinutes ?? 60));
  const [pmLabel, setPmLabel] = useState(existing?.pmLabel ?? "Conditioning");
  const [week, setWeek] = useState<TrainingDay[]>(existing?.week ?? DAYS.map((_, i) => ({ am: i !== 0, pm: false })));
  const [scr, setScr] = useState<Screening>({ pregnant: false, edHistory: false, diabetesMeds: false, underCare: false });

  const inputs: FastingInputs | null = useMemo(() => {
    const w = Number(weight), h = Number(ft) * 12 + Number(inch || 0), by = Number(birthYear), g = Number(goal);
    if (!(w > 80 && w < 700 && h > 48 && h < 96 && by > 1900 && g > 70 && goalDate && today)) return null;
    return { weightLb: w, heightIn: h, birthYear: by, sex, goalLb: g, goalDate, amTime, pmTime, pmMinutes: Math.max(15, Math.min(180, Number(pmMinutes) || 60)), pmLabel: pmLabel.trim() || "Evening session", week, startedOn: existing?.startedOn ?? today };
  }, [weight, ft, inch, birthYear, sex, goal, goalDate, amTime, pmTime, pmMinutes, pmLabel, week, today, existing?.startedOn]);

  const refusal = screen(scr);
  const result = inputs && !refusal ? generatePlan(inputs, today) : null;
  const plan = result && !("ok" in result) ? result : null;

  const save = () => {
    if (!inputs || !plan) return;
    s.patch((x) => ({ fuel: { inputs: existing ? { ...inputs, startedOn: existing.startedOn } : inputs, plan, log: x.fuel?.log ?? { fasts: [], protein: [], weights: {} }, meals: x.fuel?.meals ?? [] }, toast: existing ? "Plan updated." : "Your Fuel plan is set." }));
    if (!s.profile.birthYear || !s.profile.sex) s.patchProfile({ birthYear: inputs.birthYear, sex: inputs.sex });
    track(existing ? "fuel_plan_updated" : "fuel_plan_created", { rate: plan.ratePerWeek, capped: plan.capped, days_pm: inputs.week.filter((d) => d.pm).length, days_am: inputs.week.filter((d) => d.am).length });
    router.push("/fast");
  };

  const toggle = (i: number, k: "am" | "pm") => setWeek((w) => w.map((d, j) => (j === i ? { ...d, [k]: !d[k] } : d)));

  return (
    <div className="screen pb-10">
      <TopBar title="Fuel plan" back={existing ? "/fast" : "/"} />
      <div className="px-6 pt-4">
        <h1 className="display t-h1">{existing ? "Adjust your plan" : "Build your fasting plan"}</h1>
        <p className="t-body text-muted mt-2">Fuel builds your eating windows around your training, with limits that protect muscle. It takes a minute.</p>
      </div>

      <section className="hairline mx-6 mt-6 pt-5 grid gap-4">
        <div className="t-micro text-muted">You</div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label htmlFor="f-w">Weight (lb)</Label><input id="f-w" className={field} inputMode="decimal" type="number" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="186" /></div>
          <div><Label htmlFor="f-ft">Height</Label><div className="flex gap-2"><input id="f-ft" aria-label="Feet" className={field} type="number" inputMode="numeric" value={ft} onChange={(e) => setFt(e.target.value)} placeholder="5 ft" /><input id="f-in" aria-label="Inches" className={field} type="number" inputMode="numeric" value={inch} onChange={(e) => setInch(e.target.value)} placeholder="7 in" /></div></div>
          <div><Label htmlFor="f-by">Birth year</Label><input id="f-by" className={field} type="number" inputMode="numeric" value={birthYear} onChange={(e) => setBirthYear(e.target.value)} placeholder="1987" /></div>
          <div><Label>Sex</Label><div className="grid grid-cols-2 gap-2">{(["m", "f"] as const).map((v) => <button key={v} type="button" onClick={() => setSex(v)} aria-pressed={sex === v} className={`press h-12 rounded-2xl font-bold ${sex === v ? "bg-lime text-ink" : "bg-ink-3 text-muted"}`}>{v === "m" ? "Male" : "Female"}</button>)}</div></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label htmlFor="f-g">Goal weight (lb)</Label><input id="f-g" className={field} type="number" inputMode="decimal" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="165" /></div>
          <div><Label htmlFor="f-gd">By</Label><input id="f-gd" className={field} type="date" value={goalDate} min={today} onChange={(e) => setGoalDate(e.target.value)} /></div>
        </div>
      </section>

      <section className="hairline mx-6 mt-6 pt-5 grid gap-4">
        <div className="t-micro text-muted">Your training week</div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label htmlFor="f-am">Morning session at</Label><input id="f-am" className={field} type="time" value={amTime} onChange={(e) => setAmTime(e.target.value)} /></div>
          <div><Label htmlFor="f-pml">Evening session</Label><input id="f-pml" className={field} value={pmLabel} onChange={(e) => setPmLabel(e.target.value)} placeholder="Hyrox" /></div>
          <div><Label htmlFor="f-pm">Evening starts</Label><input id="f-pm" className={field} type="time" value={pmTime} onChange={(e) => setPmTime(e.target.value)} /></div>
          <div><Label htmlFor="f-pmm">Minutes</Label><input id="f-pmm" className={field} type="number" inputMode="numeric" value={pmMinutes} onChange={(e) => setPmMinutes(e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-[48px_1fr_1fr] gap-2 items-center" role="group" aria-label="Training days">
          <span /><span className="t-micro text-muted text-center">Morning</span><span className="t-micro text-muted text-center">{pmLabel || "Evening"}</span>
          {DAYS.map((d, i) => (
            <div key={d} className="contents">
              <span className="font-bold">{d}</span>
              <button type="button" onClick={() => toggle(i, "am")} aria-pressed={week[i].am} aria-label={`${d} morning`} className={`press h-11 rounded-xl font-bold ${week[i].am ? "bg-text text-ink" : "bg-ink-3 text-muted-2"}`}>{week[i].am ? "Train" : "–"}</button>
              <button type="button" onClick={() => toggle(i, "pm")} aria-pressed={week[i].pm} aria-label={`${d} evening`} className={`press h-11 rounded-xl font-bold ${week[i].pm ? "bg-amber text-ink" : "bg-ink-3 text-muted-2"}`}>{week[i].pm ? "Train" : "–"}</button>
            </div>
          ))}
        </div>
      </section>

      <section className="hairline mx-6 mt-6 pt-5 grid gap-3">
        <div className="t-micro text-muted">Before you fast</div>
        <p className="t-small text-muted">Check any that apply. They change what&apos;s safe for you.</p>
        {([["pregnant", "I'm pregnant or breastfeeding"], ["edHistory", "I have a history of disordered eating"], ["diabetesMeds", "I take insulin or blood-sugar medication"], ["underCare", "I'm being treated for another medical condition"]] as const).map(([k, label]) => (
          <label key={k} className="flex items-center gap-3 min-h-[44px] cursor-pointer">
            <input type="checkbox" checked={scr[k]} onChange={(e) => setScr((x) => ({ ...x, [k]: e.target.checked }))} className="w-5 h-5 accent-[#C8FF3D]" />
            <span className="t-body text-text-2">{label}</span>
          </label>
        ))}
      </section>

      <section className="mx-6 mt-6">
        {refusal ? (
          <div className="rounded-[22px] bg-ink-3 p-5"><div className="display t-h3">Let&apos;s not build this one</div><p className="t-body text-text-2 mt-2">{refusal.reason}</p></div>
        ) : !inputs ? (
          <p className="t-small text-muted">Fill in your stats and goal to see the plan.</p>
        ) : result && "ok" in result ? (
          <div className="rounded-[22px] bg-ink-3 p-5"><div className="display t-h3">Adjust the goal</div><p className="t-body text-text-2 mt-2">{result.reason}</p></div>
        ) : plan ? (
          <div className="grid gap-3">
            <div className="rounded-[22px] bg-ink-3 p-5">
              <div className="t-micro text-lime">Your plan</div>
              <p className="t-body text-text mt-2">{planSummary(inputs, plan)}</p>
              <p className="t-small text-muted mt-2">{plan.protein} g protein every day. Calories never drop below your resting burn of {plan.bmr.toLocaleString()}.</p>
              {scr.underCare && <p className="t-small text-amber mt-2">Run this plan by your doctor before you start.</p>}
            </div>
            <div className="grid gap-2">
              {[1, 2, 3, 4, 5, 6, 0].map((dow) => { const d = plan.days[dow]; return (
                <div key={dow} className="flex items-center gap-3 rounded-2xl bg-ink-2 px-3 py-2.5">
                  <MiniDial day={d} size={40} marks={{ am: inputs.week[dow].am ? Number(amTime.split(":")[0]) + Number(amTime.split(":")[1]) / 60 : undefined, pm: inputs.week[dow].pm ? Number(pmTime.split(":")[0]) + Number(pmTime.split(":")[1]) / 60 : undefined }} />
                  <div className="min-w-0 flex-1"><div className="font-bold">{DAYS[dow]} <span className="t-small text-muted font-semibold">· {KIND_LABEL[d.kind]}</span></div><div className="t-small text-muted">Eat {windowLabel(d)}</div></div>
                  <div className="t-num text-[15px]">{d.kcal.toLocaleString()}</div>
                </div>
              ); })}
            </div>
            <Button onClick={save} className="mt-2">{existing ? "Save changes" : "Start this plan"}</Button>
            <p className="t-small text-muted-2">Not medical advice. Fuel estimates your burn from standard formulas; the weekly check-in adjusts it to your real numbers.</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
