"use client";
// PRD 5 · Letters from past-you: the Settings slot. Shows when the note was recorded and lets you delete it.
import { useState } from "react";
import { useStore } from "@/lib/store";
import { track } from "@/lib/analytics";
import { clearLocalNote, deleteNoteOnServer, hasNote } from "@/lib/notes";

export function NoteSettings() {
  const s = useStore();
  const [busy, setBusy] = useState(false);
  const present = hasNote(s.profile);
  const when = s.profile.noteRecordedAt ? new Date(s.profile.noteRecordedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : null;

  async function remove() {
    if (busy) return;
    setBusy(true);
    clearLocalNote();
    if (s.online && s.userId) await deleteNoteOnServer(s.userId);
    // Locally the cleared note is "", which hasNote() treats as absent; the server side is nulled by clear_note above
    // (patch_profile keeps a column on null and can't cast "" to timestamptz, so it isn't used for the delete).
    s.patch((x) => ({ profile: { ...x.profile, noteRecordedAt: "", noteText: "" }, notePlayedOn: undefined }));
    track("note_deleted");
    setBusy(false);
  }

  return (
    <div className="px-6 pt-4">
      <div className="t-micro text-muted">Your note</div>
      {present ? (
        <div className="mt-2.5 flex items-center justify-between gap-3">
          <div className="text-[14px] leading-[1.4]">
            <div className="font-semibold">{when ? `Recorded ${when}` : "Recorded"}</div>
            <div className="text-[12px] text-muted mt-0.5">{s.profile.noteText ? "Written. Shown on nights the promise is at risk." : "Ten seconds. Played on nights the promise is at risk."}</div>
          </div>
          <button onClick={remove} disabled={busy} className="press h-11 px-3 -mr-3 font-bold text-[13px] text-text-2 disabled:opacity-40 shrink-0">{busy ? "Deleting…" : "Delete"}</button>
        </div>
      ) : (
        <div className="text-[12px] text-muted mt-2.5 leading-[1.4]">You&apos;ll be offered one after a perfect Set.</div>
      )}
    </div>
  );
}
