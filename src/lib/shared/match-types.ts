import type { Traits } from "./types";

export type MatchKind = "ranked" | "room" | "tourney";
export type MatchState = "connecting" | "live" | "done" | "cancelled";

export type MatchScore =
  | { ok: true; overall: number; traits: Traits; headline: string }
  | { ok: false; message: string };

export type MatchResult = {
  winner: string | null; // username, or null for a draw
  reason: "score" | "forfeit" | "draw";
  elo: Record<string, { before: number; after: number; delta: number }> | null;
};

export type MatchView = {
  id: string;
  kind: MatchKind;
  state: MatchState;
  me: string;
  opponent: string;
  /** I create the WebRTC offer. */
  iAmHost: boolean;
  players: { username: string; elo: number; hasFace: boolean }[];
  ready: string[];
  startAt: number | null;
  serverNow: number;
  scores: Record<string, MatchScore | undefined>;
  result: MatchResult | null;
  tourney: string | null;
};

/** Seconds players have to land a usable score once capture starts. */
export const CAPTURE_WINDOW_MS = 75_000;
/** How long both players have to become ready before the match is called off. */
export const CONNECT_WINDOW_MS = 60_000;
export const COUNTDOWN_MS = 4_000;
