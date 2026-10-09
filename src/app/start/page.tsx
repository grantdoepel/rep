"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import type { Environment, GoalTier } from "@/lib/types";
import { Icon, Mascot } from "@/components/ui";
import { supabaseEnabled, sync } from "@/lib/supabase";

const OPT = (on: boolean) => `text-left rounded-[18px] border-[1.5px] px-[18px] flex items-center justify-between w-full ${on ? "border-lime bg-lime/8" : "border-ink-4 bg-ink-3"}`;

export default function Start() {
  const s = useStore();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [freq, setFreq] = useState("some");
  const [hard, setHard] = useState<string[]>(["time", "consistent"]);
  const [goal, setGoal] = useState<GoalTier>("regular");
  const [env, setEnv] = useState<Environment>("home");
  const [pl, setPl] = useState({ pushups: 6, squats: 12, plank: 20 });
  const [plI, setPlI] = useState(0);
  const [why, setWhy] = useState("");
  const [who, setWho] = useState("Future me");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<{ id: string; email?: string; name?: string } | null>(null);
  useEffect(() => { if (s.hydrated && s.onboarded) router.replace("/"); }, [s.hydrated, s.onboarded, router]);

  // Onboarding answers survive the OAuth / magic-link round trip (the page fully reloads on return).
  const DRAFT = "rep.onboarding";
  useEffect(() => {
    try { const d = JSON.parse(localStorage.getItem(DRAFT) ?? "null"); if (d) { setStep(d.step ?? 0); setFreq(d.freq ?? "some"); setHard(d.hard ?? ["time", "consistent"]); setGoal(d.goal ?? "regular"); setEnv(d.env ?? "home"); setPl(d.pl ?? { pushups: 6, squats: 12, plank: 20 }); setPlI(d.plI ?? 0); setWhy(d.why ?? ""); setWho(d.who ?? "Future me"); } } catch {}
    setReady(true);
  }, []);
  useEffect(() => { if (!ready) return; try { localStorage.setItem(DRAFT, JSON.stringify({ step, freq, hard, goal, env, pl, plI, why, who })); } catch {} }, [ready, step, freq, hard, goal, env, pl, plI, why, who]);

  const finish = (u = user) => {
    const name = u?.name?.trim() || u?.email?.split("@")[0] || "You";
    s.completeOnboarding({ goalTier: goal, environment: env, whyText: why || undefined, whyWho: who, displayName: name, username: (u?.email?.split("@")[0] ?? "you").toLowerCase().replace(/[^a-z0-9_]/g, "") || "you" }, pl);
    try { localStorage.removeItem(DRAFT); } catch {}
    router.replace("/");
  };

  // Already signed in (e.g. just came back from Google): show it, and if the answers were all in, finish without asking again.
  useEffect(() => {
    if (!ready || !supabaseEnabled) return;
    let alive = true;
    sync.currentUser().then((u) => { if (!alive || !u) return; setUser(u); if (step === 5 && s.hydrated && !s.onboarded) finish(u); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, step, s.hydrated]);
  const Progress = () => <div className="flex gap-1.5">{[0, 1, 2, 3, 4, 5].map((k) => <div key={k} className="w-6 h-1 rounded-full" style={{ background: k <= step ? "#C8FF3D" : "#2A2D38" }} />)}</div>;
  const H = ({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) => <><div className="text-[12px] font-bold text-muted tracking-[1.5px] uppercase">{eyebrow}</div><div className="display text-[36px] mt-2.5 leading-[1.05]">{title}</div>{sub && <div className="text-[14px] text-muted mt-2.5 leading-[1.45]">{sub}</div>}</>;
  const Next = ({ label = "Continue", onClick }: { label?: string; onClick?: () => void }) => <button onClick={onClick ?? (() => setStep(step + 1))} className="mt-auto mb-8 h-[58px] rounded-2xl bg-lime text-ink font-extrabold text-[17px] w-full">{label}</button>;
  const plMoves = [{ k: "pushups", name: "Push-ups, any kind", unit: "reps", hint: "Wall, knee, or full. Whatever you've got." }, { k: "squats", name: "Squats", unit: "reps", hint: "To a chair if you like." }, { k: "plank", name: "Plank hold", unit: "seconds", hint: "Forearms down. Stop when it stops being a plank." }] as const;

  if (!ready) return <div className="screen" />;
  return (
    <div className="screen px-6 safe-top pt-10">
      <div className="flex items-center justify-between"><div className="display text-[22px]">uvu<span className="text-lime">.</span></div><Progress /></div>

      {step === 0 && <div className="a-rise flex flex-col flex-1 pt-10">
        <H eyebrow="1 of 3 · no account needed yet" title="How often do you move right now?" sub="Honest answer. There's no wrong one and nobody sees it." />
        <div className="flex flex-col gap-2.5 mt-7">
          {[["never", "Basically never", "And I've quit apps before"], ["some", "Sometimes", "A good week has two or three"], ["most", "Most days", "I just want it to stick"]].map(([k, a, b]) => (
            <button key={k} onClick={() => setFreq(k)} className={`${OPT(freq === k)} h-16`}><span><span className="font-bold text-[16px] block">{a}</span><span className="text-[12px] text-muted">{b}</span></span><span className={`w-6 h-6 rounded-full flex items-center justify-center ${freq === k ? "bg-lime" : "border-2 border-ink-4"}`}>{freq === k && <Icon.Check size={14} />}</span></button>
          ))}
        </div><Next />
      </div>}

      {step === 1 && <div className="a-rise flex flex-col flex-1 pt-10">
        <H eyebrow="2 of 3" title="What usually gets in the way?" sub="Pick as many as apply. This sets how the mascot talks to you." />
        <div className="grid grid-cols-2 gap-2.5 mt-7">
          {[["time", "Finding time"], ["consistent", "Staying consistent"], ["know", "Knowing what to do"], ["gym", "Gyms intimidate me"]].map(([k, a]) => (
            <button key={k} onClick={() => setHard(hard.includes(k) ? hard.filter((x) => x !== k) : [...hard, k])} className={`${OPT(hard.includes(k))} h-[92px] p-3.5 flex-col items-start justify-between`}><span className={`w-5 h-5 rounded-full ${hard.includes(k) ? "bg-lime" : "border-2 border-ink-4"}`} /><span className="font-bold text-[14px]">{a}</span></button>
          ))}
        </div><Next />
      </div>}

      {step === 2 && <div className="a-rise flex flex-col flex-1 pt-10">
        <H eyebrow="3 of 3" title="How much per day?" sub="Smaller is better. You can raise it any time." />
        <div className="flex flex-col gap-2.5 mt-6">
          {([["casual", "Casual", "5 min"], ["regular", "Regular", "10 min · most popular"], ["serious", "Serious", "15 min"]] as const).map(([k, a, b]) => (
            <button key={k} onClick={() => setGoal(k)} className={`${OPT(goal === k)} h-[60px]`}><span className="font-bold text-[16px]">{a}</span><span className={`text-[13px] font-semibold ${goal === k ? "text-lime" : "text-muted"}`}>{b}</span></button>
          ))}
        </div>
        <div className="text-[12px] font-bold text-muted tracking-[1.5px] uppercase mt-6">Where will you mostly train?</div>
        <div className="flex bg-ink-3 rounded-full p-1 mt-2.5">{(["home", "gym", "travel"] as const).map((k) => <button key={k} onClick={() => setEnv(k)} className={`flex-1 h-10 rounded-full font-bold text-[13px] capitalize ${env === k ? "bg-lime text-ink" : "text-muted"}`}>{k}</button>)}</div>
        <Next label="Find my starting level" />
      </div>}

      {step === 3 && <div className="a-rise flex flex-col flex-1 pt-10">
        <H eyebrow={`Placement · move ${plI + 1} of 3`} title={plMoves[plI].name} sub={plMoves[plI].hint} />
        <div className="mx-auto mt-8 relative w-[200px] h-[200px] flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-2 border-lime a-ring" /><div className="absolute inset-5 rounded-full bg-ink-3" />
          <div className="relative text-center"><div className="display text-[56px]">{pl[plMoves[plI].k]}</div><div className="text-[13px] text-muted font-semibold mt-1">{plMoves[plI].unit}</div></div>
        </div>
        <div className="flex justify-center gap-4 mt-6">
          <button onClick={() => setPl({ ...pl, [plMoves[plI].k]: Math.max(0, pl[plMoves[plI].k] - (plMoves[plI].unit === "seconds" ? 5 : 1)) })} className="w-14 h-14 rounded-full bg-ink-4 text-[28px]">−</button>
          <button onClick={() => setPl({ ...pl, [plMoves[plI].k]: pl[plMoves[plI].k] + (plMoves[plI].unit === "seconds" ? 5 : 1) })} className="w-14 h-14 rounded-full bg-lime text-ink text-[28px]">+</button>
        </div>
        <div className="text-[13px] text-muted mt-5 text-center leading-[1.4]">Do it, then tap in what you got. It sets a starting crown per track. It'll be easy. That's the point.</div>
        <Next label={plI < 2 ? "Next move" : "See my starting level"} onClick={() => (plI < 2 ? setPlI(plI + 1) : setStep(4))} />
      </div>}

      {step === 4 && <div className="a-rise flex flex-col flex-1 pt-10">
        <H eyebrow="One more · optional" title="Who are you doing this for?" sub="Not a goal. A person, or a version of you. The mascot brings it up exactly twice: day 30 and day 100. Nobody else sees it." />
        <div className="flex flex-wrap gap-2 mt-6">{["My kids", "Future me", "My partner", "A parent who couldn't", "Someone else"].map((w) => <button key={w} onClick={() => setWho(w)} className={`h-10 px-3.5 rounded-full border-[1.5px] font-bold text-[13px] ${who === w ? "border-lime bg-lime/8" : "border-ink-4 bg-ink-3"}`}>{w}</button>)}</div>
        <label htmlFor="why" className="text-[12px] font-bold text-muted tracking-[1px] uppercase mt-6 block">In your words (optional)</label>
        <input id="why" value={why} onChange={(e) => setWhy(e.target.value)} placeholder="e.g. so I can carry Eli up the stairs at 50" className="mt-2 w-full h-14 rounded-2xl border-[1.5px] border-ink-4 bg-ink-3 px-4 text-[15px] outline-none focus:border-lime" />
        <Next label="Save and continue" />
      </div>}

      {step === 5 && <div className="a-rise flex flex-col flex-1 pt-8">
        <div className="text-[12px] font-bold text-lime tracking-[1.5px] uppercase">Day 1 · +60 XP earned</div>
        <div className="display text-[36px] mt-2.5 leading-[1.05]">That's day one.<br />Tomorrow, beat it.</div>
        <div className="grid grid-cols-3 gap-2 mt-5">
          {[["Push", pl.pushups >= 8 ? 3 : pl.pushups >= 5 ? 2 : 1], ["Legs", pl.squats >= 15 ? 3 : pl.squats >= 10 ? 2 : 1], ["Core", pl.plank >= 30 ? 3 : pl.plank >= 20 ? 2 : 1]].map(([t, l]) => <div key={t} className="bg-ink-3 rounded-[14px] p-3"><div className="text-[11px] text-muted font-bold">{t}</div><div className="display text-[22px] mt-0.5">Crown {l}</div></div>)}
        </div>
        <div className="mt-3.5"><Mascot line="Save this so I can bother you tomorrow. Respectfully." /></div>
        {supabaseEnabled && user ? (
          <div className="mt-5 flex items-center gap-3 bg-ink-3 rounded-2xl px-4 py-3.5"><span className="w-6 h-6 rounded-full bg-lime flex items-center justify-center"><Icon.Check size={14} /></span><div className="text-[14px]"><span className="font-bold">Signed in</span><span className="text-muted"> as {user.email ?? user.name}</span></div></div>
        ) : supabaseEnabled ? (
          <div className="mt-5 flex flex-col gap-2.5">
            <button onClick={() => sync.signInWithOAuth("apple")} className="h-[54px] rounded-2xl bg-text text-ink font-bold text-[15px]">Continue with Apple</button>
            <button onClick={() => sync.signInWithOAuth("google")} className="h-[54px] rounded-2xl border-[1.5px] border-ink-4 font-bold text-[15px]">Continue with Google</button>
            {!sent ? <div className="flex gap-2"><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="or email" className="flex-1 h-12 rounded-xl bg-ink-3 border-[1.5px] border-ink-4 px-4 text-[14px] outline-none" /><button onClick={async () => { const r = await sync.signInWithEmail(email); if (r.ok) setSent(true); }} className="h-12 px-4 rounded-xl bg-ink-3 font-bold text-[14px]">Send link</button></div> : <div className="text-[13px] text-lime font-semibold">Check your email for the sign-in link.</div>}
          </div>
        ) : (
          <div className="mt-5 text-[13px] text-muted bg-ink-2 rounded-xl px-3.5 py-3 leading-[1.4]">Accounts arrive with the backend. For now your progress lives on this device.</div>
        )}
        <button onClick={() => finish()} className="mt-auto mb-8 h-[58px] rounded-2xl bg-lime text-ink font-extrabold text-[17px] w-full">Start · you vs. you</button>
      </div>}
    </div>
  );
}
