"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Footer } from "@/components/Footer";
import {
  AD_TEMPLATES,
  type AdTemplateId,
  renderAd
} from "@/lib/ads-render";

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

export default function AdsPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tplId, setTplId] = useState<AdTemplateId>("hook");
  const [hook, setHook] = useState(HOOKS[0]);
  const [customHook, setCustomHook] = useState("");
  const [copiedCaption, setCopiedCaption] = useState<string | null>(null);

  const tpl = AD_TEMPLATES.find((t) => t.id === tplId)!;
  const finalHook = (customHook.trim() || hook).slice(0, 60);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.width = tpl.width;
    c.height = tpl.height;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    renderAd(ctx, tplId, tpl.width, tpl.height, { hook: finalHook });
  }, [tplId, finalHook, tpl.width, tpl.height]);

  function downloadPNG() {
    const c = canvasRef.current;
    if (!c) return;
    const url = c.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `edgify-ad-${tplId}-${Date.now()}.png`;
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
      /* clipboard might not allow it on this browser */
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
          Pick a template, optionally swap the hook, download a PNG, and post.
          All assets are 100% on-brand and rendered locally — nothing uploads.
        </p>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[360px_1fr]">
        {/* ─── LEFT: Controls ─── */}
        <div className="space-y-5">
          <div>
            <p className="label-xs mb-2">Template</p>
            <div className="grid grid-cols-2 gap-2">
              {AD_TEMPLATES.map((t) => {
                const active = t.id === tplId;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTplId(t.id)}
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
                      {t.label}
                    </p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.22em] text-white/40">
                      {t.hint}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {tpl.acceptsHook && (
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

          <p className="text-[10px] uppercase tracking-[0.22em] text-white/30">
            Output: {tpl.width} × {tpl.height} · PNG
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
                <span className="text-white/85">TikTok / Reels:</span> use the
                vertical templates as a 6s static post or the cover frame for
                a screen-recording. Pair with the highlight clip generator on
                the match Result screen.
              </li>
              <li>
                <span className="text-white/85">Instagram feed:</span> the 1:1
                square templates work as carousel slides. Use the rank ladder
                as slide 1 and feature stack as slide 2.
              </li>
              <li>
                <span className="text-white/85">Reddit:</span> the
                comparison-table TikTok works well in r/looksmaxx and
                r/teenagers. Lead with the long-form post copy below.
              </li>
              <li>
                <span className="text-white/85">X / Twitter:</span> use the
                landscape banner. Twitter clips a 16:9 to 16:9; everything
                stays in frame.
              </li>
            </ul>
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}
