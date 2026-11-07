"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { clsx } from "clsx";
import { api, ApiError } from "@/lib/client/api";
import { captureFaceBurst, grabMirroredFrame, grabThumb, useCamera } from "@/lib/client/camera";
import { useFaceTracker, type Pt } from "@/lib/client/face-mesh";
import { useRequireAuth } from "@/lib/client/use-require-auth";
import { DEFAULT_OVERLAY_COLOR, formatPsl, type MeProfile, type Sex, type Traits } from "@/lib/shared/types";
import { LiveScanOverlay, REVEAL_TOTAL_MS, ScanOverlay, type LiveMode } from "@/components/face-overlay";
import { RatiosCard } from "@/components/ratios-card";
import type { Ratios } from "@/lib/shared/ratios";
import { Button, ButtonLink, Card, Notice, Spinner } from "@/components/ui";
import { ScoreRing, TraitBars, tierLabel } from "@/components/score";

type Reading = {
  overall: number;
  traits: Traits;
  headline: string;
  strengths: string[];
  improvements: string[];
  confidence: "low" | "medium" | "high";
  ratios: Ratios | null;
  ratioScore: number | null;
  psl: number;
  sex: Sex;
};

type Snapshot = { url: string; width: number; height: number; points: Pt[] | null };

type Phase =
  | { k: "intro" }
  | { k: "preparing" }
  | { k: "countdown"; n: number }
  | { k: "analyzing" }
  /** Scores arrived — they lock in live on the camera feed. */
  | { k: "reveal"; reading: Reading; me: MeProfile; snap: Snapshot | null; startedAt: number; done: boolean }
  | { k: "result"; reading: Reading; me: MeProfile; snap: Snapshot | null }
  | { k: "error"; message: string; retry: boolean };

