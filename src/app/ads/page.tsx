"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Footer } from "@/components/Footer";
import {
  AD_TEMPLATES,
  type AdTemplateId,
  renderAd
} from "@/lib/ads-render";
import {
  VIDEO_TEMPLATES,
  type VideoAdId,
  recordVideoAd,
  renderVideoFrame
} from "@/lib/ads-video";

const HOOKS = [
  "Mogged or mogged on?",
  "Where do you actually rank?",
  "Real opponents. AI scoring.",
  "Climb to TRUE ADAM.",
  "Find out before they do.",
  "Are you sub3 or top tier?",
  "AI knows your edge."
];

const CAPTIONS: Record<
  string,
  { label: string; text: string }
> = {
  tiktok: {
    label: "TikTok caption",
    text: `live 1v1 face-offs scored by AI 🥀\n\nclimb the ranked ladder. real opponents, no bots.\n\n→ edgify.app\n\n#lookmaxx #mogging #faceoff #rateme #ranked`
  },
  instagram: {
    label: "Instagram caption",
    text: `face-offs but ranked. live opponents, AI scoring, ELO ladder.\n\nedgify.app\n\n#lookmaxxing #1v1 #facerating`
  },
  reddit: {
    label: "Reddit post",
    text: `Title: Built a 1v1 face-off platform with AI scoring and ELO matchmaking\n\nBody: Tried to build the looksmaxxing version of chess.com. AR face scanning, real-time matches against random opponents in your ELO band, geometric scoring on 6 metrics (symmetry, jawline, etc), seasonal ranked ladder. Free, no account required.\n\nedgify.app — would love feedback.`
  },
  twitter: {
    label: "X / Twitter post",
    text: `Edgify — live 1v1 face-offs.\n\nReal opponents, no bots. AI scores both faces in real time and ranks you on a competitive ELO ladder.\n\nNo account needed.\n\n→ edgify.app`
  }
};

type Mode = "image" | "video";

