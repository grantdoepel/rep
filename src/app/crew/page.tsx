"use client";
// PRD 3 · Crews. One crew, up to six people, one shared weekly target. This is the whole surface.
import { useState } from "react";
import { useStore } from "@/lib/store";
import { dayOfWeek, localDate } from "@/lib/rules";
import { track } from "@/lib/analytics";
import { createCrew, crewDaysLeft, crewInviteUrl, crewWeekNumber, formatDoneAt, joinCrew, leaveCrew } from "@/lib/crews";
import { Account } from "@/components/Account";
import { Avatar, Button, Icon, TopBar, useMounted } from "@/components/ui";

export default function CrewPage() {
  const s = useStore();
  const mounted = useMounted();
  if (!mounted) return <div className="screen" />;
  return (
    <div className="screen">
      <TopBar title="Crew" back="/" />
      {!s.online ? <NeedsAccount /> : s.crew ? <HasCrew /> : <NoCrew />}
    </div>
  );
}

function NeedsAccount() {
  return (
    <div className="px-6 pt-6 flex flex-col gap-4">
      <div className="display t-h1">Crews need an account</div>
      <div className="t-body text-text-2">A crew is three to six people and one weekly target. The target lives on the server, so sign in first.</div>
      <Account />
    </div>
  );
}

function NoCrew() {
  const s = useStore();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const create = async () => {
    const n = name.trim(); if (!n || busy) return;
    setBusy("create"); setErr(null);
    const r = await createCrew(n);
    if (r.ok) { await s.refresh(); s.patch(() => ({ toast: `${n} is live. Send the link.` })); } else setErr(r.error);
    setBusy(null);
  };
  const join = async () => {
    const c = code.trim(); if (!c || busy) return;
    setBusy("join"); setErr(null);
    const r = await joinCrew(c, "code");
    if (r.ok) { await s.refresh(); s.patch(() => ({ toast: `You're in ${r.value}.` })); } else setErr(r.error);
    setBusy(null);
  };

  return (
    <div className="px-6 pt-6 flex flex-col gap-6">
      <div>
        <div className="display t-h1">Start a crew</div>
        <div className="t-body text-text-2 mt-2">Three to six people. One target a week: 300 XP each, pooled. Everyone keeps it or nobody does.</div>
      </div>
      <div className="flex flex-col gap-2.5">
        <label className="t-micro text-muted" htmlFor="crew-name">Name it</label>
        <input id="crew-name" value={name} onChange={(e) => setName(e.target.value.slice(0, 24))} maxLength={24} placeholder="Tuesday people" enterKeyHint="done" onKeyDown={(e) => e.key === "Enter" && create()} className="h-12 rounded-xl bg-ink-3 border-[1.5px] border-ink-4 px-3.5 text-[15px] outline-none focus:border-lime" />
        <div className="flex items-center justify-between"><span className="t-small text-muted-2">{name.trim().length}/24</span></div>
        <Button onClick={create} disabled={!name.trim() || busy !== null}>{busy === "create" ? "Starting…" : "Create"}</Button>
      </div>
      <div className="hairline pt-5 flex flex-col gap-2.5">
        <label className="t-micro text-muted" htmlFor="crew-code">Have a code?</label>
        <div className="flex gap-2">
          <input id="crew-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="8 characters" autoCapitalize="none" autoCorrect="off" spellCheck={false} enterKeyHint="go" onKeyDown={(e) => e.key === "Enter" && join()} className="flex-1 h-12 rounded-xl bg-ink-3 border-[1.5px] border-ink-4 px-3.5 text-[15px] outline-none focus:border-lime font-mono tracking-wide" />
          <button onClick={join} disabled={!code.trim() || busy !== null} className="press h-12 px-5 rounded-xl border-[1.5px] border-ink-4 font-bold text-[15px] disabled:opacity-40">{busy === "join" ? "…" : "Join"}</button>
        </div>
      </div>
      {err && <div role="alert" className="t-small text-coral">{err}</div>}
    </div>
  );
}

