import bcrypt from "bcryptjs";
import { redis, K } from "@/lib/server/redis";
import { handle, HttpError, json, readJson } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { rateLimit } from "@/lib/server/ratelimit";
import { rotateRecoveryCode } from "@/lib/server/recovery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — whether this account has a recovery code set. */
export const GET = handle(async () => {
  const me = await requireUser();
  return json({ hasCode: !!(await redis().hget<string>(K.user(me), "recoveryHash")) });
});

/** POST { password } — issue a new recovery code (re-confirms the password). */
export const POST = handle(async (req: Request) => {
  const me = await requireUser();
  const { password } = await readJson<{ password?: string }>(req);
  await rateLimit("newcode", me, 10, 3600);
  const hash = await redis().hget<string>(K.user(me), "passwordHash");
  if (typeof password !== "string" || !hash || !(await bcrypt.compare(password, hash))) {
    throw new HttpError(401, "wrong_password", "That password isn't right.");
  }
  return json({ recoveryCode: await rotateRecoveryCode(me) });
});