export default function ScanPage() {
  const { me, setMe } = useRequireAuth();
  const cam = useCamera();
  const [phase, setPhase] = useState<Phase>({ k: "intro" });
  const camLive = cam.state === "live";
  const tracker = useFaceTracker(cam.videoRef, camLive);
  const color = me?.overlayColor || DEFAULT_OVERLAY_COLOR;

  // Mark the live reveal finished once every score has locked in.
  const revealStart = phase.k === "reveal" ? phase.startedAt : null;
  useEffect(() => {
    if (revealStart === null) return;
    const t = setTimeout(
      () => setPhase((p) => (p.k === "reveal" ? { ...p, done: true } : p)),
      Math.max(0, revealStart + REVEAL_TOTAL_MS - performance.now())
    );
    return () => clearTimeout(t);
  }, [revealStart]);

  function showBreakdown() {
    if (phase.k !== "reveal") return;
    setPhase({ k: "result", reading: phase.reading, me: phase.me, snap: phase.snap });
    cam.stop();
  }

  async function run() {
    const stream = await cam.start();
    const video = cam.videoRef.current;
    if (!stream || !video) return;
    // Give the face tracker a moment to finish loading on a first visit, so
    // the scan gets a tight face crop, measured ratios and the live reveal.
    setPhase({ k: "preparing" });
    const until = (cond: () => boolean, ms: number) =>
      new Promise<void>((resolve) => {
        const t0 = Date.now();
        const poll = () => (cond() || Date.now() - t0 > ms ? resolve() : setTimeout(poll, 100));
        poll();
      });
    await until(() => tracker.readyRef.current !== "loading", 8000);
    for (const n of [3, 2, 1]) {
      setPhase({ k: "countdown", n });
      await new Promise((r) => setTimeout(r, 800));
    }
    // If the tracker is running and sees no face, don't spend a scan on it.
    if (tracker.readyRef.current === "ready") await until(() => !!tracker.landmarks.current, 1500);
    if (tracker.readyRef.current === "ready" && !tracker.landmarks.current) {
      setPhase({ k: "error", message: "We can't see your face. Center yourself in the frame and try again.", retry: true });
      return;
    }
    const pts = tracker.landmarks.current ? [...tracker.landmarks.current] : null;
    const still = grabMirroredFrame(video);
    const { frames, ratios } = await captureFaceBurst(video, () => tracker.landmarks.current, 5, 280);
    const thumb = grabThumb(video, tracker.landmarks.current ?? pts);
    setPhase({ k: "analyzing" });
    try {
      const r = await api<{ ok: true; reading: Reading; me: MeProfile }>("/api/scan", { body: { frames, thumb, ratios } });
      setMe(r.me, true);
      const snap = still ? { ...still, points: pts } : null;
      if (tracker.landmarks.current) {
        // Face still in view: lock the scores in live on the camera.
        setPhase({ k: "reveal", reading: r.reading, me: r.me, snap, startedAt: performance.now(), done: false });
      } else {
        setPhase({ k: "result", reading: r.reading, me: r.me, snap });
        cam.stop();
      }
    } catch (e) {
      const err = e instanceof ApiError ? e : null;
      setPhase({
        k: "error",
        message: err?.message || "Couldn't reach Edgify. Check your connection.",
        retry: true
      });
    }
  }

  if (!me) {
    return (
      <main className="page flex justify-center pt-24">
        <Spinner />
      </main>
    );
  }

  if (phase.k === "result") {
    return (
      <Result reading={phase.reading} me={phase.me} snap={phase.snap} color={color} onAgain={() => setPhase({ k: "intro" })} />
    );
  }

  const tracking = camLive && tracker.faceFound;
  const liveMode: LiveMode =
    phase.k === "analyzing"
      ? { k: "reading" }
      : phase.k === "reveal"
        ? { k: "reveal", traits: phase.reading.traits, overall: phase.reading.overall, startedAt: phase.startedAt }
        : { k: "dots" };
  // Without a tracked face there's nothing to draw scores onto — fall back to a spinner.
  const readingFallback = phase.k === "analyzing" && (tracker.ready !== "ready" || !tracking);
  return (
    <main className="page">
      <div className="mx-auto max-w-[720px]">
        <div className="mb-6 text-center md:mb-8">
          <h1 className="display text-[34px] md:text-[44px]">
            {phase.k === "analyzing" ? "Reading your face" : phase.k === "reveal" ? "Your score" : me.score ? "Scan again" : "Get your score"}
          </h1>
          <p className="mt-1.5 text-[17px] text-ink-3">
            {phase.k === "reveal"
              ? "Here's how the AI read your face."
              : phase.k === "analyzing"
                ? "Hold still for a few seconds."
                : "Face a window or a lamp, look straight ahead, and keep a neutral face."}
          </p>
        </div>

        <Card className="overflow-hidden p-3">
          <div className="relative aspect-[4/5] overflow-hidden rounded-[22px] bg-[#e9e9ee] sm:aspect-[4/3]">
            <video
              ref={cam.videoRef}
              playsInline
              muted
              className={clsx(
                "h-full w-full -scale-x-100 object-cover transition-opacity duration-500",
                camLive ? "opacity-100" : "opacity-0"
              )}
            />
            {/* Live dots; while the AI reads, scores grow out of them and lock in */}
            {camLive && (
              <LiveScanOverlay landmarks={tracker.landmarks} videoRef={cam.videoRef} color={color} mode={liveMode} />
            )}
            {camLive && !tracking && phase.k !== "reveal" && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-[72%] w-auto aspect-[3/4] rounded-[50%] border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.18)]" />
              </div>
            )}
            {camLive && (phase.k === "intro" || phase.k === "preparing" || phase.k === "countdown" || phase.k === "error") && (
              <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-black/45 px-3.5 py-1.5 text-[13px] font-medium text-white backdrop-blur">
                {tracker.ready === "loading"
                  ? "Loading face tracker…"
                  : tracker.ready === "unavailable"
                    ? "Face tracking unavailable"
                    : tracking
                      ? "Face locked"
                      : "Looking for your face…"}
              </div>
            )}
            {phase.k === "analyzing" && !readingFallback && (
              <div className="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/50 px-4 py-2 text-[13px] font-medium text-white backdrop-blur">
                <Spinner className="h-4 w-4" light />
                Reading your face — hold still
              </div>
            )}
            {!camLive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
                {cam.state === "starting" ? (
                  <Spinner />
                ) : cam.state === "denied" ? (
                  <p className="max-w-xs text-[15px] text-ink-2">
                    Camera access is blocked. Allow it in your browser&apos;s address bar, then try again.
                  </p>
                ) : cam.state === "unavailable" ? (
                  <p className="max-w-xs text-[15px] text-ink-2">We couldn&apos;t find a camera on this device.</p>
                ) : (
                  <>
                    <CameraGlyph />
                    <p className="text-[15px] text-ink-3">Your camera turns on when you start.</p>
                  </>
                )}
              </div>
            )}
            <AnimatePresence>
              {phase.k === "countdown" && (
                <motion.div
                  key={phase.n}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.2 }}
                  className="absolute inset-0 flex items-center justify-center text-[120px] font-bold text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.35)]"
                >
                  {phase.n}
                </motion.div>
              )}
              {readingFallback && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-white/70 backdrop-blur-md"
                >
                  <Spinner className="h-9 w-9" />
                  <p className="text-[17px] font-medium text-ink">Analyzing your face…</p>
                  <p className="text-[14px] text-ink-3">This takes about fifteen seconds.</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex flex-col items-center gap-3 px-2 pb-3 pt-5">
            {phase.k === "error" && (
              <div className="w-full">
                <Notice tone="error">{phase.message}</Notice>
              </div>
            )}
            {(phase.k === "intro" || (phase.k === "error" && phase.retry)) && (
              <Button size="lg" onClick={run} className="min-w-[220px]" disabled={cam.state === "starting"}>
                {phase.k === "error" ? "Try again" : camLive ? "Start scan" : "Turn on camera & scan"}
              </Button>
            )}
            {phase.k === "reveal" && (
              <motion.div
                className="flex flex-wrap justify-center gap-3"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: phase.done ? 1 : 0.35, y: 0 }}
              >
                <Button size="lg" onClick={showBreakdown} disabled={!phase.done}>
                  See full breakdown
                </Button>
                <Button size="lg" variant="secondary" onClick={() => setPhase({ k: "intro" })} disabled={!phase.done}>
                  Scan again
                </Button>
              </motion.div>
            )}
            <p className="text-center text-[13px] text-ink-4">
              Five frames are sent to our AI to score, then discarded. A small thumbnail becomes your profile photo.
            </p>
          </div>
        </Card>
      </div>
    </main>
  );
}

