import { redis, K } from "@/lib/server/redis";
import { isValidUsername } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

/** GET /api/face/:username — the player's scan thumbnail as a JPEG. */
export async function GET(_req: Request, { params }: { params: { username: string } }) {
  if (!isValidUsername(params.username)) return new Response(null, { status: 404 });
  const dataUrl = await redis().get<string>(K.face(params.username));
  if (!dataUrl || typeof dataUrl !== "string") return new Response(null, { status: 404 });
  const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return new Response(Buffer.from(b64, "base64"), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=60, stale-while-revalidate=600"
    }
  });
}
