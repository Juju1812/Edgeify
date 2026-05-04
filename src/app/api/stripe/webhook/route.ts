import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getRedis, profileKey } from "@/lib/auth-server";
import { getStripe } from "@/lib/stripe-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/stripe/webhook — receives Stripe subscription events and
 * updates the user's `proUntil` + `stripeCustomerId`. The webhook
 * SECRET must be set in env (`STRIPE_WEBHOOK_SECRET`) so we can
 * verify events; otherwise the endpoint refuses to process.
 *
 * Subscribe in the Stripe dashboard to:
 *   - checkout.session.completed       → first paid session
 *   - customer.subscription.updated    → renewals + plan changes
 *   - customer.subscription.deleted    → cancellations
 */
export async function POST(req: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const redis = getRedis();
  if (!stripe || !secret || !redis) {
    return NextResponse.json(
      { error: "webhook_disabled", message: "Stripe / webhook secret not configured." },
      { status: 503 }
    );
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "no_signature" }, { status: 400 });

  // Read raw body for signature verification — Next 14 gives us
  // a Request whose .text() is the raw body.
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (e: unknown) {
    const err = e as { message?: string };
    // eslint-disable-next-line no-console
    console.warn("[stripe webhook] bad signature:", err.message);
    return NextResponse.json({ error: "bad_signature" }, { status: 400 });
  }

  // In Stripe API 2026-04-22.dahlia, `current_period_end` moved off the
  // Subscription object onto each subscription item. We use the first
  // item's period (we only sell one price).
  function periodEndFromSub(sub: Stripe.Subscription): number | null {
    const item = sub.items?.data?.[0] as
      | (Stripe.SubscriptionItem & { current_period_end?: number })
      | undefined;
    return item?.current_period_end ?? null;
  }

  async function setProUntil(username: string, customerId: string | null, periodEndSec: number | null) {
    const raw = await redis!.get<string | Record<string, unknown>>(profileKey(username));
    const profile: Record<string, unknown> = raw
      ? typeof raw === "string"
        ? JSON.parse(raw)
        : raw
      : {};
    profile.proUntil = periodEndSec ? periodEndSec * 1000 : null;
    if (customerId) profile.stripeCustomerId = customerId;
    await redis!.set(profileKey(username), JSON.stringify(profile), {
      ex: 60 * 60 * 24 * 365
    });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        const username =
          (s.client_reference_id as string | null) ||
          (s.metadata?.edgifyUsername as string | undefined);
        if (!username) break;
        const customerId = typeof s.customer === "string" ? s.customer : null;
        // Pull subscription to get current_period_end
        if (typeof s.subscription === "string") {
          const sub = await stripe.subscriptions.retrieve(s.subscription);
          await setProUntil(username, customerId, periodEndFromSub(sub));
        } else {
          await setProUntil(username, customerId, null);
        }
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const username = (sub.metadata?.edgifyUsername as string | undefined) || null;
        if (!username) break;
        // If the sub is canceled / unpaid / past_due, drop pro.
        const active = sub.status === "active" || sub.status === "trialing";
        const customerId = typeof sub.customer === "string" ? sub.customer : null;
        await setProUntil(
          username,
          customerId,
          active ? periodEndFromSub(sub) : null
        );
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const username = (sub.metadata?.edgifyUsername as string | undefined) || null;
        if (!username) break;
        const customerId = typeof sub.customer === "string" ? sub.customer : null;
        await setProUntil(username, customerId, null);
        break;
      }
      default:
        // Ignore other event types.
        break;
    }
  } catch (e: unknown) {
    const err = e as { message?: string };
    // eslint-disable-next-line no-console
    console.error("[stripe webhook] handler error:", err.message);
    return NextResponse.json(
      { error: "handler_error", message: err.message || "Unknown" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
