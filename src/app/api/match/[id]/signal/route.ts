import { handle, HttpError, json, readJson } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { isPlayer, loadMatch } from "@/lib/server/matches";
import { redis, K } from "@/lib/server/redis";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };
const MAX_SDP = 30_000;

/**
 * WebRTC signalling relay (replaces the public PeerJS broker).
 * Host POSTs { kind: "offer" }, guest polls GET ?kind=offer, POSTs the
 * answer, host polls GET ?kind=answer. ICE candidates are bundled in the
 * SDP (non-trickle), so one round trip is enough.
 */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const me = await requireUser();
  const m = await loadMatch(params.id);
  if (!isPlayer(m, me)) throw new HttpError(403, "not_your_match");
  const { kind, sdp } = await readJson<{ kind?: string; sdp?: unknown }>(req);
  const iAmHost = m.players[0].toLowerCase() === me.toLowerCase();
  if (kind !== (iAmHost ? "offer" : "answer")) throw new HttpError(400, "wrong_role");
  if (typeof sdp !== "string" || sdp.length > MAX_SDP) throw new HttpError(400, "bad_sdp");
  await redis().set(K.signal(m.id, kind), sdp, { ex: 600 });
  // A fresh offer invalidates any stale answer (host reconnect).
  if (kind === "offer") await redis().del(K.signal(m.id, "answer"));
  return json({ ok: true });
});

export const GET = handle(async (req: Request, { params }: Ctx) => {
  const me = await requireUser();
  const m = await loadMatch(params.id);
  if (!isPlayer(m, me)) throw new HttpError(403, "not_your_match");
  const kind = new URL(req.url).searchParams.get("kind");
  if (kind !== "offer" && kind !== "answer") throw new HttpError(400, "bad_kind");
  return json({ sdp: (await redis().get<string>(K.signal(m.id, kind))) || null });
});
