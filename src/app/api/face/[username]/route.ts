import { redis, K } from "@/lib/server/redis";
import { isValidUsername } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

/** Same colour formula as the client <Avatar> fallback. */
function initialsSvg(username: string) {
  const hue = [...username.toLowerCase()].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  const initials = username.slice(0, 2).toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="50" fill="hsl(${hue} 45% 62%)"/><text x="50" y="50" dy=".35em" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,Inter,Segoe UI,sans-serif" font-size="36" font-weight="600" fill="#fff">${initials}</text></svg>`;
}

/**
 * GET /api/face/:username — the player's scan thumbnail, or a generated
 * initials avatar if they haven't scanned (never a 404, so avatars always load).
 */
export async function GET(_req: Request, { params }: { params: { username: string } }) {
  if (!isValidUsername(params.username)) return new Response(null, { status: 404 });
  const dataUrl = await redis().get<string>(K.face(params.username));
  if (!dataUrl || typeof dataUrl !== "string") {
    return new Response(initialsSvg(params.username), {
      headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=60" }
    });
  }
  const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return new Response(Buffer.from(b64, "base64"), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=60, stale-while-revalidate=600"
    }
  });
}
