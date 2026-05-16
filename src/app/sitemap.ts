import type { MetadataRoute } from "next";
import { Redis } from "@upstash/redis";

/**
 * Dynamic sitemap — public pages + the top 100 leaderboard profiles
 * so crawlers reach them without needing to follow internal links.
 *
 * Regenerated at build + (revalidate cycle); doesn't need to be
 * realtime — profile rank in search results lags by hours either way.
 */
export const revalidate = 3600;

const BASE = "https://edgify.cc";

const STATIC_PATHS = [
  "/",
  "/leaderboard",
  "/season",
  "/today",
  "/pricing",
  "/whats-new",
  "/touch-grass"
];

async function getTopUsernames(): Promise<string[]> {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return [];
  try {
    const redis = Redis.fromEnv();
    return (
      (await redis.zrange<string[]>("lb:elo:v1", 0, 99, { rev: true })) || []
    );
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const usernames = await getTopUsernames();
  return [
    ...STATIC_PATHS.map((path) => ({
      url: `${BASE}${path}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: path === "/" ? 1.0 : 0.7
    })),
    ...usernames.map((u) => ({
      url: `${BASE}/u/${encodeURIComponent(u)}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.5
    }))
  ];
}
