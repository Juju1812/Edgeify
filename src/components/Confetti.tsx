"use client";

import { useEffect, useRef } from "react";

/**
 * Lightweight DOM-less confetti — renders into a transient full-screen
 * canvas. Each particle has gravity + drag + rotation. Auto-removes
 * after ~3.5s. Pure JS; no dependency.
 */
export function Confetti({
  trigger,
  colors = ["#a855f7", "#d946ef", "#22d3ee", "#34d399", "#facc15"]
}: {
  trigger: number; // bump to re-fire
  colors?: string[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!trigger) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const W = window.innerWidth;
    const H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.scale(dpr, dpr);

    type P = { x: number; y: number; vx: number; vy: number; w: number; h: number; rot: number; vr: number; color: string; life: number };
    const N = 140;
    const ps: P[] = [];
    for (let i = 0; i < N; i++) {
      ps.push({
        x: W / 2 + (Math.random() - 0.5) * 200,
        y: H * 0.4 + (Math.random() - 0.5) * 80,
        vx: (Math.random() - 0.5) * 14,
        vy: -Math.random() * 14 - 4,
        w: 6 + Math.random() * 6,
        h: 8 + Math.random() * 8,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.4,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 1
      });
    }

    const start = performance.now();
    const tick = () => {
      const elapsed = (performance.now() - start) / 1000;
      ctx.clearRect(0, 0, W, H);
      for (const p of ps) {
        p.vy += 0.32; // gravity
        p.vx *= 0.99; // drag
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.life = Math.max(0, 1 - elapsed / 3.2);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (elapsed < 3.5) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, W, H);
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [trigger, colors]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[100] h-full w-full"
    />
  );
}
