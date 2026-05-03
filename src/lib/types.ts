export type EdgeScoreBreakdown = {
  symmetry: number;          // 0..1
  jawlineDefinition: number; // 0..1
  canthalTilt: number;       // -1..1 (signed)
  cheekboneProm: number;     // 0..1
  goldenRatio: number;       // 0..1
  faceFat: number;           // 0..1 — facial fullness; higher = more fat
  composite: number;         // 0..100 weighted
};

export type MatchRecord = {
  id: string;
  opponentName: string;
  opponentElo: number;
  myScore: number;
  oppScore: number;
  won: boolean;
  eloDelta: number;
  playedAt: number;          // epoch ms
};

export type UserState = {
  // Identity
  username: string | null;
  authedAt: number | null;
  isOver18: boolean;
  consentedAt: number | null;

  // Calibration / face
  hasScanned: boolean;
  faceDataUrl: string | null;            // base64 of best capture (local-only for now)
  edgeScore: EdgeScoreBreakdown | null;
  hideFromBoard: boolean;

  // Ranking
  elo: number;
  peakElo: number;
  wins: number;
  losses: number;
  streak: number;
  placementsLeft: number;                // 5 → 0
  matchHistory: MatchRecord[];
};

export const DEFAULT_USER: UserState = {
  username: null,
  authedAt: null,
  isOver18: false,
  consentedAt: null,
  hasScanned: false,
  faceDataUrl: null,
  edgeScore: null,
  hideFromBoard: false,
  elo: 800,
  peakElo: 800,
  wins: 0,
  losses: 0,
  streak: 0,
  placementsLeft: 5,
  matchHistory: []
};

export type UserStatus = "guest" | "auth-no-scan" | "calibrating" | "ranked";

export function getStatus(u: UserState): UserStatus {
  if (!u.username) return "guest";
  if (!u.hasScanned) return "auth-no-scan";
  if (u.placementsLeft > 0) return "calibrating";
  return "ranked";
}
