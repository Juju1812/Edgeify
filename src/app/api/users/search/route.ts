import { handle, json } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { redis, K } from "@/lib/server/redis";

export const dynamic = "force-dynamic";

/**
 * GET /api/users/search?q=name — exact-match lookup (any account) plus
 * prefix matches among ranked players.
 */
export const GET = handle(async (req: Request) => {
  await requireUser();
  const q = (new URL(req.url).searchParams.get("q") || "").trim().toLowerCase();
  if (!/^[a-z0-9_-]{1,16}$/.test(q)) return json({ results: [] });

  const out = new Set<string>();
  const exact = await redis().hget<string>(K.user(q), "username");
  if (exact) out.add(exact);

  const ranked = await redis().zrange<string[]>(K.leaderboard, 0, 499, { rev: true });
  for (const n of ranked) {
    if (out.size >= 10) break;
    if (n.startsWith(q)) out.add(n);
  }

  // Resolve display casing for ranked prefix hits.
  const names = await Promise.all(
    [...out].map(async (n) => (await redis().hget<string>(K.user(n), "username")) || n)
  );
  return json({ results: [...new Set(names)] });
});
