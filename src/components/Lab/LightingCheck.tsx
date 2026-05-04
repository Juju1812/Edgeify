"use client";

import { useEffect, useState } from "react";

type Quality = "good" | "ok" | "bad";

/**
 * Pre-scan ambient lighting check. Samples the live video feed every
 * 500ms, computes mean luma, and emits a quality verdict. Surfaces a
 * small badge so the user can adjust before starting a real scan.
 *
 * Pure read-only — does NOT take a snapshot or store anything.
 */
export function LightingCheck({
  videoRef
}: {
  videoRef: React.RefObject<HTMLVideoElement>;
}) {
  const [quality, setQuality] = useState<Quality | null>(null);
  const [luma, setLuma] = useState(0);

  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 80;
    canvas.height = 60;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const tick = () => {
      const v = videoRef.current;
      if (!v || v.readyState < 2 || v.videoWidth === 0) return;
      try {
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let sum = 0;
        for (let i = 0; i < id.data.length; i += 16) {
          // sample every 4 pixels (16 bytes) for cheapness
          sum +=
            id.data[i] * 0.299 + id.data[i + 1] * 0.587 + id.data[i + 2] * 0.114;
        }
        const mean = sum / (id.data.length / 16);
        setLuma(mean);
        setQuality(mean < 50 ? "bad" : mean < 90 ? "ok" : mean > 220 ? "ok" : "good");
      } catch {
        /* */
      }
    };

    tick();
    const t = window.setInterval(tick, 500);
    return () => window.clearInterval(t);
  }, [videoRef]);

  if (quality === null) return null;

  const color =
    quality === "good"
      ? "#22e9ff"
      : quality === "ok"
        ? "#ffb547"
        : "#ff5d8f";
  const label =
    quality === "good"
      ? "Lighting good"
      : quality === "ok"
        ? "Lighting acceptable"
        : luma < 50
          ? "Too dark — turn on more light"
          : "Too bright — reduce backlight";

  return (
    <div
      className="inline-flex items-center gap-2 rounded-full border bg-black/60 px-3 py-1.5 text-[10px] uppercase tracking-[0.22em] backdrop-blur"
      style={{ borderColor: `${color}55`, color }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: color }}
      />
      {label}
    </div>
  );
}
