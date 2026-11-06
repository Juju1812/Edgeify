import { handle, json } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { leaveQueue, pollQueue, queueSize } from "@/lib/server/queue";

export const dynamic = "force-dynamic";

/** POST /api/match/queue — join the ranked queue, or poll it. */
export const POST = handle(async () => {
  const me = await requireUser();
  const r = await pollQueue(me);
  return json({ ...r, inQueue: await queueSize() });
});

/** DELETE /api/match/queue — stop searching. */
export const DELETE = handle(async () => {
  const me = await requireUser();
  await leaveQueue(me);
  return json({ ok: true });
});
