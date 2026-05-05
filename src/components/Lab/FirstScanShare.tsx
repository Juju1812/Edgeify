"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { renderScoreCard } from "@/lib/score-card";
import { rankFromElo } from "@/lib/rank";
import type { EdgeScoreBreakdown } from "@/lib/types";

/**
 * Auto-shown right after a fresh scan completes. Renders a 1080x1920
 * vertical EdgeScore card and offers Share-to-TikTok / Save / Skip.
 *
 * This is the viral on-ramp: the moment a curious visitor finishes
 * their first scan, they get a stickerable card with their score +
 * radar chart + edgify.cc footer, ready to post.
 */
export function FirstScanShare({
  edgeScore,
  faceDataUrl,
  username,
  elo,
  onClose
}: {
  edgeScore: EdgeScoreBreakdown;
  faceDataUrl: string | null;
  username: string;
  elo: number;
  onClose: () => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [shareDone, setShareDone] = useState<"shared" | "saved" | null>(null);
  const [busy, setBusy] = useState(false);
  const rank = rankFromElo(elo);

  // Render the card on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const b = await renderScoreCard({
        username,
        faceDataUrl,
        edgeScore,
        rankLabel: rank.label,
        rankEmoji: rank.emoji,
        rankColor: rank.color,
        elo
      });
      if (cancelled || !b) return;
      setBlob(b);
      const url = URL.createObjectURL(b);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function share() {
    if (busy || !blob) return;
    setBusy(true);
    try {
      const file = new File([blob], `edgify-score-${Date.now()}.png`, {
        type: "image/png"
      });
      const navAny = navigator as Navigator & {
        canShare?: (data: ShareData) => boolean;
      };
      if (navAny.canShare && navAny.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "My Edgify EdgeScore",
          text: `${edgeScore.composite | 0} EdgeScore on Edgify · play at edgify.cc\n\n#edgify #edgescore #facetierlist #lookmaxxing`
        });
        setShareDone("shared");
      } else {
        downloadBlob();
      }
    } catch {
      /* user cancelled */
    } finally {
      setBusy(false);
    }
  }

  function downloadBlob() {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `edgify-score-${Date.now()}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setShareDone("saved");
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 py-6 sm:items-center"
      >
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md" onClick={onClose} />
        <motion.div
          initial={{ y: 20, opacity: 0, scale: 0.97 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 20, opacity: 0, scale: 0.97 }}
          className="relative z-10 my-auto w-full max-w-sm"
        >
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute -right-1 -top-1 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/70 text-lg text-white/75 backdrop-blur transition hover:border-white/40 hover:text-white"
          >
            ×
          </button>
          <div className="mb-4 text-center">
            <p className="label-xs text-edge-coral">First scan complete</p>
            <h2 className="heading-display mt-1 text-3xl">
              Share your <span className="brand-edge">edge</span>
            </h2>
            <p className="mt-2 text-xs text-white/55">
              Auto-rendered card. Post it, then come back to climb.
            </p>
          </div>

          <div className="glass overflow-hidden rounded-2xl bg-black/30">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="Your EdgeScore card"
                className="block w-full"
              />
            ) : (
              <div className="aspect-[9/16] w-full animate-pulse bg-white/[0.04]" />
            )}
          </div>

          <div className="mt-4 flex flex-col gap-2">
            <button
              onClick={share}
              disabled={busy || !blob}
              className="rounded-xl border border-edge-cyan/60 bg-edge-cyan/15 px-4 py-3 text-xs font-bold uppercase tracking-[0.22em] text-white shadow-glow transition hover:border-edge-cyan hover:bg-edge-cyan/25 disabled:opacity-50"
            >
              {busy
                ? "Sharing…"
                : shareDone === "shared"
                  ? "Shared ✓"
                  : "Share to TikTok / Insta"}
            </button>
            <button
              onClick={downloadBlob}
              disabled={busy || !blob}
              className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-xs font-semibold uppercase tracking-[0.22em] text-white/65 transition hover:border-white/20 hover:text-white disabled:opacity-50"
            >
              {shareDone === "saved" ? "Saved ✓" : "Save image"}
            </button>
            <button
              onClick={onClose}
              className="text-[11px] uppercase tracking-[0.32em] text-white/45 hover:text-white/80"
            >
              ← Back to lobby
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
