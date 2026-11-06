"use client";

import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { Avatar } from "@/components/ui";

type Props = {
  name: string;
  elo?: number;
  hasFace?: boolean;
  /** For the local tile: the camera hook's ref (needed for frame capture). */
  videoRef?: React.MutableRefObject<HTMLVideoElement | null>;
  /** For the remote tile. */
  stream?: MediaStream | null;
  mirrored?: boolean;
  muted?: boolean;
  /** Shown instead of video when there is none. */
  fallback?: React.ReactNode;
  showVideo: boolean;
  overlay?: React.ReactNode;
  you?: boolean;
};

export function VideoTile({
  name,
  elo,
  hasFace,
  videoRef,
  stream,
  mirrored,
  muted,
  fallback,
  showVideo,
  overlay,
  you
}: Props) {
  const ownRef = useRef<HTMLVideoElement | null>(null);
  const [needsTap, setNeedsTap] = useState(false);

  // Remote stream wiring (local tile is wired by useCamera).
  useEffect(() => {
    const v = ownRef.current;
    if (!v || videoRef || !stream) return;
    if (v.srcObject !== stream) v.srcObject = stream;
    v.play()
      .then(() => setNeedsTap(false))
      .catch(() => setNeedsTap(true));
  }, [stream, videoRef]);

  const setRef = (el: HTMLVideoElement | null) => {
    ownRef.current = el;
    if (videoRef) videoRef.current = el;
  };

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl bg-[#e9e9ee] shadow-card">
      <video
        ref={setRef}
        autoPlay
        playsInline
        muted={muted}
        className={clsx(
          "absolute inset-0 h-full w-full object-cover transition-opacity duration-500",
          mirrored && "-scale-x-100",
          showVideo ? "opacity-100" : "opacity-0"
        )}
      />
      {!showVideo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <Avatar username={name} hasFace={hasFace} size={84} />
          {fallback}
        </div>
      )}

      {overlay && <div className="absolute inset-0">{overlay}</div>}

      <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-white/85 px-3 py-1.5 text-[13px] shadow-sm backdrop-blur-md">
        <span className="max-w-[140px] truncate font-semibold text-ink">{name}</span>
        {you && <span className="text-ink-3">You</span>}
        {elo !== undefined && <span className="tabular-nums text-ink-3">{elo}</span>}
      </div>

      {needsTap && showVideo && (
        <button
          type="button"
          onClick={() => ownRef.current?.play().then(() => setNeedsTap(false)).catch(() => {})}
          className="absolute right-3 top-3 rounded-full bg-white/90 px-3 py-1.5 text-[13px] font-medium text-ink shadow-sm backdrop-blur-md"
        >
          Tap for sound
        </button>
      )}
    </div>
  );
}
