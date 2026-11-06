import { handle, json } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

const STUN: RTCIceServer[] = [{ urls: ["stun:stun.cloudflare.com:3478", "stun:stun.l.google.com:19302"] }];

/**
 * GET /api/turn — ICE servers for the match video link.
 *
 * Without a TURN relay, players behind strict NATs (mobile data, campus and
 * office Wi-Fi, many home routers) can never connect — that is what broke
 * v1. Set CLOUDFLARE_TURN_KEY_ID + CLOUDFLARE_TURN_API_TOKEN to enable
 * Cloudflare's relay; short-lived credentials are minted per request.
 */
export const GET = handle(async () => {
  await requireUser();
  const keyId = process.env.CLOUDFLARE_TURN_KEY_ID;
  const token = process.env.CLOUDFLARE_TURN_API_TOKEN;
  if (!keyId || !token) return json({ iceServers: STUN, relay: false });

  const base = `https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials`;
  for (const path of ["generate-ice-servers", "generate"]) {
    try {
      const r = await fetch(`${base}/${path}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ttl: 60 * 60 * 4 }),
        cache: "no-store"
      });
      if (!r.ok) continue;
      const data = (await r.json()) as { iceServers?: RTCIceServer | RTCIceServer[] };
      if (!data.iceServers) continue;
      const servers = Array.isArray(data.iceServers) ? data.iceServers : [data.iceServers];
      return json({ iceServers: [...STUN, ...servers], relay: true });
    } catch (e) {
      console.error("TURN credential fetch failed", e);
    }
  }
  return json({ iceServers: STUN, relay: false });
});
