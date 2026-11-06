import { handle, HttpError, json, readJson } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { leaveMatch, markReady, viewMatch } from "@/lib/server/matches";

export const dynamic = "force-dynamic";

/** POST /api/match/:id/action { action: "ready" | "leave" } */
export const POST = handle(async (req: Request, { params }: { params: { id: string } }) => {
  const me = await requireUser();
  const { action } = await readJson<{ action?: string }>(req);
  if (action === "ready") await markReady(params.id, me);
  else if (action === "leave") await leaveMatch(params.id, me);
  else throw new HttpError(400, "bad_action");
  return json({ match: await viewMatch(params.id, me) });
});
