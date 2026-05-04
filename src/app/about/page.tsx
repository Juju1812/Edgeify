import Link from "next/link";
import { Footer } from "@/components/Footer";

export const metadata = {
  title: "About — Edgify",
  description: "How Edgify scores faces and runs ranked matches."
};

export default function AboutPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 pt-10 pb-16">
      <Link
        href="/"
        className="label-xs inline-flex items-center gap-2 text-white/40 hover:text-white"
      >
        ← Back to Lobby
      </Link>

      <div className="mt-6">
        <p className="label-xs text-edge-cyan">About</p>
        <h1 className="heading-display mt-2 text-5xl">
          What is <span className="brand-edge">Edgify</span>?
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-white/65">
          Edgify is a competitive 1v1 platform where players compare faces
          using <span className="text-white">geometric AI scoring</span>. No
          subjective judgment, no filters — just landmark detection and math.
          Climb the seasonal ranked ladder against real opponents.
        </p>
      </div>

      <Section title="How scoring works">
        Each scan extracts 68 facial landmarks via a vision model (SSD-Mobilenet
        with TinyFaceDetector fallback). We average ~80 high-quality frames
        into a single consensus face, weighted by detector confidence, head
        pose, sharpness, and brightness. The consensus is then evaluated on
        six geometric metrics — symmetry, jawline definition, canthal tilt,
        cheekbone prominence, golden-ratio fit, and facial fullness — and
        composited into a 0–100 EdgeScore. The whole pipeline runs locally
        in your browser. Nothing leaves your device unless you opt into Deep
        Analysis after a match.
      </Section>

      <Section title="How matches work">
        Live matches use WebRTC peer-to-peer video. Two players see each
        other&apos;s camera, the AI scans both faces in real time across three
        criteria (Symmetry, Jawline, Overall), and ELO is updated based on
        round outcomes. Best-of-3 wins the match. Random matchmaking pairs
        players within a ±150 ELO band; you can also create a private code
        and share it with a friend.
      </Section>

      <Section title="Ranks & seasons">
        Ranks run from{" "}
        <span className="font-semibold text-white">SUB</span> through{" "}
        <span className="font-semibold text-white">TRUE ADAM</span>. The first
        five matches are <span className="text-white">placement</span> —
        no rank is shown until you finish them. Each season runs ~90 days,
        with a soft ELO reset and a fresh season pass on rollover. You earn
        XP per match (more for wins, more for streaks, more for longer modes)
        and unlock power-ups, frames, and titles up the season pass.
      </Section>

      <Section title="EdgeScore is a metric, not a verdict">
        EdgeScore is an <span className="font-semibold text-white">entertainment</span>{" "}
        metric. It measures a handful of geometric properties — that&apos;s
        all. It does not, and cannot, measure attractiveness, worth, or
        anything subjective. Treat it like a leaderboard for chess: a
        ranked-skill signal in a specific game, not a judgment of you.
      </Section>

      <Section title="Privacy">
        Face scans run locally. Match replays store a small thumbnail (200x150
        jpeg) and round scores, not raw video. The optional Deep Analysis
        feature sends face snapshots to Anthropic for a one-shot structured
        analysis — Anthropic doesn&apos;t train on these images and we
        don&apos;t store them. Sign-in is password-only; we don&apos;t require
        email.
      </Section>

      <Footer />
    </main>
  );
}

function Section({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="label-xs mb-3 text-edge-cyan">{title}</h2>
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5 text-sm leading-relaxed text-white/70">
        {children}
      </div>
    </section>
  );
}