export default function AdsPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<Mode>("image");
  const [imgTplId, setImgTplId] = useState<AdTemplateId>("hook");
  const [vidTplId, setVidTplId] = useState<VideoAdId>("hook-punch");
  const [hook, setHook] = useState(HOOKS[0]);
  const [customHook, setCustomHook] = useState("");
  const [copiedCaption, setCopiedCaption] = useState<string | null>(null);

  // Video-specific
  const [recording, setRecording] = useState(false);
  const [recordProgress, setRecordProgress] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [previewT, setPreviewT] = useState(0); // ms within the loop

  const tpl =
    mode === "image"
      ? AD_TEMPLATES.find((t) => t.id === imgTplId)!
      : VIDEO_TEMPLATES.find((t) => t.id === vidTplId)!;
  const finalHook = (customHook.trim() || hook).slice(0, 60);
  const acceptsHook =
    mode === "image"
      ? AD_TEMPLATES.find((t) => t.id === imgTplId)!.acceptsHook
      : VIDEO_TEMPLATES.find((t) => t.id === vidTplId)!.acceptsHook;

  // ─── Live preview render ─────────────────────────────────────────
  // For images: render once whenever inputs change.
  // For videos: run a requestAnimationFrame loop that loops the
  // animation at its template's duration so users can see what they
  // get before recording.
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.width = tpl.width;
    c.height = tpl.height;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    if (mode === "image") {
      renderAd(ctx, imgTplId, tpl.width, tpl.height, { hook: finalHook });
      return;
    }

    // Video preview — looping animation
    const v = VIDEO_TEMPLATES.find((t) => t.id === vidTplId)!;
    let raf = 0;
    const startTs = performance.now();
    const tick = () => {
      const elapsed = (performance.now() - startTs) % (v.durationMs + 800);
      const t = Math.min(v.durationMs, elapsed);
      setPreviewT(t);
      renderVideoFrame(ctx, vidTplId, t, v.width, v.height, { hook: finalHook });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mode, imgTplId, vidTplId, finalHook, tpl.width, tpl.height]);

  // ─── Image actions ───────────────────────────────────────────────
  function downloadPNG() {
    const c = canvasRef.current;
    if (!c) return;
    const url = c.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `edgify-ad-${imgTplId}-${Date.now()}.png`;
    a.click();
  }

  async function copyImage() {
    const c = canvasRef.current;
    if (!c) return;
    try {
      c.toBlob(async (blob) => {
        if (!blob) return;
        const navAny = navigator as Navigator & {
          clipboard?: {
            write?: (data: ClipboardItem[]) => Promise<void>;
          };
        };
        if (navAny.clipboard?.write && typeof ClipboardItem !== "undefined") {
          await navAny.clipboard.write([
            new ClipboardItem({ "image/png": blob })
          ]);
          setCopiedCaption("__image__");
          window.setTimeout(() => setCopiedCaption(null), 1500);
        }
      }, "image/png");
    } catch {
      /* */
    }
  }

  // ─── Video actions ───────────────────────────────────────────────
  async function recordVideo() {
    if (recording) return;
    setRecording(true);
    setRecordProgress(0);
    setRecordedBlob(null);
    try {
      const blob = await recordVideoAd(
        vidTplId,
        { hook: finalHook },
        (frac) => setRecordProgress(frac)
      );
      if (blob) setRecordedBlob(blob);
    } finally {
      setRecording(false);
      setRecordProgress(1);
    }
  }

  function downloadVideo() {
    if (!recordedBlob) return;
    const url = URL.createObjectURL(recordedBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `edgify-ad-${vidTplId}-${Date.now()}.webm`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function shareVideo() {
    if (!recordedBlob) return;
    try {
      const file = new File(
        [recordedBlob],
        `edgify-ad-${vidTplId}-${Date.now()}.webm`,
        { type: recordedBlob.type }
      );
      const navAny = navigator as Navigator & {
        canShare?: (data: ShareData) => boolean;
      };
      if (navAny.canShare && navAny.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Edgify",
          text: "Live 1v1 face-offs at edgify.app"
        });
      }
    } catch {
      /* user cancelled */
    }
  }

  async function copyCaption(key: string) {
    const cap = CAPTIONS[key];
    if (!cap) return;
    try {
      await navigator.clipboard.writeText(cap.text);
      setCopiedCaption(key);
      window.setTimeout(() => setCopiedCaption(null), 1500);
    } catch {
      /* */
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-[1400px] px-6 pt-10 pb-16">
      <Link
        href="/"
        className="label-xs inline-flex items-center gap-2 text-white/40 hover:text-white"
      >
        ← Back to Lobby
      </Link>

      <div className="mt-6">
        <p className="label-xs text-edge-cyan">Marketing kit</p>
        <h1 className="heading-display mt-2 text-5xl">
          Make an <span className="brand-edge">ad</span>.
        </h1>
        <p className="mt-3 max-w-xl text-sm text-white/55">
          Pick a template, optionally swap the hook, download or post.
          All assets are 100% on-brand and rendered locally — nothing uploads.
        </p>
      </div>

      {/* Image / Video tabs */}
      <div className="mt-6 inline-flex rounded-lg border border-white/10 bg-black/30 p-1">
        <TabButton active={mode === "image"} onClick={() => {
          setMode("image");
          setRecordedBlob(null);
        }}>
          Image
        </TabButton>
        <TabButton active={mode === "video"} onClick={() => {
          setMode("video");
          setRecordedBlob(null);
        }}>
          Video · NEW
        </TabButton>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
        {/* ─── LEFT: Controls ─── */}
        <div className="space-y-5">
          <div>
            <p className="label-xs mb-2">Template</p>
            <div className="grid grid-cols-2 gap-2">
              {mode === "image"
                ? AD_TEMPLATES.map((t) => {
                    const active = t.id === imgTplId;
                    return (
                      <TemplateButton
                        key={t.id}
                        active={active}
                        label={t.label}
                        hint={t.hint}
                        onClick={() => setImgTplId(t.id)}
                      />
                    );
                  })
                : VIDEO_TEMPLATES.map((t) => {
                    const active = t.id === vidTplId;
                    return (
                      <TemplateButton
                        key={t.id}
                        active={active}
                        label={t.label}
                        hint={t.hint}
                        onClick={() => {
                          setVidTplId(t.id);
                          setRecordedBlob(null);
                        }}
                      />
                    );
                  })}
            </div>
          </div>

          {acceptsHook && (
            <div>
              <p className="label-xs mb-2">Headline / Hook</p>
              <div className="flex flex-wrap gap-2">
                {HOOKS.map((h) => (
                  <button
                    key={h}
                    onClick={() => {
                      setHook(h);
                      setCustomHook("");
                    }}
                    className={
                      "rounded-md border px-2.5 py-1.5 text-[10px] uppercase tracking-[0.18em] transition " +
                      (h === hook && !customHook
                        ? "border-edge-coral/60 bg-edge-coral/10 text-edge-coral"
                        : "border-white/10 bg-white/[0.02] text-white/55 hover:border-white/25 hover:text-white")
                    }
                  >
                    {h}
                  </button>
                ))}
              </div>
              <input
                value={customHook}
                onChange={(e) => setCustomHook(e.target.value.slice(0, 60))}
                placeholder="Or write your own…"
                maxLength={60}
                className="mt-3 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-edge-cyan"
              />
              <p className="mt-1 text-[10px] uppercase tracking-[0.22em] text-white/30">
                {customHook ? customHook.length : 0}/60 chars
              </p>
            </div>
          )}

          {mode === "image" ? (
            <div className="flex flex-col gap-2">
              <button
                onClick={downloadPNG}
                className="rounded-lg border border-edge-cyan/50 bg-edge-cyan/15 px-5 py-3 text-xs font-semibold uppercase tracking-[0.22em] text-white transition hover:border-edge-cyan hover:bg-edge-cyan/25"
              >
                Download PNG ↓
              </button>
              <button
                onClick={copyImage}
                className="rounded-lg border border-white/10 bg-white/[0.02] px-5 py-3 text-xs font-semibold uppercase tracking-[0.22em] text-white/65 transition hover:border-white/25 hover:text-white"
              >
                {copiedCaption === "__image__" ? "Copied ✓" : "Copy image"}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <button
                onClick={recordVideo}
                disabled={recording}
                className="rounded-lg border border-edge-coral/50 bg-edge-coral/15 px-5 py-3 text-xs font-semibold uppercase tracking-[0.22em] text-white transition hover:border-edge-coral hover:bg-edge-coral/25 disabled:opacity-50"
              >
                {recording
                  ? `Recording ${Math.round(recordProgress * 100)}% …`
                  : recordedBlob
                    ? "Re-record"
                    : "Record clip 🎥"}
              </button>
              {recording && (
                <div className="h-1 overflow-hidden rounded-full bg-white/[0.05]">
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${recordProgress * 100}%`,
                      background:
                        "linear-gradient(90deg, #22e9ff 0%, #ff5d8f 100%)"
                    }}
                  />
                </div>
              )}
              {recordedBlob && (
                <>
                  <button
                    onClick={downloadVideo}
                    className="rounded-lg border border-edge-cyan/50 bg-edge-cyan/15 px-5 py-3 text-xs font-semibold uppercase tracking-[0.22em] text-white transition hover:border-edge-cyan hover:bg-edge-cyan/25"
                  >
                    Download .webm ↓
                  </button>
                  <button
                    onClick={shareVideo}
                    className="rounded-lg border border-white/10 bg-white/[0.02] px-5 py-3 text-xs font-semibold uppercase tracking-[0.22em] text-white/65 transition hover:border-white/25 hover:text-white"
                  >
                    Share to TikTok / Insta
                  </button>
                  <p className="text-[10px] uppercase tracking-[0.22em] text-white/35">
                    Size: {(recordedBlob.size / 1024 / 1024).toFixed(1)} MB
                  </p>
                </>
              )}
              <p className="mt-1 text-[10px] uppercase tracking-[0.22em] text-white/30">
                Recording takes ~{Math.round((tpl as { durationMs?: number }).durationMs! / 1000)}s
                · webm output (TikTok / Insta accept)
              </p>
            </div>
          )}

          <p className="text-[10px] uppercase tracking-[0.22em] text-white/30">
            Output: {tpl.width} × {tpl.height} ·{" "}
            {mode === "image"
              ? "PNG"
              : `WEBM · ${
                  (tpl as { durationMs?: number }).durationMs! / 1000
                }s`}
          </p>
        </div>

        {/* ─── RIGHT: Preview ─── */}
        <div>
          <div className="glass relative w-full overflow-hidden rounded-2xl p-3">
            <canvas
              ref={canvasRef}
              className="block h-auto w-full rounded-lg"
              style={{
                aspectRatio: `${tpl.width} / ${tpl.height}`,
                maxHeight: "70vh",
                objectFit: "contain"
              }}
            />
            {mode === "video" && (
              <div className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-full border border-edge-coral/40 bg-black/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-edge-coral backdrop-blur">
                <span className="relative inline-flex h-1.5 w-1.5">
                  <span className="absolute inset-0 animate-pulse-dot rounded-full bg-edge-coral/60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-edge-coral" />
                </span>
                Live preview · {(previewT / 1000).toFixed(1)}s
              </div>
            )}
          </div>

          {/* ─── Caption pack ─── */}
          <div className="mt-6">
            <p className="label-xs mb-3">Caption pack</p>
            <div className="grid gap-3 md:grid-cols-2">
              {Object.entries(CAPTIONS).map(([key, cap]) => (
                <div
                  key={key}
                  className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-edge-cyan">
                      {cap.label}
                    </p>
                    <button
                      onClick={() => copyCaption(key)}
                      className="rounded-md border border-white/10 bg-white/[0.02] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/65 transition hover:border-edge-cyan/40 hover:text-edge-cyan"
                    >
                      {copiedCaption === key ? "Copied ✓" : "Copy"}
                    </button>
                  </div>
                  <pre className="mt-3 whitespace-pre-wrap font-sans text-xs leading-relaxed text-white/65">
                    {cap.text}
                  </pre>
                </div>
              ))}
            </div>
          </div>

          {/* ─── Posting tips ─── */}
          <div className="mt-6 rounded-2xl border border-edge-coral/20 bg-edge-coral/[0.04] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-edge-coral">
              Posting tips
            </p>
            <ul className="mt-3 space-y-2 text-xs text-white/65">
              <li>
                <span className="text-white/85">Video clips:</span> webm uploads
                directly to TikTok and Instagram (they auto-transcode). For
                Twitter/X, run it through{" "}
                <span className="font-mono text-edge-cyan">cloudconvert.com</span>{" "}
                → mp4 first.
              </li>
              <li>
                <span className="text-white/85">TikTok / Reels:</span> the
                vertical templates are 9:16 native. Hook punch + Brand stinger
                are the strongest openers.
              </li>
              <li>
                <span className="text-white/85">Instagram feed:</span> the
                square image templates work as carousel slides. Use rank
                ladder as slide 1 and feature stack as slide 2.
              </li>
              <li>
                <span className="text-white/85">Reddit:</span> the
                comparison-slam video works in r/looksmaxx and r/teenagers.
                Lead with the Reddit post copy below.
              </li>
            </ul>
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}

function TabButton({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "rounded-md px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] transition " +
        (active
          ? "bg-edge-cyan/20 text-edge-cyan"
          : "text-white/45 hover:text-white/80")
      }
    >
      {children}
    </button>
  );
}

function TemplateButton({
  active,
  label,
  hint,
  onClick
}: {
  active: boolean;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "rounded-lg border p-3 text-left transition " +
        (active
          ? "border-edge-cyan/60 bg-edge-cyan/[0.06]"
          : "border-white/10 bg-white/[0.02] hover:border-white/20")
      }
    >
      <p
        className={
          "text-[11px] font-semibold uppercase tracking-[0.18em] " +
          (active ? "text-edge-cyan" : "text-white/85")
        }
      >
        {label}
      </p>
      <p className="mt-1 text-[10px] uppercase tracking-[0.22em] text-white/40">
        {hint}
      </p>
    </button>
  );
}
