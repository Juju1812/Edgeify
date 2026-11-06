import { handle, HttpError, json, readJson } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { isRoomCode } from "@/lib/server/lock";
import { currentMatchFor, getTourney, tourneyAction } from "@/lib/server/tourney";

export const dynamic = "force-dynamic";

type Ctx = { params: { code: string } };

function code(params: Ctx["params"]) {
  if (!isRoomCode(params.code)) throw new HttpError(404, "no_tourney", "That tournament code doesn't exist.");
  return params.code.toUpperCase();
}

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const me = await requireUser();
  const t = await getTourney(code(params));
  return json({ tourney: t, myMatch: currentMatchFor(t, me) });
});

/** POST { action: "join" | "leave" | "start" } */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const me = await requireUser();
  const { action } = await readJson<{ action?: string }>(req);
  const t = await tourneyAction(code(params), me, String(action));
  return json({ tourney: t, myMatch: currentMatchFor(t, me) });
});
