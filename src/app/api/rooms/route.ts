import { handle, json } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { createRoom } from "@/lib/server/rooms";
import { rateLimit } from "@/lib/server/ratelimit";

export const dynamic = "force-dynamic";

/** POST /api/rooms — create a private 1v1 room code. */
export const POST = handle(async () => {
  const me = await requireUser();
  await rateLimit("room", me, 30, 3600);
  return json({ room: await createRoom(me) });
});
