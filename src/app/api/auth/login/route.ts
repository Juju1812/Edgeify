import bcrypt from "bcryptjs";
import { redis, K } from "@/lib/server/redis";
import { handle, HttpError, json, readJson } from "@/lib/server/http";
import { isValidPassword, isValidUsername, startSession } from "@/lib/server/auth";
import { getProfile, toMe } from "@/lib/server/profile";
import { rateLimit } from "@/lib/server/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request) => {
  const { username, password } = await readJson<{ username?: string; password?: string }>(req);
  const wrong = new HttpError(401, "invalid_credentials", "Wrong username or password.");
  if (!isValidUsername(username) || !isValidPassword(password)) throw wrong;

  await rateLimit("login", username, 20, 900, "Too many attempts. Wait 15 minutes and try again.");

  const stored = (await redis().hgetall<Record<string, string>>(K.user(username))) || {};
  if (!stored.passwordHash || !(await bcrypt.compare(password, stored.passwordHash))) throw wrong;

  const canonical = stored.username || username;
  await startSession(canonical);
  return json({ me: toMe(await getProfile(canonical)) });
});
