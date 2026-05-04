"use client";

import { useEffect, useState } from "react";

/**
 * Lists available webcams and lets the user pick one. Used by the
 * scanner pre-scan UI. Hidden if there's only one camera.
 *
 * Modern browsers don't expose device labels until permission has
 * been granted at least once — so we trigger a one-shot getUserMedia
 * if labels are empty.
 */
export function CameraSelector({
  selectedDeviceId,
  onChange
}: {
  selectedDeviceId: string | null;
  onChange: (deviceId: string) => void;
}) {
  const [cams, setCams] = useState<MediaDeviceInfo[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Initial probe — labels may be empty if we don't have permission.
        let devs = await navigator.mediaDevices.enumerateDevices();
        let videoCams = devs.filter((d) => d.kind === "videoinput");
        const needPerm = videoCams.length > 0 && videoCams.every((d) => !d.label);
        if (needPerm) {
          // Brief permission request to unlock labels — immediately stopped.
          try {
            const s = await navigator.mediaDevices.getUserMedia({ video: true });
            s.getTracks().forEach((t) => t.stop());
            devs = await navigator.mediaDevices.enumerateDevices();
            videoCams = devs.filter((d) => d.kind === "videoinput");
          } catch {
            /* permission denied — fall through with unlabeled list */
          }
        }
        if (!cancelled) setCams(videoCams);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error || cams.length <= 1) return null;

  return (
    <div className="flex items-center gap-2">
      <label className="text-[10px] uppercase tracking-[0.32em] text-white/45">
        Camera
      </label>
      <select
        value={selectedDeviceId || ""}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-[11px] text-white/80 outline-none focus:border-edge-cyan"
      >
        <option value="">Auto</option>
        {cams.map((c, i) => (
          <option key={c.deviceId} value={c.deviceId}>
            {c.label || `Camera ${i + 1}`}
          </option>
        ))}
      </select>
    </div>
  );
}