function HasCrew() {
  const s = useStore();
  const crew = s.crew!;
  const [leaving, setLeaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const today = localDate(new Date(), s.profile.timezone);
  const daysLeft = crewDaysLeft(dayOfWeek(today));
  const week = crewWeekNumber(crew, today);
  const pct = crew.targetXp > 0 ? Math.min(100, (crew.xp / crew.targetXp) * 100) : 0;
  const members = [...crew.members].sort((a, b) => Number(b.doneToday) - Number(a.doneToday) || Number(b.isYou ?? false) - Number(a.isYou ?? false));
  const doneCount = crew.members.filter((m) => m.doneToday).length;

  const invite = async () => {
    const url = crewInviteUrl(crew.code);
    track("invite_sent", { kind: "crew" });
    const data = { title: "uvu", text: `Join ${crew.name} on uvu. Three minutes a day, one target a week.`, url };
    if (navigator.share) { try { await navigator.share(data); } catch {} return; }
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  };
  const leave = async () => {
    if (busy) return; setBusy(true);
    const r = await leaveCrew();
    if (r.ok) { s.patch(() => ({ crew: undefined, toast: `You left ${crew.name}.` })); await s.refresh(); } else s.patch(() => ({ toast: r.error }));
    setBusy(false); setLeaving(false);
  };

  return (
    <>
      <div className="px-6 pt-5">
        <div className="flex items-end justify-between gap-3">
          <div className="display t-h1 break-words min-w-0">{crew.name}</div>
          <div className="t-small text-muted-2 font-semibold whitespace-nowrap pb-1">Week {week}</div>
        </div>
        <div className="mt-4 flex items-baseline justify-between">
          <div className="t-num text-[28px]">{crew.xp.toLocaleString()} <span className="t-small text-muted font-semibold">of {crew.targetXp.toLocaleString()}</span></div>
          {crew.kept ? <span className="t-small font-bold text-lime">kept</span> : <span className="t-small text-muted-2 font-semibold">{daysLeft} day{daysLeft === 1 ? "" : "s"} left</span>}
        </div>
        <div className="mt-2 h-2 rounded-full bg-ink-4 overflow-hidden"><div className="a-grow h-2 rounded-full bg-lime" style={{ width: `${pct}%` }} /></div>
        <div className="mt-1.5 t-small text-muted">{crew.members.length} of 6 · 300 XP each · {doneCount} done today</div>
      </div>

      <div className="hairline mx-6 mt-5 pt-4 flex flex-col">
        <div className="t-micro text-muted mb-1">Today</div>
        {members.map((m) => {
          const first = m.displayName.split(" ")[0];
          const nudged = s.nudgedToday.includes(m.id);
          return (
            <div key={m.id} className="flex items-center gap-3 py-2.5">
              <div className={`rounded-full ${m.doneToday ? "ring-2 ring-lime ring-offset-2 ring-offset-ink" : ""}`}>
                <Avatar initials={m.displayName.split(" ").map((x) => x[0]).join("").slice(0, 2).toUpperCase()} color={m.color} fg={m.isYou ? "#0C0D11" : "#F4F5F7"} size={40} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-[15px] truncate">{m.isYou ? "You" : first}{m.isCaptain && <span className="ml-1.5 t-micro text-muted-2 normal-case tracking-normal font-semibold">captain</span>}</div>
                <div className={`t-small ${m.doneToday ? "text-lime font-semibold" : "text-muted"}`}>{m.doneToday ? formatDoneAt(m.doneAt, s.profile.timezone) : "not yet"}</div>
              </div>
              <div className="flex items-center gap-1 w-12 justify-end"><Icon.Flame size={14} /><span className="t-num text-[14px]">{m.streak}</span></div>
              {!m.doneToday && !m.isYou && (
                <button onClick={() => s.nudge(m.id)} disabled={nudged} aria-label={`Nudge ${first}`} className={`press h-9 px-3.5 rounded-full border-[1.5px] text-[13px] font-bold ${nudged ? "border-transparent bg-ink-3 text-muted-2" : "border-ink-4 text-text"}`}>{nudged ? "Sent" : "Nudge"}</button>
              )}
            </div>
          );
        })}
        {crew.members.length < 6 && <div className="t-small text-muted-2 py-2">{6 - crew.members.length} more {6 - crew.members.length === 1 ? "seat" : "seats"}. Each one raises the target by 300.</div>}
      </div>

      <div className="mt-auto px-6 pt-6 pb-8 safe-bottom flex flex-col items-center gap-3">
        <Button onClick={invite}>{copied ? "Link copied" : "Invite"}</Button>
        {!leaving ? (
          <button onClick={() => setLeaving(true)} className="press h-11 px-4 t-small font-semibold text-muted">Leave {crew.name}</button>
        ) : (
          <div className="w-full flex items-center justify-between gap-3 bg-ink-3 rounded-2xl px-4 py-2.5">
            <span className="t-small text-text-2">Leave the crew? Your XP this week stays with them.</span>
            <div className="flex gap-1.5 shrink-0">
              <button onClick={leave} disabled={busy} className="press h-9 px-3 rounded-full bg-text text-ink text-[13px] font-bold disabled:opacity-40">{busy ? "…" : "Leave"}</button>
              <button onClick={() => setLeaving(false)} className="press h-9 px-3 rounded-full text-[13px] font-bold text-muted">Stay</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
