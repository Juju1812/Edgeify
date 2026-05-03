"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Footer } from "@/components/Footer";
import { useUser } from "@/lib/user-context";

const CURRENT_CHANGELOG_VERSION = "0.4.0";

const ENTRIES: { version: string; date: string; title: string; bullets: string[] }[] = [
  {
    version: "0.4.0",
    date: "Latest",
    title: "Power-ups, modes, and identity",
    bullets: [
      "Season Pass: 5 power-ups (Boost, Shield, Mulligan, Time Stop, Critical Hit)",
      "Game modes: Bo3, Bo5, Sudden Death, Rapid Fire",
      "Settings page — AR mesh color, custom emojis, country flag, sound volume",
      "Public profile bio + pinned matches + country flag everywhere",
      "Career page (lifetime stats persisted across seasons)",
      "Coaching tips after a loss",
      "In-match text chat",
      "Best-take auto profile picture (highest-confidence frame)",
      "Multi-face rejection in /lab",
      "Reconnection logic in live matches",
      "Toast notifications for level-ups and achievements",
      "Tutorial flow on first sign-in"
    ]
  },
  {
    version: "0.3.0",
    date: "Earlier",
    title: "Season Pass + 11 features",
    bullets: [
      "Season Pass with Edge Boost power-up (+10% in a round)",
      "Achievements, daily streak, weekly challenges",
      "Match replay viewer + ELO progression chart",
      "Public profiles, OG share cards, streamer overlay",
      "Block list + match invitations + emoji reactions",
      "Confetti on big wins, sound effects, head-turn liveness",
      "Random matchmaking with ELO bands"
    ]
  },
  {
    version: "0.2.0",
    date: "Earlier",
    title: "Live face-offs",
    bullets: [
      "WebRTC live matchmaking with random pairing",
      "Real face mesh AR overlay during scans",
      "Tournament brackets in /private (4-player single-elim)",
      "Cross-device sign-in with KV-backed auth"
    ]
  },
  {
    version: "0.1.0",
    date: "Genesis",
    title: "First scan",
    bullets: [
      "Face calibration with EdgeScore (5 geometric metrics)",
      "Quick Match against AI bots",
      "Leaderboard scaffolding"
    ]
  }
];

export default function WhatsNewPage() {
  const { update, ready } = useUser();
  useEffect(() => {
    if (ready) update({ changelogSeenVersion: CURRENT_CHANGELOG_VERSION });
  }, [ready, update]);

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 pt-10 pb-16">
      <Link href="/" className="label-xs inline-flex items-center gap-2 text-white/40 hover:text-white">
        ← Back to Lobby
      </Link>
      <div className="mt-6">
        <p className="label-xs">Changelog</p>
        <h1 className="heading-card mt-2 text-3xl">What&apos;s New</h1>
      </div>

      <div className="mt-8 space-y-6">
        {ENTRIES.map((e, i) => (
          <article key={e.version} className={i === 0 ? "glass rounded-2xl border-mog-violet/40 p-6" : "glass rounded-2xl p-6"}>
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <span
                  className={
                    "rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.22em] " +
                    (i === 0
                      ? "bg-mog-pink/20 text-mog-pink"
                      : "bg-white/5 text-white/40")
                  }
                >
                  v{e.version}
                </span>
                <h2 className="mt-2 text-xl font-bold uppercase tracking-[0.18em] text-white">
                  {e.title}
                </h2>
              </div>
              <span className="text-[10px] uppercase tracking-[0.22em] text-white/40">
                {e.date}
              </span>
            </div>
            <ul className="mt-4 space-y-1.5 text-sm text-white/70">
              {e.bullets.map((b) => (
                <li key={b} className="flex gap-2">
                  <span className="text-mog-violet">·</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <Footer />
    </main>
  );
}
