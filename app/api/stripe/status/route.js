import "server-only";

import { NextResponse } from "next/server";
import { getStripeClient } from "@/src/lib/stripe";
import {
  BillingRouteError,
  getBillingConfig,
  requireBillingContext,
} from "@/app/api/stripe/_lib/billingBackend";
import { deactivateProSubscription, syncSubscriptionState } from "@/src/lib/subscription";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    const { profile } = await requireBillingContext(request);
    const config = getBillingConfig();
    const stripe = getStripeClient();

    let billing = {
      subscriptionStatus: profile?.subscription_status || "free",
      hasCustomer: Boolean(profile?.stripe_customer_id),
      hasSubscription: Boolean(profile?.stripe_subscription_id),
      subscriptionEnd: profile?.subscription_end || null,
      cancelAtPeriodEnd: Boolean(profile?.subscription_cancel_at_period_end),
      canceledAt: profile?.subscription_canceled_at || null,
    };

    if (profile?.stripe_subscription_id) {
      try {
        const subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
        const liveStatus = String(subscription?.status || "").toLowerCase();
        const currentPeriodEnd = subscription?.current_period_end
          ? new Date(subscription.current_period_end * 1000)
          : null;
        const cancelAtPeriodEnd = Boolean(subscription?.cancel_at_period_end);
        const canceledAt = subscription?.cancel_at
          ? new Date(subscription.cancel_at * 1000).toISOString()
          : subscription?.canceled_at
            ? new Date(subscription.canceled_at * 1000).toISOString()
            : null;

        if (["active", "trialing", "past_due"].includes(liveStatus)) {
          await syncSubscriptionState({
            stripeCustomerId: profile.stripe_customer_id,
            stripeSubscriptionId: subscription.id,
            subscriptionEnd: currentPeriodEnd,
            cancelAtPeriodEnd,
            canceledAt,
          });

          billing = {
            subscriptionStatus: "pro",
            hasCustomer: Boolean(profile?.stripe_customer_id),
            hasSubscription: true,
            subscriptionEnd: currentPeriodEnd ? currentPeriodEnd.toISOString() : null,
            cancelAtPeriodEnd,
            canceledAt,
          };
        } else if (["canceled", "unpaid", "incomplete_expired"].includes(liveStatus)) {
          await deactivateProSubscription(profile.id);
          billing = {
            subscriptionStatus: "free",
            hasCustomer: Boolean(profile?.stripe_customer_id),
            hasSubscription: false,
            subscriptionEnd: currentPeriodEnd ? currentPeriodEnd.toISOString() : profile?.subscription_end || null,
            cancelAtPeriodEnd: false,
            canceledAt,
          };
        }
      } catch (stripeError) {
        console.warn("[stripe/status] live sync skipped:", stripeError.message);
      }
    }

    return NextResponse.json({
      configured: config.configured,
      prices: {
        monthly: Boolean(config.monthlyPriceId),
        season: Boolean(config.seasonPriceId),
      },
      billing,
    });
  } catch (err) {
    if (err instanceof BillingRouteError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }

    console.error("[stripe/status]", err.message);
    return NextResponse.json({ error: "Failed to read billing status" }, { status: 500 });
  }
}
