"use client";

import Link from "next/link";
import { useState } from "react";
import { Footer } from "@/components/Footer";

const OUTREACH_DM = `hey — I built a 1v1 face-off platform with AI scoring + ELO ranking. Real opponents, no bots, no filters.

think your audience would find it interesting / fun to react to

it's free + no account needed: edgify.cc

would love a 30-sec reaction or play-through if you have time. happy to share the highlight clip generator I built (auto-renders TikTok-ready clips from each match)`;

const REDDIT_TITLE = "Built a 1v1 face-off platform with AI scoring and ELO matchmaking";
const REDDIT_BODY = `Tried to build the looksmaxxing version of chess.com.

- AR face scanning (runs locally in your browser)
- Real-time matches against random opponents in your ELO band
- Geometric scoring on 6 metrics (symmetry, jawline, cheekbones, proportions, eye tilt, leanness)
- Seasonal ranked ladder, season pass, achievements
- Free, no account required

Live at edgify.cc — would love feedback.`;

const TIKTOK_CAPTION = `live 1v1 face-offs scored by AI 🥀

real opponents, no bots
ranked ladder, climb to true adam
free + no account needed

→ edgify.cc

#lookmaxx #mogging #faceoff #rateme #ranked #fyp`;

const TWITTER = `Edgify — live 1v1 face-offs.

Real opponents, no bots. AI scores both faces in real-time and ranks you on a competitive ELO ladder.

No account needed.

→ edgify.cc`;

const SUBREDDITS = [
  { name: "r/looksmaxx", note: "Native audience. Lead with the comparison-slam video." },
  { name: "r/teenagers", note: "Massive audience but rule-strict. Frame it as a competitive game." },
  { name: "r/SideProject", note: "Tech-friendly, will appreciate the build. Long-form post." },
  { name: "r/Tinder", note: "Adjacent — frame as 'before you swipe, find your edge'." },
  { name: "r/InternetIsBeautiful", note: "Loves novelty webgames. Lead with the AR scan." }
];

const CREATOR_HOOKS = [
  "Mid-tier looksmaxxing TikToks (5–50k followers): they need content + a built-in hook",
  "'Reaction' creators (face/AI/tech): edgify is meta-content, easy to record over",
  "Discord servers: paste the link in face-rating / looksmaxxing servers, ungated",
  "Snapchat/IG Story creators with face-effects: invite them to compare with the radar chart"
];

