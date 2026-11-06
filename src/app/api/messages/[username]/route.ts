import { handle, HttpError, json, readJson } from "@/lib/server/http";
import { isValidUsername, requireUser } from "@/lib/server/auth";
import { readDms, sendDm } from "@/lib/server/dms";
import { areFriends } from "@/lib/server/social";
import { rateLimit } from "@/lib/server/ratelimit";
import { redis, K } from "@/lib/server/redis";

export const dynamic = "force-dynamic";

type Ctx = { params: { username: string } };

async function resolve(username: string) {
  if (!isValidUsername(username)) throw new HttpError(404, "no_user", "That player doesn't exist.");
  const name = await redis().hget<string>(K.user(username), "username");
  if (!name) throw new HttpError(404, "no_user", "That player doesn't exist.");
  return name;
}

export const GET = handle(async (req: Request, { params }: Ctx) => {
  const me = await requireUser();
  const other = await resolve(params.username);
  const after = Number(new URL(req.url).searchParams.get("after")) || 0;
  return json({ with: other, messages: await readDms(me, other, after) });
});

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const me = await requireUser();
  const other = await resolve(params.username);
  if (!(await areFriends(me, other))) {
    throw new HttpError(403, "not_friends", "You can only message friends.");
  }
  const { text } = await readJson<{ text?: unknown }>(req);
  const clean = typeof text === "string" ? text.trim().slice(0, 1000) : "";
  if (!clean) throw new HttpError(400, "empty", "Message is empty.");
  await rateLimit("dm", me, 30, 60, "Slow down a little.");
  return json({ message: await sendDm(me, other, clean) });
});
