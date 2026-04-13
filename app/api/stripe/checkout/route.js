import "server-only";
import { NextResponse } from "next/server";
import { getStripeClient } from "@/src/lib/stripe";
import {
  BillingRouteError,
  getSiteUrl,
  readJsonBody,
  requireBillingContext,
  resolvePriceId,
} from "@/app/api/stripe/_lib/billingBackend";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const body = await readJsonBody(request);
    const plan = String(body.plan || "monthly").trim().toLowerCase();
    const priceId = resolvePriceId(plan);
    const { supabase, authUser, profile } = await requireBillingContext(request, body);

    if (!authUser.email) {
      throw new BillingRouteError("Your account is missing an email address for billing.", 400);
    }

    if (profile?.stripe_subscription_id && profile?.subscription_status === "pro") {
      return NextResponse.json(
        { error: "Your Pro subscription is already active. Open billing to manage it." },
        { status: 409 }
      );
    }

    const siteUrl = getSiteUrl();
    const stripe = getStripeClient();

    let customerId = profile?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: authUser.email,
        metadata: { supabase_user_id: authUser.id },
      });
      customerId = customer.id;

      await supabase
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", authUser.id);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${siteUrl}/pro/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/pro?cancelled=true`,
      metadata: {
        supabase_user_id: authUser.id,
        billing_plan: plan,
      },
      subscription_data: {
        metadata: {
          supabase_user_id: authUser.id,
          billing_plan: plan,
        },
      },
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    if (err instanceof BillingRouteError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[stripe/checkout]", err.message);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
