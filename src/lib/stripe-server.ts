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
    // Pin a recent stable version so behaviour doesn't change under us.
    apiVersion: "2026-04-22.dahlia"
  });
  return _stripe;
}

export const stripeProductsConfigured = () =>
  Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_MONTHLY);
