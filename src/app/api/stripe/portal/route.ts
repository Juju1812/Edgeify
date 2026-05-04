import { NextResponse } from "next/server";
import { getRedis, profileKey, sessionKey } from "@/lib/auth-server";
import { getStripe } from "@/lib/stripe-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/stripe/portal → returns a Stripe Customer Portal URL.
 * Lets users manage / cancel their subscription. Session-authed; the
 * user must have a stripeCustomerId on record (set by checkout).
 */
export async function POST(req: Request) {
  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: "stripe_disabled" }, { status: 503 });
  const redis = getRedis();
  if (!redis) return NextResponse.json({ error: "auth_disabled" }, { status: 503 });

  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return NextResponse.json({ error: "no_token" }, { status: 401 });
  const sessRaw = await redis.get<string | { username: string }>(sessionKey(token));
  if (!sessRaw) return NextResponse.json({ error: "invalid_session" }, { status: 401 });
  const sess = typeof sessRaw === "string" ? JSON.parse(sessRaw) : sessRaw;
  const username = String(sess.username);

  const profileRaw = await redis.get<string | Record<string, unknown>>(profileKey(username));
  const profile = profileRaw
    ? typeof profileRaw === "string"
      ? JSON.parse(profileRaw)
      : profileRaw
    : {};
  const customerId = typeof profile.stripeCustomerId === "string" ? profile.stripeCustomerId : null;
  if (!customerId) {
    return NextResponse.json(
      { error: "no_customer", message: "You don't have a subscription yet." },
      { status: 400 }
    );
  }

  const origin = req.headers.get("origin") || "https://edgify.cc";
  try {
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/pricing`
    });
    return NextResponse.json({ url: portal.url });
  } catch (e: unknown) {
    const err = e as { message?: string };
    return NextResponse.json(
      { error: "stripe_error", message: err.message || "Portal failed." },
      { status: 500 }
    );
  }
}
