import { handle, HttpError, json, readJson } from "@/lib/server/http";
import { isValidUsername, requireUser } from "@/lib/server/auth";
import { redis, K } from "@/lib/server/redis";
import { acceptFriend, removeFriend, requestFriend } from "@/lib/server/social";
import type { StoredProfile } from "@/lib/server/profile";

export const dynamic = "force-dynamic";

export type FriendRow = {
  username: string;
  online: boolean;
  elo: number;
  overall: number | null;
  hasFace: boolean;
  faceAt?: number;
};

async function rows(names: string[]): Promise<FriendRow[]> {
  if (!names.length) return [];
  const [profiles, online] = await Promise.all([
    redis().mget<(StoredProfile | string | null)[]>(...names.map((n) => K.profile(n))),
    redis().mget<(string | null)[]>(...names.map((n) => K.online(n)))
  ]);
  return names
    .map((n, i) => {
      const raw = profiles[i];
      const p: StoredProfile | null = typeof raw === "string" ? JSON.parse(raw) : raw;
      return {
        username: p?.username || n,
        online: !!online[i],
        elo: p?.elo ?? 1000,
        overall: p?.score?.overall ?? null,
        hasFace: !!p?.hasFace,
        faceAt: p?.faceAt
      };
    })
    .sort((a, b) => Number(b.online) - Number(a.online) || a.username.localeCompare(b.username));
}

export const GET = handle(async () => {
  const me = await requireUser();
  const [friends, incoming] = await Promise.all([
    redis().smembers(K.friends(me)),
    redis().smembers(K.friendReqIn(me))
  ]);
  return json({ friends: await rows(friends), incoming: await rows(incoming) });
});

export const POST = handle(async (req: Request) => {
  const me = await requireUser();
  const { action, username } = await readJson<{ action?: string; username?: string }>(req);
  if (!isValidUsername(username)) throw new HttpError(400, "bad_user", "Unknown player.");
  const exists = await redis().hget<string>(K.user(username), "username");
  if (!exists) throw new HttpError(404, "no_user", "That player doesn't exist.");

  if (action === "add") return json({ relation: await requestFriend(me, exists) });
  if (action === "accept") {
    await acceptFriend(me, exists);
    return json({ relation: "friends" });
  }
  if (action === "remove") {
    await removeFriend(me, exists);
    return json({ relation: "none" });
  }
  throw new HttpError(400, "bad_action");
});
