import "server-only";
import { redis, K } from "./redis";
import { HttpError } from "./http";
import {
  normalizeTraits,
  DEFAULT_OVERLAY_COLOR,
  PLACEMENT_MATCHES,
  START_ELO,
  type MeProfile,
  type PublicProfile,
  type Reading,
  type Score
} from "@/lib/shared/types";

/** Stored shape. Server-authoritative: clients never write these fields directly. */
export type StoredProfile = MeProfile & { readings: Reading[] };

const MAX_READINGS = 5;

function blank(username: string): StoredProfile {
  return {
    username,
    createdAt: Date.now(),
    elo: START_ELO,
    peakElo: START_ELO,
    wins: 0,
    losses: 0,
    draws: 0,
    streak: 0,
    placementsLeft: PLACEMENT_MATCHES,
    score: null,
    readings: [],
    hasFace: false,
    bio: "",
    country: "",
    showOnBoard: true,
    overlayColor: DEFAULT_OVERLAY_COLOR
  };
}

function parse<T>(raw: unknown): T | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
  return raw as T;
}

/**
 * Load a profile, creating it on first touch. v1 accounts carry over their
 * record (wins/losses/bio/country) but not the old geometry score, which was
 * meaningless — they rescan. ELO is reset to the new baseline because the
 * old one was seeded from that score.
 */
export async function getProfile(username: string): Promise<StoredProfile> {
  const existing = parse<StoredProfile>(await redis().get(K.profile(username)));
  if (existing) return existing;

  const exists = await redis().hget<string>(K.user(username), "username");
  if (!exists) throw new HttpError(404, "no_user", "That player doesn't exist.");

  const p = blank(exists);
  const legacy = parse<Record<string, unknown>>(await redis().get(K.legacyProfile(username)));
  if (legacy) {
    p.wins = Number(legacy.wins) || 0;
    p.losses = Number(legacy.losses) || 0;
    p.bio = typeof legacy.bio === "string" ? legacy.bio.slice(0, 140) : "";
    p.country = typeof legacy.countryCode === "string" ? legacy.countryCode.slice(0, 2) : "";
  }
  await saveProfile(p);
  return p;
}

export async function saveProfile(p: StoredProfile) {
  await redis().set(K.profile(p.username), JSON.stringify(p));
  await syncLeaderboard(p);
}

export function onBoard(p: StoredProfile) {
  return !!p.score && p.placementsLeft <= 0 && p.showOnBoard;
}

export async function syncLeaderboard(p: StoredProfile) {
  if (onBoard(p)) await redis().zadd(K.leaderboard, { score: p.elo, member: p.username.toLowerCase() });
  else await redis().zrem(K.leaderboard, p.username.toLowerCase());
}

export function toMe(p: StoredProfile): MeProfile {
  const { readings: _r, ...me } = p;
  // Profiles created before a field existed get its default.
  return {
    ...me,
    overlayColor: me.overlayColor || DEFAULT_OVERLAY_COLOR,
    score: me.score ? { ...me.score, traits: normalizeTraits(me.score.traits) } : null
  };
}

export function toPublic(p: StoredProfile, rank: number | null, online: boolean): PublicProfile {
  return {
    username: p.username,
    elo: p.elo,
    peakElo: p.peakElo,
    wins: p.wins,
    losses: p.losses,
    draws: p.draws,
    bio: p.bio,
    country: p.country,
    hasFace: p.hasFace,
    faceAt: p.faceAt,
    overall: p.score?.overall ?? null,
    traits: p.score ? normalizeTraits(p.score.traits) : null,
    headline: p.score?.headline ?? null,
    sex: p.score?.sex ?? null,
    rank,
    online
  };
}

/**
 * Set the profile score from a new scan. The score is exactly what the most
 * recent scan said — no averaging. (Match readings don't touch it.)
 */
export function setScanScore(
  p: StoredProfile,
  reading: Reading,
  text: Pick<Score, "headline" | "strengths" | "improvements" | "confidence"> & { sex?: Score["sex"] }
) {
  p.readings = [...p.readings, reading].slice(-MAX_READINGS); // kept as history only
  p.score = {
    overall: reading.overall,
    traits: normalizeTraits(reading.traits),
    readings: 1,
    updatedAt: reading.at,
    ...text,
    sex: text.sex ?? p.score?.sex
  };
}

export async function isOnline(username: string) {
  return (await redis().exists(K.online(username))) === 1;
}

export async function rankOf(username: string): Promise<number | null> {
  const r = await redis().zrevrank(K.leaderboard, username.toLowerCase());
  return r === null ? null : r + 1;
}
