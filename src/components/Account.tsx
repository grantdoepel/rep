"use client";
import { useEffect, useState } from "react";
import { supabaseEnabled, sync } from "@/lib/supabase";
import { useStore } from "@/lib/store";

export function Account() {
  const s = useStore();
  const [user, setUser] = useState<{ email?: string; name?: string } | null>(null);
  const [email, setEmail] = useState(""); const [sent, setSent] = useState(false);
  useEffect(() => { if (supabaseEnabled) sync.currentUser().then(setUser); }, [s.online]);
  if (!supabaseEnabled) return null;
  if (user) return <div className="bg-ink-3 rounded-[18px] px-4 py-3.5 flex items-center gap-3"><span className="w-2 h-2 rounded-full bg-lime" /><div className="text-[13px]"><span className="font-bold">Signed in</span> <span className="text-muted">as {user.email ?? user.name}</span></div></div>;
  return (
    <div className="bg-ink-3 rounded-[18px] px-4 py-3.5 flex flex-col gap-2.5">
      <div className="text-[13px] text-muted leading-[1.4]">Sign in to keep your progress, see real friends, and get reminders.</div>
      <button onClick={() => sync.signInWithOAuth("google")} className="h-11 rounded-xl border-[1.5px] border-ink-4 font-bold text-[14px]">Continue with Google</button>
      {!sent ? <div className="flex gap-2"><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="or email" className="flex-1 h-11 rounded-xl bg-ink border-[1.5px] border-ink-4 px-3.5 text-[14px] outline-none" /><button onClick={async () => { const r = await sync.signInWithEmail(email); if (r.ok) setSent(true); }} className="h-11 px-4 rounded-xl bg-ink font-bold text-[13px]">Send link</button></div> : <div className="text-[13px] text-lime font-semibold">Check your email for the sign-in link.</div>}
    </div>
  );
}
