"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { clsx } from "clsx";
import { api, ApiError } from "@/lib/client/api";
import { Button, Notice } from "./ui";

const REASONS = [
  { id: "nudity", label: "Nudity or sexual content" },
  { id: "harassment", label: "Harassment or hate" },
  { id: "underage", label: "Looks under 18" },
  { id: "cheating", label: "Cheating (photo, screen, filter)" },
  { id: "other", label: "Something else" }
] as const;

/**
 * Bottom sheet on phones, centred dialog on desktop. Reports a player and
 * optionally blocks them. Pass matchId when reporting someone you played
 * (it makes the report count), and `live` while that match is in progress.
 */
export function ReportSheet({
  open,
  username,
  matchId,
  live,
  onClose,
  onDone
}: {
  open: boolean;
  username: string;
  matchId?: string;
  live?: boolean;
  onClose: () => void;
  onDone?: (r: { blocked: boolean; matchCancelled: boolean; note: string | null }) => void;
}) {
  const [doneNote, setDoneNote] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [alsoBlock, setAlsoBlock] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (open) {
      setReason(null);
      setNote("");
      setAlsoBlock(true);
      setError(null);
      setSent(false);
      setDoneNote(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function submit() {
    if (!reason) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ matchCancelled?: boolean; note?: string }>("/api/report", {
        body: { username, reason, note, matchId, alsoBlock }
      });
      setSent(true);
      setDoneNote(r.note ?? null);
      onDone?.({ blocked: alsoBlock, matchCancelled: !!r.matchCancelled, note: r.note ?? null });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't send the report. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 backdrop-blur-sm sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`Report ${username}`}
            className="w-full max-w-[440px] rounded-t-[28px] bg-white p-6 shadow-lift sm:rounded-[28px]"
            style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
          >
            {sent ? (
              <div className="py-4 text-center">
                <p className="text-[20px] font-semibold tracking-tight">Thanks — report sent.</p>
                <p className="mt-1.5 text-[15px] text-ink-3">
                  {alsoBlock ? `You won't be matched with ${username} again.` : "We'll take a look."}
                </p>
                {doneNote && <p className="mt-3 text-[14px] text-warn">{doneNote}</p>}
                <Button className="mt-6 w-full" onClick={onClose}>
                  Done
                </Button>
              </div>
            ) : (
              <>
                <p className="text-[20px] font-semibold tracking-tight">Report {username}</p>
                <p className="mt-1 text-[14px] text-ink-3">
                  {live ? "Reporting ends this match right away, with no ELO lost." : "What's going on?"}
                </p>
                <div className="mt-5 flex flex-col gap-2">
                  {REASONS.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setReason(r.id)}
                      className={clsx(
                        "flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-[15px] transition-colors",
                        reason === r.id ? "border-accent bg-accent-soft text-accent-ink" : "border-line hover:bg-fill"
                      )}
                    >
                      {r.label}
                      <span
                        className={clsx(
                          "h-5 w-5 rounded-full border-2",
                          reason === r.id ? "border-accent bg-accent shadow-[inset_0_0_0_3px_#fff]" : "border-line"
                        )}
                      />
                    </button>
                  ))}
                </div>
                {reason === "other" && (
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={500}
                    rows={3}
                    placeholder="Tell us more (optional)"
                    className="mt-3 w-full resize-none rounded-2xl border border-line px-4 py-3 text-[15px] focus:border-accent focus:shadow-ring focus:outline-none"
                  />
                )}
                <label className="mt-4 flex cursor-pointer items-center gap-3 text-[15px]">
                  <input
                    type="checkbox"
                    checked={alsoBlock}
                    onChange={(e) => setAlsoBlock(e.target.checked)}
                    className="h-[18px] w-[18px] accent-[#0071e3]"
                  />
                  Also block {username}
                </label>
                {error && (
                  <div className="mt-4">
                    <Notice tone="error">{error}</Notice>
                  </div>
                )}
                <div className="mt-6 flex gap-3">
                  <Button variant="plain" className="flex-1" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button variant="danger" className="flex-1" onClick={submit} loading={busy} disabled={!reason}>
                    Report
                  </Button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
