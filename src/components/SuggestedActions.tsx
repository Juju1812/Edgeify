"use client";

import Link from "next/link";
import { useUser } from "@/lib/user-context";

/**
 * Context-aware "what to do next" chip row. Reads user state and
 * surfaces the most relevant next-action(s).
 */
export function SuggestedActions() {
  const { user, status } = useUser();
  if (status === "guest") return null;

  type Suggestion = { label: string; href: string; emoji: string; accent: string };
  const items: Suggestion[] = [];

  if (status === "auth-no-scan") {
    items.push({ label: "Calibrate now", href: "/lab", emoji: "🧪", accent: "edge-cyan" });
  } else if (status === "calibrating") {
    items.push({
      label: `Finish placements (${user.placementsLeft}/5)`,
      href: "/arena",
      emoji: "🎯",
      accent: "edge-cyan"
    });
  } else {
    if (user.matchHistory.length > 0 && user.matchHistory[0].won) {
      items.push({ label: "Ride the streak", href: "/arena", emoji: "🔥", accent: "edge-coral" });
    } else {
      items.push({ label: "Bounce back", href: "/arena", emoji: "💪", accent: "edge-coral" });
    }
  }

  if (user.friends.length === 0) {
    items.push({ label: "Add a friend", href: "/friends", emoji: "🤝", accent: "edge-cyan" });
  }
  if (user.edgeBoosts > 0) {
    items.push({
      label: `Use ${user.edgeBoosts}× Edge Boost`,
      href: "/arena",
      emoji: "⚡",
      accent: "edge-coral"
    });
  }
  items.push({ label: "Today's boss", href: "/daily", emoji: "👹", accent: "edge-coral" });
  items.push({ label: "Live now", href: "/live", emoji: "🟢", accent: "edge-cyan" });

  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[10px] uppercase tracking-[0.32em] text-white/35">
        Next →
      </span>
      {items.slice(0, 5).map((s) => (
        <Link
          key={s.href + s.label}
          href={s.href}
          className={
            "inline-flex items-center gap-1.5 rounded-full border bg-black/30 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] transition hover:bg-black/50 " +
            (s.accent === "edge-coral"
              ? "border-edge-coral/30 text-edge-coral hover:border-edge-coral/60"
              : "border-edge-cyan/30 text-edge-cyan hover:border-edge-cyan/60")
          }
        >
          <span className="text-base">{s.emoji}</span>
          {s.label}
        </Link>
      ))}
    </div>
  );
}
