import Stripe from "stripe";

let _stripe: Stripe | null | undefined;

export function getStripe(): Stripe | null {
  if (_stripe !== undefined) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    _stripe = null;
    return null;
  }
  _stripe = new Stripe(key, {
    // Use the account's pinned dashboard version rather than a hard-
    // coded one — having SDK type defaults that lead the account's
    // version was suspected of triggering StripeConnectionError on the
    // first call from Vercel iad1 → api.stripe.com.
    // apiVersion intentionally omitted.
    maxNetworkRetries: 3,
    timeout: 30000
  });
  return _stripe;
}

export const stripeProductsConfigured = () =>
  Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_MONTHLY);
