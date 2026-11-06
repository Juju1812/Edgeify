import { handle, HttpError, json, readJson } from "@/lib/server/http";
import { isValidUsername, requireUser } from "@/lib/server/auth";
import { block, blockedBy, unblock } from "@/lib/server/safety";
import { redis, K } from "@/lib/server/redis";

export const dynamic = "force-dynamic";

/** GET /api/blocks — players I've blocked. */
export const GET = handle(async () => {
  const me = await requireUser();
  const names = await blockedBy(me);
  const display = await Promise.all(names.map(async (n) => (await redis().hget<string>(K.user(n), "username")) || n));
  return json({ blocked: display });
});

/** POST /api/blocks { action: "block" | "unblock", username } */
export const POST = handle(async (req: Request) => {
  const me = await requireUser();
  const { action, username } = await readJson<{ action?: string; username?: string }>(req);
  if (!isValidUsername(username)) throw new HttpError(400, "bad_user", "Unknown player.");
  if (action === "block") await block(me, username);
  else if (action === "unblock") await unblock(me, username);
  else throw new HttpError(400, "bad_action");
  return json({ ok: true });
});