export default function PromoPage() {
  const [copied, setCopied] = useState<string | null>(null);

  function copy(label: string, text: string) {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(label);
        setTimeout(() => setCopied(null), 1500);
      },
      () => {}
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 pt-10 pb-16">
      <Link
        href="/"
        className="label-xs inline-flex items-center gap-2 text-white/40 hover:text-white"
      >
        ← Back to Lobby
      </Link>

      <div className="mt-6">
        <p className="label-xs text-edge-cyan">Marketing kit · Internal</p>
        <h1 className="heading-display mt-2 text-4xl">
          Spread the <span className="brand-edge">edge</span>
        </h1>
        <p className="mt-2 text-sm text-white/55">
          Hand-rolled outreach pack. Copy-paste anything below into TikTok,
          Reddit, Discord, X, or DMs.
        </p>
      </div>

      <Section title="Step 1 — Generate the assets">
        <p className="text-sm text-white/65">
          Head to <Link href="/ads" className="text-edge-cyan hover:underline">/ads</Link>
          {" "}and grab a static image + a video clip. Best combos:
        </p>
        <ul className="mt-3 space-y-1 text-xs text-white/55">
          <li>• <span className="text-white">TikTok / Reels</span>: Hook punch video + TikTok caption below</li>
          <li>• <span className="text-white">Instagram feed</span>: Rank ladder square + IG caption</li>
          <li>• <span className="text-white">Reddit</span>: Comparison slam video + Reddit body below</li>
          <li>• <span className="text-white">X / Twitter</span>: Banner image + X copy below</li>
        </ul>
      </Section>

      <Section title="TikTok caption">
        <CopyBlock label="tiktok" text={TIKTOK_CAPTION} copied={copied} onCopy={copy} />
      </Section>

      <Section title="Reddit post">
        <p className="label-xs mb-1">Title</p>
        <CopyBlock label="reddit-title" text={REDDIT_TITLE} copied={copied} onCopy={copy} />
        <p className="label-xs mb-1 mt-3">Body</p>
        <CopyBlock label="reddit-body" text={REDDIT_BODY} copied={copied} onCopy={copy} />
        <p className="mt-3 text-xs text-white/55">Best subreddits, ranked by fit:</p>
        <ul className="mt-2 space-y-1.5">
          {SUBREDDITS.map((s) => (
            <li
              key={s.name}
              className="flex items-baseline gap-2 text-xs"
            >
              <span className="font-semibold text-edge-cyan">{s.name}</span>
              <span className="text-white/55">— {s.note}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="X / Twitter post">
        <CopyBlock label="x" text={TWITTER} copied={copied} onCopy={copy} />
      </Section>

      <Section title="Creator outreach DM">
        <p className="text-xs text-white/55">
          Personalize the first line. Send it to mid-tier looksmaxxing /
          face-rating creators (5k–50k followers — bigger creators won&apos;t
          read DMs).
        </p>
        <CopyBlock label="dm" text={OUTREACH_DM} copied={copied} onCopy={copy} />
      </Section>

      <Section title="Where to find creators">
        <ul className="space-y-2 text-xs text-white/65">
          {CREATOR_HOOKS.map((h, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-edge-cyan">→</span>
              <span>{h}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-white/55">
          Search TikTok for: <span className="font-mono text-edge-cyan">#looksmaxx</span>,
          <span className="font-mono text-edge-cyan"> #facerating</span>,
          <span className="font-mono text-edge-cyan"> #mogging</span>. Filter
          to creators with 5k–50k followers and recent (last 30d) posts.
        </p>
      </Section>

      <Section title="Step-by-step launch playbook">
        <ol className="space-y-3 text-xs text-white/65">
          <li>
            <span className="text-white">Day 1:</span> Post 3 TikToks with
            different Hook Punch headlines. Reply to every comment.
          </li>
          <li>
            <span className="text-white">Day 2:</span> One Reddit post in
            r/looksmaxx with the comparison-slam video. Don&apos;t spam other
            subreddits same day.
          </li>
          <li>
            <span className="text-white">Day 3:</span> Send the outreach DM
            to 10 creators. Pace it — not all on the same hour, looks like a
            bot.
          </li>
          <li>
            <span className="text-white">Day 4:</span> X thread with the
            banner image + a screen-recording demo. Tag 2–3 face/AI accounts.
          </li>
          <li>
            <span className="text-white">Day 7:</span> Review what worked.
            Double down on whichever channel converted best. Cut the rest.
          </li>
        </ol>
      </Section>

      <div className="mt-8 flex justify-center">
        <Link
          href="/ads"
          className="rounded-lg border border-edge-cyan/50 bg-edge-cyan/15 px-6 py-3 text-xs font-semibold uppercase tracking-[0.22em] text-white transition hover:bg-edge-cyan/25"
        >
          Generate assets at /ads →
        </Link>
      </div>

      <Footer />
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="label-xs mb-3 text-edge-cyan">{title}</h2>
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5">
        {children}
      </div>
    </section>
  );
}

function CopyBlock({
  label,
  text,
  copied,
  onCopy
}: {
  label: string;
  text: string;
  copied: string | null;
  onCopy: (label: string, text: string) => void;
}) {
  return (
    <div className="relative">
      <pre className="whitespace-pre-wrap rounded-lg border border-white/10 bg-black/40 p-4 font-sans text-xs leading-relaxed text-white/75">
        {text}
      </pre>
      <button
        onClick={() => onCopy(label, text)}
        className="absolute right-3 top-3 rounded-md border border-white/10 bg-white/[0.06] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/65 transition hover:border-edge-cyan/40 hover:text-edge-cyan"
      >
        {copied === label ? "Copied ✓" : "Copy"}
      </button>
    </div>
  );
}
