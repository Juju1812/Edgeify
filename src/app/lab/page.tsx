"use client";

import Link from "next/link";
import { useState } from "react";
import { useUser } from "@/lib/user-context";
import { NearestScores } from "@/components/NearestScores";
import { SkillCalibration } from "@/components/Lab/SkillCalibration";
import { StyleSuggester } from "@/components/Lab/StyleSuggester";
import { FaceScanner, type ScanResult } from "@/components/Lab/FaceScanner";
import { ScoreReveal } from "@/components/Lab/ScoreReveal";
import { FirstScanShare } from "@/components/Lab/FirstScanShare";
import { SignInModal } from "@/components/SignInModal";
import { Footer } from "@/components/Footer";

export default function LabPage() {
  const { user, status, ready, update } = useUser();
  const [signInOpen, setSignInOpen] = useState(false);
  const [pending, setPending] = useState<ScanResult | null>(null);
  const [showShare, setShowShare] = useState(false);

  function handleComplete(r: ScanResult) {
    setPending(r);
  }

  function commit() {
    if (!pending) return;
    const wasFirstScan = !user.hasScanned;
    update((prev) => ({
      hasScanned: true,
      faceDataUrl: pending.faceDataUrl,
      edgeScore: pending.score,
      // Seed initial ELO from EdgeScore: 700–1300 range
      elo: Math.round(700 + (pending.score.composite / 100) * 600),
      peakElo: Math.round(700 + (pending.score.composite / 100) * 600),
      placementsLeft: 5,
      lifetime: {
        ...prev.lifetime,
        facesScanned: prev.lifetime.facesScanned + 1
      }
    }));
    setPending(null);
    // Viral on-ramp: auto-show share card on the first ever scan.
    if (wasFirstScan) setShowShare(true);
  }

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 pt-10 pb-16">
      <Link
        href="/"
        className="label-xs inline-flex items-center gap-2 text-white/40 transition hover:text-white"
      >
        ← Back to Lobby
      </Link>

      <div className="mt-6 mb-10">
        <p className="label-xs">The Lab</p>
        <h1 className="heading-card mt-2 text-3xl">Solo Calibration</h1>
        <p className="mt-2 max-w-xl text-sm text-white/50">
          Camera or photo upload. Face landmarks are detected on your
          device — we keep the geometric score, never the photo. Nothing
          is uploaded unless you tap Share.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.22em] text-white/45">
          <span className="rounded-full border border-emerald-400/25 bg-emerald-500/[0.04] px-2.5 py-1">
            🔒 On-device detection
          </span>
          <span className="rounded-full border border-emerald-400/25 bg-emerald-500/[0.04] px-2.5 py-1">
            📸 Photos not stored
          </span>
          <span className="rounded-full border border-emerald-400/25 bg-emerald-500/[0.04] px-2.5 py-1">
            📐 Geometry-only score
          </span>
        </div>
      </div>

      {!ready ? (
        <div className="glass h-64 animate-pulse rounded-2xl" />
      ) : status === "guest" ? (
        <Gate
          title="Sign in to scan"
          description="Calibration requires a signed-in account so we can save your placements."
          ctaLabel="Claim a username"
          onCta={() => setSignInOpen(true)}
        />
      ) : pending ? (
        <ScoreReveal
          score={pending.score}
          faceDataUrl={pending.faceDataUrl}
          onContinue={commit}
        />
      ) : user.hasScanned ? (
        <SavedScan />
      ) : (
        <FaceScanner onComplete={handleComplete} />
      )}

      <Footer />
      <SignInModal open={signInOpen} onClose={() => setSignInOpen(false)} />
      {showShare && user.edgeScore && (
        <FirstScanShare
          edgeScore={user.edgeScore}
          faceDataUrl={user.faceDataUrl}
          username={user.username || "PLAYER"}
          elo={user.elo}
          onClose={() => setShowShare(false)}
        />
      )}
    </main>
  );
}

function SavedScan() {
  const { user, update } = useUser();
  const score = user.edgeScore!;

  return (
    <div className="space-y-6">
    <div className="grid gap-6 md:grid-cols-[260px_1fr]">
      <div className="glass overflow-hidden rounded-2xl">
        {user.faceDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.faceDataUrl}
            alt="Saved scan"
            className="aspect-[4/3] w-full -scale-x-100 object-cover"
          />
        ) : (
          <div className="flex aspect-[4/3] items-center justify-center bg-black/40 text-xs uppercase tracking-[0.22em] text-white/30">
            Hidden
          </div>
        )}
        <div className="border-t border-white/[0.04] bg-black/40 px-4 py-3 text-center">
          <p className="label-xs text-white/40">EdgeScore</p>
          <p className="text-4xl font-bold tracking-wider text-white">
            {Math.round(score.composite)}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <p className="label-xs">Saved scan</p>
        <h2 className="heading-card text-2xl">You&apos;re calibrated</h2>
        <p className="text-sm text-white/60">
          {user.placementsLeft > 0
            ? `${user.placementsLeft} placement matches left before you get a real rank.`
            : "Placements complete. You're eligible for ranked matchmaking."}
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href="/arena"
            className="rounded-lg border border-mog-violet/50 bg-mog-violet/20 px-5 py-2.5 text-xs uppercase tracking-[0.22em] text-white transition hover:bg-mog-violet/30"
          >
            Enter Arena →
          </Link>
          <button
            onClick={() => update({ hasScanned: false, faceDataUrl: null, edgeScore: null })}
            className="rounded-lg border border-white/10 bg-white/[0.02] px-5 py-2.5 text-xs uppercase tracking-[0.22em] text-white/60 transition hover:border-white/20 hover:text-white"
          >
            Re-scan
          </button>
          <button
            onClick={() => update({ hideFromBoard: !user.hideFromBoard })}
            className="rounded-lg border border-white/10 bg-white/[0.02] px-5 py-2.5 text-xs uppercase tracking-[0.22em] text-white/60 transition hover:border-white/20 hover:text-white"
          >
            {user.hideFromBoard ? "Show on leaderboard" : "Hide from leaderboard"}
          </button>
        </div>
      </div>
    </div>
    <SkillCalibration />
    <StyleSuggester />
    <NearestScores />
    </div>
  );
}

function Gate({
  title,
  description,
  ctaLabel,
  onCta
}: {
  title: string;
  description: string;
  ctaLabel: string;
  onCta: () => void;
}) {
  return (
    <div className="glass rounded-2xl px-8 py-12 text-center">
      <p className="label-xs">Locked</p>
      <h2 className="heading-card mt-2 text-2xl">{title}</h2>
      <p className="mx-auto mt-3 max-w-md text-sm text-white/50">{description}</p>
      <button
        onClick={onCta}
        className="mt-6 rounded-lg border border-mog-violet/50 bg-mog-violet/20 px-6 py-3 text-xs uppercase tracking-[0.22em] text-white transition hover:bg-mog-violet/30"
      >
        {ctaLabel}
      </button>
    </div>
  );
}
