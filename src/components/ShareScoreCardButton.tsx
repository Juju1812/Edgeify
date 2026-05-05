"use client";

import { useState } from "react";
import { useUser } from "@/lib/user-context";
import { renderScoreCard } from "@/lib/score-card";
import { rankFromElo } from "@/lib/rank";

/**
 * "Share your EdgeScore card" button — drops on /profile so existing
 * users can re-share their card after the initial first-scan flow.
 */
export function ShareScoreCardButton() {
  const { user, status } = useUser();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<"shared" | "saved" | null>(null);

  if (status !== "ranked" && status !== "calibrating") return null;
  if (!user.edgeScore) return null;

  async function go() {
    if (busy) return;
    setBusy(true);
    setDone(null);
    try {
      const rank = rankFromElo(user.elo);
      const blob = await renderScoreCard({
        username: user.username || "PLAYER",
        faceDataUrl: user.faceDataUrl,
        edgeScore: user.edgeScore!,
        rankLabel: rank.label,
        rankEmoji: rank.emoji,
        rankColor: rank.color,
        elo: user.elo
      });
      if (!blob) return;
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
          text: `${(user.edgeScore!.composite | 0)} EdgeScore on Edgify · play at edgify.cc\n\n#edgify #edgescore #facetierlist #lookmaxxing`
        });
        setDone("shared");
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `edgify-score-${Date.now()}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setDone("saved");
      }
    } catch {
      /* */
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={go}
      disabled={busy}
      className="rounded-lg border border-edge-coral/50 bg-edge-coral/15 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.22em] text-white transition hover:border-edge-coral hover:bg-edge-coral/25 disabled:opacity-50"
    >
      {busy
        ? "Rendering…"
        : done === "shared"
          ? "Shared ✓"
          : done === "saved"
            ? "Saved ✓"
            : "Share my card 📲"}
    </button>
  );
}
