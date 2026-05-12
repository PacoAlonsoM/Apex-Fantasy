import "server-only";
import { NextResponse } from "next/server";
import { getStripeClient } from "@/src/lib/stripe";
import {
  BillingRouteError,
  getSiteUrl,
  readJsonBody,
  requireBillingContext,
} from "@/app/api/stripe/_lib/billingBackend";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const body = await readJsonBody(request);
    const { profile } = await requireBillingContext(request, body);

    if (!profile?.stripe_customer_id) {
      return NextResponse.json({ error: "No Stripe customer found for this user" }, { status: 404 });
    }

    const stripe = getStripeClient();
    const siteUrl = getSiteUrl();
    const mode = String(body?.mode || "manage").trim().toLowerCase();

    if (mode === "cancel" && profile?.stripe_subscription_id) {
      try {
        const subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
        if (subscription?.cancel_at_period_end) {
          return NextResponse.json({ url: `${siteUrl}/pro?billing=cancelled` });
        }
      } catch (stripeError) {
        console.warn("[stripe/portal] could not preflight subscription cancellation state:", stripeError.message);
      }
    }

    const session = await stripe.billingPortal.sessions.create(
      mode === "cancel" && profile?.stripe_subscription_id
        ? {
            customer: profile.stripe_customer_id,
            return_url: `${siteUrl}/pro?billing=1`,
            flow_data: {
              type: "subscription_cancel",
              subscription_cancel: {
                subscription: profile.stripe_subscription_id,
              },
              after_completion: {
                type: "redirect",
                redirect: {
                  return_url: `${siteUrl}/pro?billing=cancelled`,
                },
              },
            },
          }
        : {
            customer: profile.stripe_customer_id,
            return_url: `${siteUrl}/pro?billing=1`,
          }
    );

    return NextResponse.json({ url: session.url });
  } catch (err) {
    if (err instanceof BillingRouteError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[stripe/portal]", err.message);
    return NextResponse.json({ error: "Failed to create portal session" }, { status: 500 });
  }
}
