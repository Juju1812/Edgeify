import { handle, json } from "@/lib/server/http";
import { redis, K } from "@/lib/server/redis";
import type { LeaderboardRow } from "@/lib/shared/types";
import type { StoredProfile } from "@/lib/server/profile";

export const dynamic = "force-dynamic";

/** GET /api/leaderboard — top 100 by ELO. */
export const GET = handle(async () => {
  const names = await redis().zrange<string[]>(K.leaderboard, 0, 99, { rev: true });
  if (!names.length) return json({ rows: [] });
  const raws = await redis().mget<(StoredProfile | string | null)[]>(...names.map((n) => K.profile(n)));
  const rows: LeaderboardRow[] = [];
  raws.forEach((raw) => {
    const p: StoredProfile | null = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!p) return;
    rows.push({
      rank: rows.length + 1,
      username: p.username,
      elo: p.elo,
      overall: p.score?.overall ?? null,
      wins: p.wins,
      losses: p.losses,
      country: p.country,
      hasFace: p.hasFace
    });
  });
  return json({ rows });
});
