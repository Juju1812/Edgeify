import { handle, HttpError, json, readJson } from "@/lib/server/http";
import { currentUser, requireUser } from "@/lib/server/auth";
import { getProfile, saveProfile, toMe } from "@/lib/server/profile";
import { redis, K } from "@/lib/server/redis";

export const dynamic = "force-dynamic";

/** GET /api/me — the signed-in profile, or { me: null }. Also a presence heartbeat. */
export const GET = handle(async () => {
  const u = await currentUser();
  if (!u) return json({ me: null });
  await redis().set(K.online(u), "1", { ex: 75 });
  return json({ me: toMe(await getProfile(u)) });
});

/** PATCH /api/me — the only fields a user may edit themselves. */
export const PATCH = handle(async (req: Request) => {
  const u = await requireUser();
  const body = await readJson<{ bio?: unknown; country?: unknown; showOnBoard?: unknown }>(req);
  const p = await getProfile(u);

  if (body.bio !== undefined) {
    if (typeof body.bio !== "string") throw new HttpError(400, "bad_bio");
    p.bio = body.bio.replace(/\s+/g, " ").trim().slice(0, 140);
  }
  if (body.country !== undefined) {
    if (typeof body.country !== "string" || !/^([A-Z]{2})?$/.test(body.country)) {
      throw new HttpError(400, "bad_country");
    }
    p.country = body.country;
  }
  if (body.showOnBoard !== undefined) p.showOnBoard = body.showOnBoard === true;

  await saveProfile(p);
  return json({ me: toMe(p) });
});
