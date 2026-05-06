import { NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

/**
 * GET /api/geo
 *
 * Returns the country code Vercel's edge inferred from the request IP
 * (`x-vercel-ip-country` header). Used by the client to auto-fill the
 * user's countryCode on first load if the user hasn't set one. We
 * never override an explicit user choice.
 *
 * Returns `{ country: null }` when:
 *   - we're running locally (header absent)
 *   - the IP isn't geo-resolvable
 */
export async function GET(req: Request) {
  const country = req.headers.get("x-vercel-ip-country") || null;
  return NextResponse.json({ country }, {
    headers: { "cache-control": "private, max-age=86400" }
  });
}
