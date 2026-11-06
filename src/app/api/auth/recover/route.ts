import bcrypt from "bcryptjs";
import { redis, K } from "@/lib/server/redis";
import { handle, HttpError, json, readJson } from "@/lib/server/http";
import { isValidPassword, isValidUsername, startSession } from "@/lib/server/auth";
import { getProfile, toMe } from "@/lib/server/profile";
import { rateLimit } from "@/lib/server/ratelimit";
import { checkRecoveryCode, rotateRecoveryCode } from "@/lib/server/recovery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/recover { username, code, password }
 * Resets the password with the account's recovery code, signs in, and
 * issues a new code (each code works once).
 */
export const POST = handle(async (req: Request) => {
  const { username, code, password } = await readJson<{ username?: string; code?: string; password?: string }>(req);
  const wrong = new HttpError(401, "invalid_code", "That username and recovery code don't match.");
  if (!isValidUsername(username) || typeof code !== "string") throw wrong;
  if (!isValidPassword(password)) throw new HttpError(400, "weak_password", "Use at least 6 characters.");

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  await rateLimit("recover", username, 8, 3600, "Too many attempts. Try again in an hour.");
  await rateLimit("recover-ip", ip, 30, 3600, "Too many attempts. Try again in an hour.");

  if (!(await checkRecoveryCode(username, code))) throw wrong;

  const canonical = (await redis().hget<string>(K.user(username), "username")) || username;
  await redis().hset(K.user(canonical), { passwordHash: await bcrypt.hash(password, 10) });
  const recoveryCode = await rotateRecoveryCode(canonical);
  await startSession(canonical);
  return json({ me: toMe(await getProfile(canonical)), recoveryCode });
});
