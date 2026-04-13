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
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${getSiteUrl()}/pro`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    if (err instanceof BillingRouteError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[stripe/portal]", err.message);
    return NextResponse.json({ error: "Failed to create portal session" }, { status: 500 });
  }
}
