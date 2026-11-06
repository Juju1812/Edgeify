import bcrypt from "bcryptjs";
import { redis, K } from "@/lib/server/redis";
import { handle, HttpError, json, readJson } from "@/lib/server/http";
import { isValidPassword, isValidUsername, startSession } from "@/lib/server/auth";
import { getProfile, toMe } from "@/lib/server/profile";
import { rateLimit } from "@/lib/server/ratelimit";
import { rotateRecoveryCode } from "@/lib/server/recovery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request) => {
  const { username, password, isOver18 } = await readJson<{
    username?: string;
    password?: string;
    isOver18?: boolean;
  }>(req);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  await rateLimit("signup", ip, 10, 3600, "Too many sign-ups from this network. Try again later.");

  if (!isValidUsername(username)) {
    throw new HttpError(400, "invalid_username", "Usernames are 2–16 letters, numbers, _ or -.");
  }
  if (!isValidPassword(password)) {
    throw new HttpError(400, "weak_password", "Use at least 6 characters.");
  }
  if (isOver18 !== true) {
    throw new HttpError(400, "underage", "You must be 18 or older to use Edgify.");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  // HSETNX on the username field makes the claim atomic.
  const claimed = await redis().hsetnx(K.user(username), "username", username);
  if (!claimed) throw new HttpError(409, "username_taken", "That username is taken.");
  await redis().hset(K.user(username), { passwordHash, createdAt: String(Date.now()) });

  const recoveryCode = await rotateRecoveryCode(username);
  await startSession(username);
  return json({ me: toMe(await getProfile(username)), recoveryCode });
});
