"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { addDays, dayOfWeek, localDate } from "@/lib/rules";
import { Avatar, Icon, Section, TabBar, useMounted } from "@/components/ui";

export default function Friends() {
  const s = useStore();
  const mounted = useMounted();
  const router = useRouter();
  const [wagerDraft, setWagerDraft] = useState("");
  const [editWager, setEditWager] = useState(false);
  if (!mounted) return <div className="screen" />;
  const today = localDate(new Date(), s.profile.timezone);
  const daysLeft = 7 - ((dayOfWeek(today) + 6) % 7);
  const moving = s.friends.filter((f) => f.movingNow);
  const duo = s.duo;
  const partner = s.friends.find((f) => f.id === duo?.partnerId);
  const you = (duo?.yourXp ?? 0), them = duo?.partnerXp ?? 0, tgt = duo?.targetXp ?? 2000;
  const yesterday = addDays(today, -1);
  const missedYesterday = !s.log.some((l) => l.date === yesterday && l.kind !== "missed") && yesterday >= s.profile.createdAt.slice(0, 10) && s.log.length > 0;
  const pendingPinky = s.pinkyPromises.find((p) => p.date === yesterday);
  const shots = s.proofShots;
  const inviteUrl = s.inviteCode ? `${location.origin}/?invite=${s.inviteCode}` : null;
  const invite = async () => {
    if (!inviteUrl) { s.acceptInvite(""); return; }
    const data = { title: "uvu", text: "You vs. you. Be my Duo on uvu.", url: inviteUrl };
    if (navigator.share) { try { await navigator.share(data); } catch {} return; }
    try { await navigator.clipboard.writeText(inviteUrl); } catch {}
  };

  return (
    <div className="screen">
      <div className="safe-top px-6 pt-8 flex items-end justify-between">
        <div><div className="t-micro text-muted">{s.friends.length ? `${s.friends.filter((f) => f.doneToday).length} of ${s.friends.length} moved today` : "You vs. you, together"}</div><div className="display t-h1 mt-1.5">Friends</div></div>
        <div className="flex items-center gap-2">
          <Link href="/crew" className="press h-11 px-4 rounded-full border-[1.5px] border-ink-4 flex items-center text-[14px] font-bold">Crew</Link>
          <button aria-label="Invite a friend" onClick={invite} className="press w-11 h-11 rounded-full bg-lime flex items-center justify-center"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0C0D11" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg></button>
        </div>
      </div>

      {/* PRD 3 · your crew, at the top; the whole block is one tap into /crew */}
      {s.crew ? (
        <Section title="Your crew" right={s.crew.kept ? <span className="t-small font-bold text-lime">kept</span> : <span className="t-small text-muted-2 font-semibold">{daysLeft}d left</span>} className="mt-1">
          <Link href="/crew" className="block press">
            <div className="flex items-center justify-between gap-3">
              <div className="font-bold text-[15px] truncate">{s.crew.name}</div>
              <div className="flex items-center">{[...s.crew.members].sort((a, b) => Number(b.isYou ?? false) - Number(a.isYou ?? false)).map((m, i) => <div key={m.id} className={`rounded-full border-2 border-ink box-border ${m.doneToday ? "ring-2 ring-lime" : ""}`} style={{ marginLeft: i ? -8 : 0 }}><Avatar initials={m.displayName.split(" ").map((x) => x[0]).join("").slice(0, 2).toUpperCase()} color={m.color} fg={m.isYou ? "#0C0D11" : "#F4F5F7"} size={28} /></div>)}</div>
            </div>
            <div className="mt-2.5 h-2 rounded-full bg-ink-4 overflow-hidden"><div className="a-grow h-2 rounded-full bg-lime" style={{ width: `${s.crew.targetXp > 0 ? Math.min(100, (s.crew.xp / s.crew.targetXp) * 100) : 0}%` }} /></div>
            <div className="mt-1.5 t-small text-muted">{s.crew.xp.toLocaleString()} of {s.crew.targetXp.toLocaleString()} {s.crew.kept ? "· kept" : "together"} · {s.crew.members.filter((m) => m.doneToday).length} of {s.crew.members.length} done today</div>
          </Link>
        </Section>
      ) : s.online ? (
        <Section title="Your crew" className="mt-1">
          <Link href="/crew" className="flex items-center justify-between press py-1">
            <span className="t-small text-muted">Three to six people, one target. Start one.</span>
            <span className="t-small font-bold text-lime pl-3 whitespace-nowrap">Start a crew</span>
          </Link>
        </Section>
      ) : null}

      {moving.length > 0 && (
        <Link href="/live" className="mx-6 mt-4 bg-lime/6 border-[1.5px] border-lime/25 rounded-2xl px-3.5 py-3 flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-lime a-blink" />
          <div className="flex">{moving.map((f, i) => <div key={f.id} className="w-[26px] h-[26px] rounded-full border-2 border-ink box-border" style={{ background: f.color, marginLeft: i ? -8 : 0 }} />)}</div>
          <div className="flex-1 text-[13px]"><span className="font-bold">{moving.map((f) => f.displayName.split(" ")[0]).join(" and ")}</span> <span className="text-muted">{moving.length === 1 ? "is" : "are"} mid-Set right now</span></div>
          <span className="text-[12px] font-bold text-lime">Join →</span>
        </Link>
      )}

      {duo && (
        <div className="mx-6 mt-4 rounded-[22px] p-[18px] border border-ink-4" style={{ background: "linear-gradient(135deg,#1A1C23,#22263A)" }}>
          <div className="flex items-center justify-between"><div className="text-[11px] font-extrabold text-lime tracking-[1.5px] uppercase">Duo Quest · this week</div><span className="text-[12px] text-muted font-semibold">{daysLeft}d left</span></div>
          <div className="flex items-center gap-3.5 mt-3.5">
            <div className="flex flex-col items-center gap-1.5"><Avatar initials={s.profile.displayName.slice(0, 2).toUpperCase()} color="#C8FF3D" fg="#0C0D11" size={52} /><span className="text-[11px] font-bold">You · {you}</span></div>
            <div className="flex-1">
              <div className="display text-[24px] text-center">{(you + them).toLocaleString()} <span className="text-[14px] text-muted font-semibold">/ {tgt.toLocaleString()}</span></div>
              <div className="mt-2 h-2.5 rounded-full bg-ink overflow-hidden flex"><div className="a-grow h-2.5 bg-lime" style={{ width: `${Math.min(100, (you / tgt) * 100)}%` }} /><div className="a-grow h-2.5 bg-blue" style={{ width: `${Math.min(100, (them / tgt) * 100)}%`, animationDelay: ".3s" }} /></div>
              <div className="text-[11px] text-muted font-semibold text-center mt-1.5">Both win 200 gems, or neither does</div>
            </div>
            <div className="flex flex-col items-center gap-1.5"><Avatar initials={(partner?.displayName ?? duo.partnerName).slice(0, 2).toUpperCase()} color={partner?.color ?? "#3D4EFF"} size={52} /><span className="text-[11px] font-bold">{duo.partnerName} · {them}</span></div>
          </div>
          <div className="mt-3.5 pt-3.5 border-t border-ink-4">
            <div className="flex items-center justify-between"><div className="text-[11px] font-bold text-muted tracking-[1px] uppercase">The wager</div><button onClick={() => { setWagerDraft(duo.wagerYou ?? ""); setEditWager(!editWager); }} className="text-[12px] font-bold text-lime">{duo.wagerYou ? "Edit" : "Set yours"}</button></div>
            {editWager ? (
              <div className="flex gap-2 mt-2"><input value={wagerDraft} onChange={(e) => setWagerDraft(e.target.value)} placeholder="If we miss, I owe…" className="flex-1 h-11 rounded-xl bg-ink border-[1.5px] border-ink-4 px-3.5 text-[14px] outline-none focus:border-lime" /><button onClick={() => { s.setWager(wagerDraft.trim()); setEditWager(false); }} className="h-11 px-4 rounded-xl bg-lime text-ink font-extrabold text-[13px]">Save</button></div>
            ) : (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="bg-ink rounded-xl px-3 py-2.5"><div className="text-[10px] font-bold text-muted">You owe</div><div className="text-[13px] font-bold mt-0.5">{duo.wagerYou ?? <span className="text-muted-2">Not set yet</span>}</div></div>
                <div className="bg-ink rounded-xl px-3 py-2.5"><div className="text-[10px] font-bold text-muted">{duo.partnerName} owes</div><div className="text-[13px] font-bold mt-0.5">{duo.wagerPartner ?? <span className="text-muted-2">Not set yet</span>}</div></div>
              </div>
            )}
            <div className="text-[11px] text-muted mt-2">Miss the quest and Monday's card says who pays. Keep it small. Keep it funny.</div>
          </div>
        </div>
      )}

      {missedYesterday && duo && (
        <div className="mx-6 mt-3.5 bg-ink-3 rounded-[18px] px-4 py-3.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-coral flex items-center justify-center shrink-0"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0C0D11" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 4a2 2 0 0 1 4 0v8M10 6a2 2 0 0 1 4 0v6M6 9a2 2 0 0 1 4 0v3M18 12v3a6 6 0 0 1-12 0v-2" /></svg></div>
            <div className="flex-1"><div className="font-bold text-[14px]">Forgot to log yesterday?</div><div className="text-[12px] text-muted">Pinky Promise: {duo.partnerName} decides if it counts. {2 - s.pinkyUsedThisMonth} left this month.</div></div>
          </div>
          {pendingPinky ? (
            <div className="mt-3 flex items-center justify-between bg-ink rounded-xl px-3.5 py-2.5 text-[13px]">
              <span className={pendingPinky.status === "vouched" ? "text-lime font-bold" : pendingPinky.status === "declined" ? "text-coral font-bold" : "text-muted font-semibold"}>{pendingPinky.status === "pending" ? `Waiting on ${pendingPinky.voucherName}…` : pendingPinky.status === "vouched" ? `${pendingPinky.voucherName} vouched. Day counted.` : `${pendingPinky.voucherName} said no. Fair.`}</span>
              {pendingPinky.status === "pending" && <div className="flex gap-1.5"><button onClick={() => s.resolvePinky(pendingPinky.id, true)} className="text-[11px] font-bold bg-lime text-ink rounded-full px-2.5 py-1">Demo: yes</button><button onClick={() => s.resolvePinky(pendingPinky.id, false)} className="text-[11px] font-bold bg-ink-4 rounded-full px-2.5 py-1">no</button></div>}
            </div>
          ) : (
            <button onClick={() => s.requestPinky(yesterday)} disabled={s.pinkyUsedThisMonth >= 2} className="mt-3 w-full h-11 rounded-xl bg-coral text-ink font-extrabold text-[14px] disabled:opacity-40">Ask {duo.partnerName} to vouch</button>
          )}
        </div>
      )}

      {shots.length > 0 && (
        <div className="px-6 pt-4">
          <div className="t-micro text-muted pb-2">Proof shots · last 24h</div>
          <div className="flex gap-2 overflow-x-auto pb-1">{shots.map((p) => <div key={p.id} className="relative shrink-0 w-[96px] aspect-[3/4] rounded-xl overflow-hidden"><img src={p.dataUrl} alt="Proof shot" className="w-full h-full object-cover" /><div className="absolute left-1.5 bottom-1.5 text-[10px] font-bold bg-ink/70 rounded-full px-2 py-0.5">You</div></div>)}</div>
        </div>
      )}

      {s.online && s.friends.length === 0 && (
        <div className="mx-6 mt-4 rounded-[22px] p-5 border-[1.5px] border-dashed border-ink-4">
          <div className="display text-[22px]">Nobody's watching yet.</div>
          <div className="text-[13px] text-muted mt-2 leading-[1.45]">uvu is better with one person who'll notice when you skip. Send your link; when they sign up you're friends, and either of you can start a Duo.</div>
          <button onClick={invite} className="mt-4 w-full h-12 rounded-2xl bg-lime text-ink font-extrabold text-[15px]">Share my invite link</button>
          {inviteUrl && <div className="text-[11px] text-muted mt-2.5 text-center break-all">{inviteUrl}</div>}
        </div>
      )}
      {!s.online && (
        <div className="mx-6 mt-4 rounded-[18px] px-4 py-3 bg-ink-3 text-[12px] text-muted leading-[1.4]">You're looking at demo friends. Sign in from Settings to see real ones and send invites.</div>
      )}

      <div className="flex flex-col gap-2 px-6 pt-4 pb-5">
        {s.friends.length > 0 && <div className="t-micro text-muted pb-0.5 pt-1">This week</div>}
        {s.friends.map((f) => {
          const nudged = s.nudgedToday.includes(f.id);
          const cheered = s.cheered.includes(f.id);
          return (
            <div key={f.id} className={`flex items-center gap-3 px-3.5 py-3 rounded-2xl bg-ink-3 ${f.atRisk && !f.doneToday ? "border-[1.5px] border-coral" : ""}`}>
              <div className="relative"><Avatar initials={f.displayName.split(" ").map((x) => x[0]).join("")} color={f.color} size={42} ring={f.movingNow} />{f.atRisk && !f.doneToday && <div className="absolute -right-0.5 -top-0.5 w-3 h-3 rounded-full bg-coral border-2 border-ink-3 a-blink" />}</div>
              <div className="flex-1"><div className="font-bold text-[14px]">{f.displayName}{f.isDuo && <span className="ml-1.5 text-[10px] text-lime font-bold bg-lime/12 px-1.5 py-0.5 rounded-full">Duo</span>}</div>
                <div className={`text-[12px] font-semibold ${f.atRisk && !f.doneToday ? "text-coral" : f.movingNow ? "text-lime" : "text-muted"}`}>{f.movingNow ? "Moving now" : f.atRisk && !f.doneToday ? `${f.streak}-day streak at risk · no Set yet` : f.doneToday ? `Done today · ${f.streak}-day streak` : `${f.streak}-day streak`}</div></div>
              {f.atRisk && !f.doneToday ? (
                <button onClick={() => s.nudge(f.id)} disabled={nudged} className={`h-[38px] px-3.5 rounded-full font-extrabold text-[13px] ${nudged ? "bg-ink-4 text-muted" : "bg-coral text-ink"}`}>{nudged ? "Sent" : "Nudge"}</button>
              ) : f.doneToday || f.movingNow ? (
                <button onClick={() => s.cheer(f.id)} aria-label={`Cheer ${f.displayName}`} className={`w-[38px] h-[38px] rounded-full flex items-center justify-center ${cheered ? "bg-lime text-ink" : "bg-ink-4 text-text"}`}><Icon.Thumb /></button>
              ) : !duo && s.online ? (
                <button onClick={() => s.setDuo(f.id)} className="h-[38px] px-3.5 rounded-full font-extrabold text-[13px] bg-ink-4">Duo</button>
              ) : (
                <div className="flex items-center gap-1"><Icon.Flame size={16} /><span className="font-extrabold text-[14px]">{f.streak}</span></div>
              )}
            </div>
          );
        })}
      </div>

      <TabBar />
    </div>
  );
}
