import { handle, HttpError, json } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { getRoom, joinRoom } from "@/lib/server/rooms";
import { isRoomCode } from "@/lib/server/lock";

export const dynamic = "force-dynamic";

type Ctx = { params: { code: string } };

function code(params: Ctx["params"]) {
  if (!isRoomCode(params.code)) throw new HttpError(404, "no_room", "That room code doesn't exist.");
  return params.code.toUpperCase();
}

/** GET /api/rooms/:code — host polls this until a guest joins. */
export const GET = handle(async (_req: Request, { params }: Ctx) => {
  await requireUser();
  return json({ room: await getRoom(code(params)) });
});

/** POST /api/rooms/:code — join as the guest; starts the match. */
export const POST = handle(async (_req: Request, { params }: Ctx) => {
  const me = await requireUser();
  return json({ room: await joinRoom(code(params), me) });
});
