"use client";

import { api } from "./api";

export type RtcState = "connecting" | "connected" | "failed" | "closed";

export type RtcHandle = {
  close: () => void;
  setMic: (on: boolean) => void;
};

type Opts = {
  matchId: string;
  iAmHost: boolean;
  localStream: MediaStream;
  onRemoteStream: (s: MediaStream) => void;
  onState: (s: RtcState) => void;
};

const POLL_MS = 700;
const GATHER_CAP_MS = 3000;
const SIGNAL_TIMEOUT_MS = 70_000;
const CONNECT_TIMEOUT_MS = 25_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Resolve once ICE gathering completes, or after `cap` ms (whatever we have is fine). */
function waitForGathering(pc: RTCPeerConnection, cap = GATHER_CAP_MS) {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise<void>((resolve) => {
    const done = () => {
      pc.removeEventListener("icegatheringstatechange", check);
      clearTimeout(t);
      resolve();
    };
    const check = () => {
      if (pc.iceGatheringState === "complete") done();
    };
    const t = setTimeout(done, cap);
    pc.addEventListener("icegatheringstatechange", check);
  });
}

/**
 * Peer-to-peer video between the two players, signalled through our own
 * API (non-trickle: candidates are bundled into the SDP, so one offer and
 * one answer are enough). Video is a nice-to-have — scoring happens on the
 * server, so a failed link never blocks the face-off.
 */
export function connectMatch({ matchId, iAmHost, localStream, onRemoteStream, onState }: Opts): RtcHandle {
  let closed = false;
  let pc: RTCPeerConnection | null = null;
  let connectTimer: ReturnType<typeof setTimeout> | null = null;
  let state: RtcState = "connecting";

  const set = (s: RtcState) => {
    if (closed && s !== "closed") return;
    if (state === s) return;
    state = s;
    onState(s);
  };

  const signalUrl = `/api/match/${matchId}/signal`;

  async function poll(kind: "offer" | "answer"): Promise<string | null> {
    const deadline = Date.now() + SIGNAL_TIMEOUT_MS;
    while (!closed && Date.now() < deadline) {
      try {
        const r = await api<{ sdp: string | null }>(`${signalUrl}?kind=${kind}`);
        if (r.sdp) return r.sdp;
      } catch {
        /* transient — keep polling */
      }
      await sleep(POLL_MS);
    }
    return null;
  }

  async function run() {
    let iceServers: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
    try {
      const r = await api<{ iceServers: RTCIceServer[] }>("/api/turn");
      if (Array.isArray(r.iceServers) && r.iceServers.length) iceServers = r.iceServers;
    } catch {
      /* fall back to public STUN */
    }
    if (closed) return;

    pc = new RTCPeerConnection({ iceServers });
    const conn = pc;
    localStream.getTracks().forEach((t) => conn.addTrack(t, localStream));

    conn.ontrack = (e) => {
      const s = e.streams[0] || new MediaStream([e.track]);
      onRemoteStream(s);
    };
    conn.onconnectionstatechange = () => {
      const cs = conn.connectionState;
      if (cs === "connected") {
        if (connectTimer) clearTimeout(connectTimer);
        set("connected");
      } else if (cs === "failed") set("failed");
      else if (cs === "disconnected") set("connecting");
      else if (cs === "closed") set("closed");
    };

    const armTimeout = () => {
      connectTimer = setTimeout(() => {
        if (state !== "connected") set("failed");
      }, CONNECT_TIMEOUT_MS);
    };

    if (iAmHost) {
      const offer = await conn.createOffer();
      await conn.setLocalDescription(offer);
      await waitForGathering(conn);
      if (closed) return;
      await api(signalUrl, { body: { kind: "offer", sdp: conn.localDescription?.sdp } });
      const answer = await poll("answer");
      if (closed) return;
      if (!answer) return set("failed");
      await conn.setRemoteDescription({ type: "answer", sdp: answer });
      armTimeout();
    } else {
      const offer = await poll("offer");
      if (closed) return;
      if (!offer) return set("failed");
      await conn.setRemoteDescription({ type: "offer", sdp: offer });
      const answer = await conn.createAnswer();
      await conn.setLocalDescription(answer);
      await waitForGathering(conn);
      if (closed) return;
      await api(signalUrl, { body: { kind: "answer", sdp: conn.localDescription?.sdp } });
      armTimeout();
    }
  }

  onState("connecting");
  run().catch((e) => {
    console.warn("rtc failed", e);
    set("failed");
  });

  return {
    close() {
      if (closed) return;
      closed = true;
      if (connectTimer) clearTimeout(connectTimer);
      try {
        pc?.close();
      } catch {
        /* ignore */
      }
      pc = null;
      state = "closed";
      onState("closed");
    },
    setMic(on: boolean) {
      localStream.getAudioTracks().forEach((t) => (t.enabled = on));
    }
  };
}
