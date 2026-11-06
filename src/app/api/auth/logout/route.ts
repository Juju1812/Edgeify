import { handle, json } from "@/lib/server/http";
import { endSession } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export const POST = handle(async () => {
  await endSession();
  return json({ ok: true });
});
