import { NextResponse } from "next/server";
import { getRedis, profileKey, sessionKey } from "@/lib/auth-server";
import { getStripe } from "@/lib/stripe-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/stripe/checkout
 *
 * Creates a Stripe Checkout session for the authed user and returns
 * the redirect URL. Caller (the /pricing page) opens that URL.
 *
 * On success, we set ?ok=1 on /pricing; Stripe will fire the webhook
 * which is what actually flips the user to Pro.
 */
export async function POST(req: Request) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "stripe_disabled", message: "Stripe isn't configured." },
      { status: 503 }
    );
  }
  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ error: "auth_disabled" }, { status: 503 });
  }

  // Authed user
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return NextResponse.json({ error: "no_token" }, { status: 401 });
  const sessRaw = await redis.get<string | { username: string }>(sessionKey(token));
  if (!sessRaw) return NextResponse.json({ error: "invalid_session" }, { status: 401 });
  const sess = typeof sessRaw === "string" ? JSON.parse(sessRaw) : sessRaw;
  const username = String(sess.username);

  const priceId = process.env.STRIPE_PRICE_MONTHLY;
  if (!priceId) {
    return NextResponse.json(
      { error: "no_price_id", message: "Set STRIPE_PRICE_MONTHLY in env." },
      { status: 503 }
    );
  }

  // Read profile to find existing Stripe customer ID, if any.
  const profileRaw = await redis.get<string | Record<string, unknown>>(
    profileKey(username)
  );
  const profile = profileRaw
    ? typeof profileRaw === "string"
      ? JSON.parse(profileRaw)
      : profileRaw
    : {};
  const existingCustomerId =
    typeof profile.stripeCustomerId === "string" ? profile.stripeCustomerId : undefined;

  const origin = req.headers.get("origin") || "https://edgify.cc";

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      // Reuse customer if we already have one, else let Stripe create one.
      customer: existingCustomerId,
      // Pass username so the webhook knows who to flip to Pro.
      client_reference_id: username,
      metadata: { edgifyUsername: username },
      subscription_data: {
        metadata: { edgifyUsername: username }
      },
      success_url: `${origin}/pricing?ok=1`,
      cancel_url: `${origin}/pricing?cancelled=1`,
      allow_promotion_codes: true
    });

    return NextResponse.json({ url: session.url });
  } catch (e: unknown) {
    const err = e as {
      message?: string;
      type?: string;
      code?: string;
      statusCode?: number;
      raw?: { message?: string };
    };
    // eslint-disable-next-line no-console
    console.error("[stripe checkout] failed", {
      type: err.type,
      code: err.code,
      statusCode: err.statusCode,
      message: err.message,
      rawMessage: err.raw?.message,
      keyPrefix: (process.env.STRIPE_SECRET_KEY || "").slice(0, 7),
      pricePrefix: (process.env.STRIPE_PRICE_MONTHLY || "").slice(0, 8)
    });
    let userMsg = err.message || "Checkout failed.";
    if (err.code === "resource_missing") {
      userMsg =
        "Stripe says STRIPE_PRICE_MONTHLY doesn't exist on the account this STRIPE_SECRET_KEY belongs to. Check that both env vars are from the same Stripe account AND the same mode (both test or both live).";
    } else if (err.statusCode === 401) {
      userMsg =
        "Stripe rejected STRIPE_SECRET_KEY (401 Unauthorized). The key is wrong, has whitespace, or was rotated.";
    }
    return NextResponse.json(
      {
        error: "stripe_error",
        code: err.code,
        type: err.type,
        message: userMsg
      },
      { status: 500 }
    );
  }
}
