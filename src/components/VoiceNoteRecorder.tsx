"use client";

import { useEffect, useRef, useState } from "react";

const KEY = "edgify:voicenote:v1";
const MAX_MS = 4000;

/**
 * Tiny voice-note recorder. Records up to 4 seconds via MediaRecorder,
 * stores the audio as a base64 webm blob in localStorage, and lets the
 * user play it back. The audio is sent to opponents pre-match so they
 * hear a quick greeting before the VS reveal.
 */
export function VoiceNoteRecorder() {
  const [hasNote, setHasNote] = useState(false);
  const [recording, setRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTsRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    setHasNote(!!localStorage.getItem(KEY));
  }, []);

  async function start() {
    if (recording) return;
    setRecording(true);
    setProgress(0);
    chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream, {
        mimeType: pickMime() || "audio/webm"
      });
      recorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        const reader = new FileReader();
        reader.onloadend = () => {
          try {
            const dataUrl = reader.result as string;
            // Cap at ~150KB to keep payload light.
            if (dataUrl.length < 200_000) {
              localStorage.setItem(KEY, dataUrl);
              setHasNote(true);
            }
          } catch {
            /* */
          }
        };
        reader.readAsDataURL(blob);
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setRecording(false);
        setProgress(1);
      };
      recorder.start();
      startTsRef.current = performance.now();

      const tick = () => {
        const elapsed = performance.now() - startTsRef.current;
        setProgress(Math.min(1, elapsed / MAX_MS));
        if (elapsed >= MAX_MS) {
          stop();
          return;
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      setRecording(false);
    }
  }

  function stop() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    try {
      recorderRef.current?.stop();
    } catch {
      /* */
    }
  }

  function play() {
    const data = localStorage.getItem(KEY);
    if (!data) return;
    const audio = new Audio(data);
    audio.play().catch(() => {});
  }

  function clear() {
    localStorage.removeItem(KEY);
    setHasNote(false);
  }

  return (
    <div className="rounded-2xl border border-edge-coral/25 bg-edge-coral/[0.04] p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="label-xs text-edge-coral">Voice greeting</p>
          <p className="mt-1 text-sm text-white/65">
            Record a 4-second clip. Plays for your opponent on the VS reveal.
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {!recording ? (
          <button
            onClick={start}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-edge-coral/50 bg-edge-coral/15 px-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-white transition hover:bg-edge-coral/25"
          >
            🎙️ Record
          </button>
        ) : (
          <button
            onClick={stop}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-rose-500/50 bg-rose-500/15 px-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-white transition hover:bg-rose-500/25"
          >
            ⏹ Stop
          </button>
        )}
        {hasNote && !recording && (
          <>
            <button
              onClick={play}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-edge-cyan/40 bg-edge-cyan/[0.06] px-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-edge-cyan transition hover:border-edge-cyan/60"
            >
              ▶ Preview
            </button>
            <button
              onClick={clear}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/55 transition hover:border-rose-400/30 hover:text-rose-300"
            >
              Clear
            </button>
          </>
        )}
      </div>
      {recording && (
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full transition-all"
            style={{
              width: `${progress * 100}%`,
              background: "linear-gradient(90deg, #ff5d8f 0%, #22e9ff 100%)"
            }}
          />
        </div>
      )}
      <p className="mt-3 text-[10px] uppercase tracking-[0.22em] text-white/30">
        {hasNote ? "Voice note saved on this device." : "No voice note yet."}
      </p>
    </div>
  );
}

function pickMime(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const m of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]) {
    try {
      if (MediaRecorder.isTypeSupported(m)) return m;
    } catch {
      /* */
    }
  }
  return null;
}

export function loadVoiceNote(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEY);
}
