import { handle, HttpError, json } from "@/lib/server/http";
import { currentUser, isValidUsername } from "@/lib/server/auth";
import { getProfile, isOnline, onBoard, rankOf, toPublic } from "@/lib/server/profile";
import { friendState } from "@/lib/server/social";

export const dynamic = "force-dynamic";

/** GET /api/users/:username — public profile plus my relationship to them. */
export const GET = handle(async (_req: Request, { params }: { params: { username: string } }) => {
  if (!isValidUsername(params.username)) throw new HttpError(404, "no_user", "That player doesn't exist.");
  const p = await getProfile(params.username);
  const [rank, online, me] = await Promise.all([
    onBoard(p) ? rankOf(p.username) : Promise.resolve(null),
    isOnline(p.username),
    currentUser()
  ]);
  const relation = me ? await friendState(me, p.username) : "none";
  return json({ user: toPublic(p, rank, online), relation });
});
