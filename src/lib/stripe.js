import "server-only";
import Stripe from "stripe";

let stripeClient = null;

export function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey, {
      apiVersion: "2024-04-10",
      typescript: false,
    });
  }

  return stripeClient;
}

/** Stripe price IDs from env */
export const STRIPE_PRICE_MONTHLY = process.env.STRIPE_PRICE_MONTHLY;
export const STRIPE_PRICE_SEASON  = process.env.STRIPE_PRICE_SEASON;
