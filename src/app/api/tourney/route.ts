import { handle, json } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { createTourney } from "@/lib/server/tourney";
import { rateLimit } from "@/lib/server/ratelimit";

export const dynamic = "force-dynamic";

/** POST /api/tourney — create a 4-player bracket. */
export const POST = handle(async () => {
  const me = await requireUser();
  await rateLimit("tourney", me, 10, 3600);
  return json({ tourney: await createTourney(me) });
});
