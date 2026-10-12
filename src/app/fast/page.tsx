"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useNow } from "@/lib/useNow";
import { useStore } from "@/lib/store";
import { addDays, localDate, weekStart } from "@/lib/rules";
import { track } from "@/lib/analytics";
import { FAST_XP, FUEL_TIERS, KIND_LABEL, PROTEIN_XP, WEIGH_XP, checkIn, clock, dur, fastStreak, hm, hourLabel, phaseAt, targetOn, tierOf, totalXp, weekXp, windowLabel, type FastingInputs } from "@/lib/fasting";
import { dayTotals, mealKcal, mealProtein } from "@/lib/food";
import { Button, Icon, LinkButton, TopBar, haptic } from "@/components/ui";
import { FuelDial, MiniDial } from "@/components/fuel/FuelDial";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const marksFor = (i: FastingInputs, dow: number) => ({ am: i.week[dow].am ? hm(i.amTime) : undefined, pm: i.week[dow].pm ? hm(i.pmTime) : undefined });

export default function Fuel() {
  const s = useStore();
  const now = useNow();
  const [weight, setWeight] = useState("");

  const fuel = s.fuel;
  const today = now ? localDate(now, s.profile.timezone) : "";
  const totals = fuel && today ? dayTotals(fuel.meals, today) : null;
  // logged protein reaching the target earns the bonus on its own
  useEffect(() => {
    if (!fuel || !today || !totals || fuel.log.protein.includes(today) || totals.protein < fuel.plan.protein) return;
    s.patch((x) => (x.fuel ? { fuel: { ...x.fuel, log: { ...x.fuel.log, protein: [...x.fuel.log.protein, today] } }, toast: `+${PROTEIN_XP} XP · protein hit` } : {}));
    track("fuel_protein_hit", { via: "meals" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totals?.protein, today]);

  if (!s.hydrated || !now) return <div className="screen" />;
  if (!fuel) return (
    <div className="screen">
      <TopBar title="Fuel" />
      <div className="px-6 pt-6 grid gap-4">
        <h1 className="display t-h1">Eat around your training</h1>
        <p className="t-body text-text-2">Fuel builds a fasting plan from your stats and your training week: when to eat, how much, and how much protein. Snap your meals and it counts them for you.</p>
        <LinkButton href="/fast/setup">Build my plan</LinkButton>
      </div>
    </div>
  );

  const { inputs: i, plan, log } = fuel;
  const ph = phaseAt(plan, now);
  const hour = now.getHours() + now.getMinutes() / 60;
  const dow = now.getDay();
  const claimed = log.fasts.includes(today);
  const proteinDone = log.protein.includes(today);
  const streak = fastStreak(log, today);
  const xp = totalXp(log);
  const monday = weekStart(today);
  const wx = weekXp(log, monday), lx = weekXp(log, addDays(monday, -7)), ti = tierOf(wx);
  const ci = checkIn(log, i, plan, today);
  const sunday = addDays(monday, 6);

  const center = clock(ph.left);
  const sub = ph.state === "fast" ? `until your window opens at ${hourLabel(ph.day.start, false)}` : ph.state === "eat" ? "left in today's window" : `until ${DAY_NAMES[(dow + 1) % 7].slice(0, 3)}'s window at ${hourLabel(ph.next.start, false)}`;
  const pct = ph.state === "fast" ? Math.min(100, (ph.fasted / ph.fastLength) * 100) : 100;
  const qTitle = claimed ? "Fast banked." : ph.state === "fast" ? `Hold till ${hourLabel(ph.day.start, false)}.` : ph.state === "eat" ? "You held it." : "Window closed.";

  const set = (fn: (f: NonNullable<typeof s.fuel>) => Partial<NonNullable<typeof s.fuel>>, toast?: string) => s.patch((x) => (x.fuel ? { fuel: { ...x.fuel, ...fn(x.fuel) }, ...(toast ? { toast } : {}) } : {}));
  const claim = () => { if (claimed || ph.state === "fast") return; haptic([10, 40, 10]); set((f) => ({ log: { ...f.log, fasts: [...f.log.fasts, today] } }), `+${FAST_XP} XP · fast banked`); track("fuel_fast_claimed", { length_h: Math.round(ph.fastLength * 10) / 10, streak: streak + 1 }); };
  const toggleProtein = () => { set((f) => ({ log: { ...f.log, protein: proteinDone ? f.log.protein.filter((d) => d !== today) : [...f.log.protein, today] } }), proteinDone ? undefined : `+${PROTEIN_XP} XP · protein hit`); if (!proteinDone) track("fuel_protein_hit", { via: "tap" }); };
  const saveWeight = () => {
    const v = parseFloat(weight); if (!(v > 70 && v < 700)) return;
    const first = log.weights[today] === undefined;
    set((f) => ({ log: { ...f.log, weights: { ...f.log.weights, [today]: Math.round(v * 10) / 10 } } }), first ? `+${WEIGH_XP} XP · weighed in` : "Weight updated");
    track("fuel_weigh_in", { first }); setWeight("");
  };
  const removeMeal = (id: string) => set((f) => ({ meals: f.meals.filter((m) => m.id !== id) }), "Meal removed");

  const kcalPct = totals ? Math.min(100, (totals.kcal / ph.day.kcal) * 100) : 0;
  const protPct = totals ? Math.min(100, (totals.protein / plan.protein) * 100) : 0;
  const over = totals ? totals.kcal - ph.day.kcal : 0;

  return (
    <div className="screen pb-10">
      <TopBar title="Fuel" right={<Link href="/fast/setup" aria-label="Edit plan" className="press w-11 h-11 rounded-full flex items-center justify-center text-muted"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" /></svg></Link>} />

      <div className="px-6 flex items-center justify-between">
        <div className="t-micro text-muted">{DAY_NAMES[dow]} · {KIND_LABEL[ph.day.kind]}</div>
        <div className="flex gap-2">
          <div className="flex items-center gap-1.5 rounded-full py-1.5 px-3 bg-ink-3" aria-label={`Fast streak ${streak} days`}><Icon.Flame size={15} /><span className="t-num text-[14px]">{streak}</span></div>
          <div className="flex items-center gap-1.5 rounded-full py-1.5 px-3 bg-ink-3 text-lime" aria-label={`${xp} Fuel XP`}><svg width="14" height="14" viewBox="0 0 24 24" fill="#C8FF3D" aria-hidden="true"><path d="M13 2L4 14h7l-1 8 9-12h-7z" /></svg><span className="t-num text-[14px]">{xp}</span></div>
        </div>
      </div>

      <section className="flex flex-col items-center px-6 pt-2">
        <FuelDial day={ph.day} prevEnd={ph.prev.end} hour={hour} state={ph.state} center={center} sub={sub} marks={marksFor(i, dow)} size={310} />
        <div className="flex flex-wrap justify-center gap-4 t-small text-muted -mt-1">
          {i.week[dow].am && <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-text" />Train {hourLabel(hm(i.amTime))}</span>}
          {i.week[dow].pm && <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber" />{i.pmLabel} {hourLabel(hm(i.pmTime))}</span>}
          <span className="flex items-center gap-1.5"><span className="w-3.5 h-1 rounded-full bg-lime" />Eat {windowLabel(ph.day)}</span>
        </div>
      </section>

      {/* today's quest */}
      <section className="mx-6 mt-5 rounded-[26px] bg-lime text-ink p-5 grid gap-3">
        <div className="flex justify-between t-micro"><span>Today&apos;s quest</span><span>+{FAST_XP} XP</span></div>
        <div className="display t-h1">{qTitle}</div>
        <div className="h-3 rounded-full bg-ink/15 overflow-hidden"><div className="h-full rounded-full bg-ink" style={{ width: `${pct}%`, transition: "width 600ms" }} /></div>
        <div className="flex justify-between t-small font-bold"><span>{dur(ph.state === "fast" ? ph.fasted : ph.fastLength)} {ph.state === "fast" ? "fasted" : "fast"}</span><span>{ph.state === "fast" ? `${dur(ph.left)} to go` : `window ${windowLabel(ph.day)}`}</span></div>
        <Button variant="ink" disabled={claimed || ph.state === "fast"} onClick={claim}>{claimed ? `+${FAST_XP} XP earned` : ph.state === "fast" ? `Claim at ${hourLabel(ph.day.start, false)}` : "I held it · claim"}</Button>
      </section>

      {/* eaten today */}
      <section className="hairline mx-6 mt-6 pt-5">
        <div className="flex items-center justify-between mb-3"><div className="t-micro text-muted">Eaten today</div><div className="t-small text-muted">{ph.day.kcal.toLocaleString()} kcal · {plan.protein} g protein</div></div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="flex items-baseline gap-1"><span className="t-num text-[26px]">{totals?.kcal.toLocaleString() ?? 0}</span><span className="t-small text-muted">kcal</span></div>
            <div className="h-2 rounded-full bg-ink-3 mt-2 overflow-hidden"><div className={`h-full rounded-full ${over > 150 ? "bg-amber" : "bg-text"}`} style={{ width: `${kcalPct}%` }} /></div>
            <div className="t-small text-muted mt-1.5">{over > 0 ? `${over.toLocaleString()} over` : `${(-over).toLocaleString()} left`}</div>
          </div>
          <div>
            <div className="flex items-baseline gap-1"><span className="t-num text-[26px]">{totals?.protein ?? 0}</span><span className="t-small text-muted">g protein</span></div>
            <div className="h-2 rounded-full bg-ink-3 mt-2 overflow-hidden"><div className="h-full rounded-full bg-lime" style={{ width: `${protPct}%` }} /></div>
            <div className="t-small text-muted mt-1.5">{proteinDone ? "Bonus earned" : `${Math.max(0, plan.protein - (totals?.protein ?? 0))} g to go`}</div>
          </div>
        </div>
        {totals && totals.meals.length > 0 && (
          <ul className="mt-4 grid gap-2">
            {totals.meals.map((m) => (
              <li key={m.id} className="min-w-0 flex items-center gap-3 rounded-2xl bg-ink-2 p-2.5">
                {m.thumb ? <img src={m.thumb} alt="" className="w-11 h-11 rounded-xl object-cover shrink-0" /> : <div className="w-11 h-11 rounded-xl bg-ink-3 shrink-0" />}
                <div className="min-w-0 flex-1"><div className="font-semibold truncate">{m.items.map((x) => x.name).join(", ") || "Meal"}</div><div className="t-small text-muted">{new Date(m.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · {mealProtein(m)} g protein</div></div>
                <div className="t-num text-[15px]">{mealKcal(m)}</div>
                <button onClick={() => removeMeal(m.id)} aria-label="Remove meal" className="press w-11 h-11 -mr-1 rounded-full flex items-center justify-center text-muted-2"><Icon.Close size={16} /></button>
              </li>
            ))}
          </ul>
        )}
        <div className="grid grid-cols-[1fr_auto] gap-2 mt-4">
          <LinkButton href="/fast/meal"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8a2 2 0 0 1 2-2h2l2-2h6l2 2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><circle cx="12" cy="13" r="4" /></svg>Snap a meal</LinkButton>
          <Link href="/fast/meal?manual=1" className="press h-[56px] px-5 rounded-2xl border-[1.5px] border-ink-4 font-bold flex items-center">By hand</Link>
        </div>
        {!proteinDone && <button onClick={toggleProtein} className="press t-small text-muted underline underline-offset-2 min-h-[44px] mt-1">Didn&apos;t log it all? Mark protein hit (+{PROTEIN_XP})</button>}
      </section>

      {/* weigh-in */}
      <section className="hairline mx-6 mt-6 pt-5">
        <div className="flex items-center justify-between mb-3"><div className="t-micro text-muted">Weigh-in · +{WEIGH_XP} XP</div><div className="t-small text-muted">Line: {targetOn(i, plan, today).toFixed(1)} lb</div></div>
        <div className="flex gap-2">
          <input id="fuel-weight" aria-label="Today's weight in pounds" type="number" inputMode="decimal" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder={log.weights[today]?.toFixed(1) ?? i.weightLb.toFixed(1)} className="flex-1 min-w-0 bg-ink-3 rounded-2xl px-4 h-12 t-num text-[18px] outline-none border border-transparent focus:border-lime" />
          <button onClick={saveWeight} className="press h-12 px-6 rounded-2xl bg-lime text-ink font-extrabold">Save</button>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="rounded-2xl bg-ink-2 p-3"><div className="t-num text-[18px]">{ci.avg?.toFixed(1) ?? "–"}</div><div className="t-micro text-muted mt-1">7-day avg</div></div>
          <div className="rounded-2xl bg-ink-2 p-3"><div className="t-num text-[18px]">{ci.rate !== undefined ? ci.rate.toFixed(1) : "–"}</div><div className="t-micro text-muted mt-1">lb / week</div></div>
          <div className="rounded-2xl bg-ink-2 p-3"><div className="t-num text-[18px]">{targetOn(i, plan, sunday).toFixed(1)}</div><div className="t-micro text-muted mt-1">by Sunday</div></div>
        </div>
        <p className="t-small text-text-2 mt-3">{ci.line}</p>
      </section>

      {/* the you-vs-last-week league */}
      <section className="hairline mx-6 mt-6 pt-5">
        <div className="t-micro text-muted mb-3">Fuel league · you vs. last week</div>
        <div className="flex items-center gap-4">
          <svg width="52" height="52" viewBox="0 0 56 56" aria-hidden="true"><path d="M28 3l21 8v15c0 13-9 23-21 27C16 49 7 39 7 26V11z" fill={["#A0714A", "#B8C2CC", "#E3B341", "#C8FF3D"][ti]} /><path d="M20 27l6 6 11-12" fill="none" stroke="#0C0D11" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <div className="min-w-0"><div className="display t-h2">{FUEL_TIERS[ti][0]}</div><div className="t-small text-muted">{ti < 3 ? `${FUEL_TIERS[ti + 1][1] - wx} XP to ${FUEL_TIERS[ti + 1][0]}` : "Top tier this week"}</div></div>
          <div className="ml-auto text-right"><div className="t-num text-[22px]">{wx}</div><div className="t-small text-muted">last week {lx}</div></div>
        </div>
        <div className="grid grid-cols-4 gap-1.5 mt-4">{FUEL_TIERS.map(([, lo], k) => { const hi = k < 3 ? FUEL_TIERS[k + 1][1] : 350; const f = Math.max(0, Math.min(1, (wx - lo) / (hi - lo))); return <div key={k} className="h-2 rounded bg-ink-3 overflow-hidden"><div className="h-full bg-lime" style={{ width: `${f * 100}%` }} /></div>; })}</div>
        <p className="t-small text-muted mt-3">{lx === 0 ? "First week. Set the bar you'll chase next week." : wx > lx ? `Ahead of last week by ${wx - lx} XP.` : `${lx - wx + 1} XP to beat last week.`} Resets Monday.</p>
      </section>

      {/* the week */}
      <section className="hairline mx-6 mt-6 pt-5">
        <div className="t-micro text-muted mb-3">The week</div>
        <div className="grid gap-2">
          {[0, 1, 2, 3, 4, 5, 6].map((k) => { const date = addDays(monday, k); const d = (k + 1) % 7; const day = plan.days[d]; const isToday = date === today; return (
            <div key={k} className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${isToday ? "bg-ink-3 ring-1 ring-lime" : "bg-ink-2"}`}>
              <MiniDial day={day} marks={marksFor(i, d)} size={44} hour={isToday ? hour : undefined} />
              <div className="min-w-0 flex-1"><div className="font-bold flex items-center gap-2">{DAY_NAMES[d]}{log.fasts.includes(date) && <span className="w-[18px] h-[18px] rounded-full bg-lime flex items-center justify-center" aria-label="Fast held"><Icon.Check size={11} /></span>}</div><div className="t-small text-muted">Eat {windowLabel(day)} · {KIND_LABEL[day.kind]}</div></div>
              <div className="t-num text-[15px]">{day.kcal.toLocaleString()}</div>
            </div>
          ); })}
        </div>
      </section>

      <details className="hairline mx-6 mt-6 pt-5 group">
        <summary className="t-micro text-muted cursor-pointer min-h-[44px] list-none flex items-center justify-between">How the plan works<span className="text-muted-2 group-open:rotate-180 transition-transform">▾</span></summary>
        <ul className="grid gap-2.5 t-small text-text-2 mt-2">
          <li><b className="text-text">{plan.protein} g protein every day.</b> About a third per meal. It&apos;s what keeps muscle on while the scale drops.</li>
          <li><b className="text-text">Fasting hours:</b> water, black coffee, plain tea. Electrolytes on long days.</li>
          <li><b className="text-text">Morning sessions stay fasted.</b> If a heavy day feels flat, 25 g of whey beforehand is fine and keeps your streak.</li>
          {i.week.some((d) => d.pm) && <li><b className="text-text">{i.pmLabel} nights:</b> a carb-heavy meal about two hours before, protein right after. Never finish a session into a fast.</li>}
          <li><b className="text-text">The limits:</b> no faster than 1% of your weight a week, never below your resting burn of {plan.bmr.toLocaleString()} kcal, overnight fasts capped at 16 hours.</li>
          <li><b className="text-text">Photo counts are estimates.</b> Oils and sauces hide calories; check the numbers before you save.</li>
        </ul>
        <p className="t-small text-muted-2 mt-3">Not medical advice. Talk to your doctor if anything in your health history applies.</p>
      </details>
    </div>
  );
}