function Result({
  reading,
  me,
  snap,
  color,
  onAgain
}: {
  reading: Reading;
  me: MeProfile;
  snap: Snapshot | null;
  color: string;
  onAgain: () => void;
}) {
  // Landscape webcam shots get the full card width; portrait/square sit beside the text.
  const wide = !!snap && snap.width / snap.height > 1.2;
  return (
    <main className="page">
      <div className="mx-auto max-w-[1000px]">
        <Card className="animate-fade-up p-3 md:p-4">
          <div className={clsx("flex flex-col gap-6", !wide && "md:flex-row md:items-center md:gap-10")}>
            {snap ? (
              <div className={clsx("w-full", !wide && "md:w-[58%]")}>
                <ScanOverlay
                  image={snap.url}
                  width={snap.width}
                  height={snap.height}
                  points={snap.points}
                  traits={reading.traits}
                  overall={reading.overall}
                  color={color}
                />
              </div>
            ) : (
              <div className="flex justify-center pt-6 md:pl-6 md:pt-0">
                <ScoreRing value={reading.overall} size={224} />
              </div>
            )}
            <div
              className={clsx(
                "px-4 pb-5 text-center",
                wide ? "md:px-6 md:pb-6" : "md:flex-1 md:px-0 md:pb-0 md:pr-6 md:text-left"
              )}
            >
              <p className="eyebrow">
                {tierLabel(reading.overall, reading.sex)} · {formatPsl(reading.overall)}
              </p>
              <h1 className="display mt-2 text-[30px] leading-[1.1] md:text-[38px]">{reading.headline}</h1>
              {reading.confidence === "low" && (
                <p className="mt-3 text-[14px] text-warn">Low-confidence read — better lighting will give a truer score.</p>
              )}
              <div className={clsx("mt-6 flex flex-wrap justify-center gap-3", !wide && "md:justify-start")}>
                <ButtonLink href="/play" size="lg">
                  Play 1v1
                </ButtonLink>
                <Button variant="secondary" size="lg" onClick={onAgain}>
                  Scan again
                </Button>
              </div>
            </div>
          </div>
        </Card>

        <div className="mt-5 grid gap-5 md:grid-cols-[1.25fr_1fr]">
          <Card className="animate-fade-up p-7 [animation-delay:120ms]">
            <h2 className="text-[22px] font-semibold tracking-tight">Trait breakdown</h2>
            <div className="mt-5">
              <TraitBars traits={reading.traits} />
            </div>
          </Card>
          <div className="flex flex-col gap-5">
            <Card className="animate-fade-up p-7 [animation-delay:200ms]">
              <h2 className="text-[22px] font-semibold tracking-tight">Strengths</h2>
              <ul className="mt-4 flex flex-col gap-3">
                {reading.strengths.map((s) => (
                  <li key={s} className="flex gap-3 text-[15px] text-ink-2">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    {s}
                  </li>
                ))}
              </ul>
            </Card>
            <Card className="animate-fade-up p-7 [animation-delay:280ms]">
              <h2 className="text-[22px] font-semibold tracking-tight">Easy wins</h2>
              <ul className="mt-4 flex flex-col gap-3">
                {reading.improvements.map((s) => (
                  <li key={s} className="flex gap-3 text-[15px] text-ink-2">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-ink-4" />
                    {s}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
        {reading.ratios && (
          <div className="mt-5">
            <RatiosCard ratios={reading.ratios} />
          </div>
        )}
        <p className="mt-6 text-center text-[13px] text-ink-4">
          Scores are an AI&apos;s opinion, for fun. They don&apos;t define you.
        </p>
      </div>
    </main>
  );
}

function CameraGlyph() {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" aria-hidden className="text-ink-4">
      <path
        d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.2l1.1-1.6A1.5 1.5 0 0 1 10 3.8h4a1.5 1.5 0 0 1 1.2.6L16.3 6h1.2A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5v-8Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="12.3" r="3.4" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
