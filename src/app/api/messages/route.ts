import { handle, json } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { conversations } from "@/lib/server/dms";

export const dynamic = "force-dynamic";

/** GET /api/messages — my conversations, newest first. */
export const GET = handle(async () => {
  const me = await requireUser();
  const list = await conversations(me);
  return json({ conversations: list, unread: list.filter((c) => c.unread).length });
});
