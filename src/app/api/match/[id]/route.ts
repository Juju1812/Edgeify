import { handle, json } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { viewMatch } from "@/lib/server/matches";

export const dynamic = "force-dynamic";

/** GET /api/match/:id — match state from my point of view. */
export const GET = handle(async (_req: Request, { params }: { params: { id: string } }) => {
  const me = await requireUser();
  return json({ match: await viewMatch(params.id, me) });
});
