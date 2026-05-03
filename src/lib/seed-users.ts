/**
 * Inlined leaderboard data — used until a real DB is provisioned.
 * Deterministic output (seeded RNG) so the order is stable across renders.
 */

export type SeedUser = {
  id: string;
  username: string;
  countryCode: string;
  elo: number;
  wins: number;
  losses: number;
  edgeScore: number;
};

const COUNTRIES = ["US", "GB", "CA", "AU", "DE", "FR", "JP", "KR", "BR", "MX", "IN", "NL", "SE", "ES", "IT", "PL", "AR", "PT", "TR", "ZA"];
const NAMES = [
  "ZYZZ", "TROY", "JREMY", "KAVI", "OREN", "MIKO", "LIAM", "AKIRA", "RYU", "DRAGO",
  "FINN", "KAI", "SOLO", "ROMA", "DEX", "BLAZE", "AXEL", "TANK", "VIPER", "JINX",
  "NOVA", "ZEN", "RIO", "TAVO", "KASE", "WULF", "VOID", "EMBER", "RAGE", "FROST",
  "SHADE", "REX", "JET", "ORBIT", "FANG", "COBRA", "ECHO", "FLARE", "GHOST", "HEX",
  "IRON", "JAGER", "KILO", "LYNX", "MAVEN", "NEON", "ONYX", "PRISM", "QUARK", "RIFT"
];

// Mulberry32 — tiny seeded PRNG so output is stable.
function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260503);

function pick<T>(arr: T[]) {
  return arr[Math.floor(rand() * arr.length)];
}

function bellElo() {
  const r = (rand() + rand() + rand()) / 3;
  return Math.round(400 + r * 1600);
}

export const SEED_USERS: SeedUser[] = NAMES.map((name, i) => {
  const elo = bellElo();
  const wins = Math.floor(rand() * 200);
  const losses = Math.floor(rand() * 150);
  const code = Math.floor(rand() * 9000) + 1000;
  return {
    id: `seed-${i}`,
    username: `${name}${code}`,
    countryCode: pick(COUNTRIES),
    elo,
    wins,
    losses,
    edgeScore: 30 + (elo - 400) * 0.04 + rand() * 10
  };
}).sort((a, b) => b.elo - a.elo);

export function findOpponent(myElo: number, exclude: string[] = []): SeedUser {
  // Start with ±100 ELO and widen the band until we find someone.
  let band = 100;
  while (band < 2000) {
    const candidates = SEED_USERS.filter(
      (u) =>
        Math.abs(u.elo - myElo) <= band && !exclude.includes(u.id)
    );
    if (candidates.length > 0) {
      return candidates[Math.floor(Math.random() * candidates.length)];
    }
    band += 100;
  }
  return SEED_USERS[Math.floor(Math.random() * SEED_USERS.length)];
}
