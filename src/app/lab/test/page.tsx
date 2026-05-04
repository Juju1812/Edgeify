"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Footer } from "@/components/Footer";

/**
 * Camera diagnostic page. Lists available video inputs, lets the user
 * pick one, shows the live preview, and reports the actual stream
 * resolution + frame rate. Useful when scans aren't working and the
 * user wants to confirm their camera is at least producing frames.
 */
export default function CameraTestPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cams, setCams] = useState<MediaDeviceInfo[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [info, setInfo] = useState<{
    width: number;
    height: number;
    fps: number;
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  async function start(deviceId?: string) {
    setErr(null);
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: deviceId ? { deviceId: { exact: deviceId } } : true,
        audio: false
      });
      streamRef.current = stream;
      const v = videoRef.current;
      if (v) {
        v.srcObject = stream;
        await v.play();
      }
      const settings = stream.getVideoTracks()[0]?.getSettings() || {};
      setInfo({
        width: settings.width || 0,
        height: settings.height || 0,
        fps: settings.frameRate || 0
      });
      // Refresh device list now that permission is granted (labels appear).
      const devs = await navigator.mediaDevices.enumerateDevices();
      setCams(devs.filter((d) => d.kind === "videoinput"));
    } catch (e) {
      setErr((e as Error).message || "Camera unavailable.");
    }
  }

  useEffect(() => {
    void start();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selected) void start(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 pt-10 pb-16">
      <Link
        href="/lab"
        className="label-xs inline-flex items-center gap-2 text-white/40 hover:text-white"
      >
        ← Back to Lab
      </Link>

      <div className="mt-6">
        <p className="label-xs text-edge-cyan">Diagnostics</p>
        <h1 className="heading-display mt-2 text-4xl">Camera Test</h1>
        <p className="mt-2 text-sm text-white/55">
          Confirm your webcam is producing a usable stream. If this works
          here, the scanner should work too.
        </p>
      </div>

      {err && (
        <div className="mt-6 rounded-lg border border-rose-500/30 bg-rose-500/[0.06] p-4 text-sm text-rose-200">
          {err}
        </div>
      )}

      <div className="mt-6">
        <div className="glass relative aspect-[4/3] overflow-hidden rounded-2xl bg-black">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="h-full w-full -scale-x-100 object-cover"
          />
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-4">
          <p className="label-xs">Stream</p>
          {info ? (
            <p className="mt-2 stat-mono text-edge-cyan">
              {info.width} × {info.height} @ {info.fps.toFixed(0)}fps
            </p>
          ) : (
            <p className="mt-2 text-sm text-white/45">No stream yet…</p>
          )}
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-4">
          <p className="label-xs mb-2">Pick camera</p>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="w-full rounded-md border border-white/10 bg-black/40 px-2 py-2 text-sm text-white/80 outline-none focus:border-edge-cyan"
          >
            <option value="">Auto / default</option>
            {cams.map((c, i) => (
              <option key={c.deviceId} value={c.deviceId}>
                {c.label || `Camera ${i + 1}`}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Footer />
    </main>
  );
}
