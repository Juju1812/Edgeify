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
    // The SDK's default Node HTTP client uses `node:https` directly,
    // which has shown silent failures from Vercel iad1 on the
    // nodejs24.x runtime — every checkout returned StripeConnection-
    // Error with no api.stripe.com call recorded in telemetry. Forcing
    // the fetch-based client routes through Node's built-in undici and
    // works correctly on Node 24.
    httpClient: Stripe.createFetchHttpClient(),
    maxNetworkRetries: 3,
    timeout: 30000
  });
  return _stripe;
}

export const stripeProductsConfigured = () =>
  Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_MONTHLY);
