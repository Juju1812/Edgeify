import "server-only";
import { redis, K } from "./redis";
import { HttpError } from "./http";

export type Relation = "self" | "friends" | "outgoing" | "incoming" | "none" | "blocked";

const lc = (s: string) => s.toLowerCase();

export async function friendState(me: string, other: string): Promise<Relation> {
  if (lc(me) === lc(other)) return "self";
  if (await redis().sismember(K.blocks(me), lc(other))) return "blocked";
  const [isFriend, theyHaveMyReq, iHaveTheirReq] = await Promise.all([
    redis().sismember(K.friends(me), lc(other)),
    redis().sismember(K.friendReqIn(other), lc(me)),
    redis().sismember(K.friendReqIn(me), lc(other))
  ]);
  if (isFriend) return "friends";
  if (theyHaveMyReq) return "outgoing";
  if (iHaveTheirReq) return "incoming";
  return "none";
}

export async function areFriends(a: string, b: string) {
  return (await redis().sismember(K.friends(a), lc(b))) === 1;
}

/** Send a request, or accept if they already asked me. */
export async function requestFriend(me: string, other: string): Promise<Relation> {
  const state = await friendState(me, other);
  if (state === "self") throw new HttpError(400, "self", "That's you.");
  if (state === "blocked") throw new HttpError(403, "blocked", "Unblock them first.");
  if (state === "friends" || state === "outgoing") return state;
  const [iBlocked, theyBlocked] = await Promise.all([
    redis().sismember(K.blocks(me), lc(other)),
    redis().sismember(K.blocks(other), lc(me))
  ]);
  if (iBlocked) throw new HttpError(403, "blocked", "Unblock them first.");
  if (theyBlocked) throw new HttpError(403, "blocked", "You can't add this player.");
  if (state === "incoming") {
    await acceptFriend(me, other);
    return "friends";
  }
  const pending = await redis().scard(K.friendReqIn(other));
  if (pending > 200) throw new HttpError(429, "too_many", "They have too many pending requests.");
  await redis().sadd(K.friendReqIn(other), lc(me));
  return "outgoing";
}

export async function acceptFriend(me: string, other: string) {
  const had = await redis().srem(K.friendReqIn(me), lc(other));
  if (!had) throw new HttpError(404, "no_request", "No request from that player.");
  await Promise.all([redis().sadd(K.friends(me), lc(other)), redis().sadd(K.friends(other), lc(me))]);
}

/** Remove a friend, cancel my request, or decline theirs. */
export async function removeFriend(me: string, other: string) {
  await Promise.all([
    redis().srem(K.friends(me), lc(other)),
    redis().srem(K.friends(other), lc(me)),
    redis().srem(K.friendReqIn(other), lc(me)),
    redis().srem(K.friendReqIn(me), lc(other))
  ]);
}
