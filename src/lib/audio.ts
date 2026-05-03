/**
 * Tiny SFX system. Generates short tones via Web Audio API so we don't
 * have to ship audio files. Single shared AudioContext, lazily created
 * on first user interaction (browsers block audio before that).
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const Ctor =
    (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
      .AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

type ToneOpts = {
  freq: number;
  duration: number;
  type?: OscillatorType;
  volume?: number;
  startAt?: number; // seconds offset from now
  attack?: number;
  release?: number;
};

function tone({
  freq,
  duration,
  type = "sine",
  volume = 0.18,
  startAt = 0,
  attack = 0.005,
  release = 0.06
}: ToneOpts) {
  const ac = getCtx();
  if (!ac) return;
  if (ac.state === "suspended") void ac.resume();
  const start = ac.currentTime + startAt;
  const end = start + duration;

  const osc = ac.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);

  const gain = ac.createGain();
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + attack);
  gain.gain.setValueAtTime(volume, Math.max(start + attack, end - release));
  gain.gain.linearRampToValueAtTime(0, end);

  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(start);
  osc.stop(end + 0.02);
}

export type SfxName =
  | "tick"        // small click, used during sample collection
  | "scanStart"   // 3-2-1 countdown beeps
  | "matchStart"  // dramatic descending tone
  | "win"         // ascending major triad
  | "lose"        // descending minor triad
  | "elo"         // sweep, plays alongside ELO delta
  | "reaction"    // emoji burst pop
  | "error";      // dull thud

export function playSfx(name: SfxName) {
  switch (name) {
    case "tick":
      tone({ freq: 1200, duration: 0.04, type: "square", volume: 0.04 });
      break;
    case "scanStart":
      tone({ freq: 660, duration: 0.12, volume: 0.18, startAt: 0 });
      tone({ freq: 660, duration: 0.12, volume: 0.18, startAt: 0.18 });
      tone({ freq: 990, duration: 0.22, volume: 0.22, startAt: 0.36 });
      break;
    case "matchStart":
      tone({ freq: 392, duration: 0.18, type: "sawtooth", volume: 0.15 });
      tone({ freq: 294, duration: 0.30, type: "sawtooth", volume: 0.18, startAt: 0.10 });
      break;
    case "win":
      tone({ freq: 523, duration: 0.18, volume: 0.20, startAt: 0 });
      tone({ freq: 659, duration: 0.18, volume: 0.20, startAt: 0.10 });
      tone({ freq: 784, duration: 0.32, volume: 0.22, startAt: 0.20 });
      break;
    case "lose":
      tone({ freq: 392, duration: 0.18, volume: 0.18, startAt: 0 });
      tone({ freq: 311, duration: 0.18, volume: 0.18, startAt: 0.10 });
      tone({ freq: 247, duration: 0.40, volume: 0.20, startAt: 0.20 });
      break;
    case "elo":
      tone({ freq: 880, duration: 0.10, type: "triangle", volume: 0.12 });
      tone({ freq: 1320, duration: 0.10, type: "triangle", volume: 0.12, startAt: 0.06 });
      break;
    case "reaction":
      tone({ freq: 1760, duration: 0.05, type: "triangle", volume: 0.10 });
      tone({ freq: 2200, duration: 0.05, type: "triangle", volume: 0.10, startAt: 0.04 });
      break;
    case "error":
      tone({ freq: 200, duration: 0.20, type: "square", volume: 0.10 });
      break;
  }
}

export function vibrate(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      /* user agent doesn't allow vibration in this context */
    }
  }
}
