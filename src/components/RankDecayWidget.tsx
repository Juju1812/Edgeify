"use client";

import { useUser } from "@/lib/user-context";

/**
 * Surface the existing inactivity-decay logic. Shows when ELO will start
 * dropping if the user doesn't play, and a "freeze" option (consume
 * Edge Boost to push the timer back another 7 days).
 */
export function RankDecayWidget() {
  const { user, status, update } = useUser();
  if (status !== "ranked") return null;
  if (!user.lastActiveAt) return null;

  const ms = Date.now() - user.lastActiveAt;
  const dayMs = 24 * 60 * 60 * 1000;
  const idleDays = Math.floor(ms / dayMs);
  const daysUntilDecay = Math.max(0, 7 - idleDays);
  const decayingNow = idleDays >= 7;
  const projectedDecay = decayingNow ? Math.min(200, (idleDays - 7 + 1) * 5) : 0;

  // Don't show this widget if there's no real risk yet (>5 days left
  // and not actively decaying). Avoids cluttering the home page with
  // a non-actionable card on the user's first day.
  if (!decayingNow && daysUntilDecay >= 6) return null;

  function freeze() {
    if (user.edgeBoosts <= 0) return;
    // Spend one Edge Boost to push lastActiveAt forward by 7 days.
    update((prev) => ({
      edgeBoosts: Math.max(0, prev.edgeBoosts - 1),
      lastActiveAt: Date.now()
    }));
  }

  return (
    <div
      className={
        "rounded-2xl border p-5 " +
        (decayingNow
          ? "border-edge-coral/40 bg-edge-coral/[0.06]"
          : "border-edge-amber/30 bg-edge-amber/[0.04]")
      }
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p
            className={
              "label-xs " +
              (decayingNow ? "text-edge-coral" : "text-edge-amber")
            }
          >
            Rank Decay {decayingNow ? "Active" : "Warning"}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-white/70">
            {decayingNow ? (
              <>
                Inactive for{" "}
                <span className="font-semibold text-white">{idleDays} days</span>
                . You&apos;ve lost{" "}
                <span className="font-semibold text-edge-coral">
                  −{projectedDecay} ELO
                </span>{" "}
                already. Play a match to stop the bleed.
              </>
            ) : (
              <>
                Decay starts in{" "}
                <span className="font-semibold text-white">
                  {daysUntilDecay} day{daysUntilDecay === 1 ? "" : "s"}
                </span>
                . Play a match before then to reset the timer.
              </>
            )}
          </p>
        </div>
        {user.edgeBoosts > 0 && (
          <button
            onClick={freeze}
            className="shrink-0 rounded-lg border border-edge-cyan/50 bg-edge-cyan/15 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-edge-cyan transition hover:border-edge-cyan hover:bg-edge-cyan/25"
            title="Spend 1 Edge Boost to freeze decay for 7 more days"
          >
            ⚡ Freeze
          </button>
        )}
      </div>
    </div>
  );
}
