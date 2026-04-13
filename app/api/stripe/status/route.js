import "server-only";

import { NextResponse } from "next/server";
import {
  BillingRouteError,
  getBillingConfig,
  requireBillingContext,
} from "@/app/api/stripe/_lib/billingBackend";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    const { profile } = await requireBillingContext(request);
    const config = getBillingConfig();

    return NextResponse.json({
      configured: config.configured,
      prices: {
        monthly: Boolean(config.monthlyPriceId),
        season: Boolean(config.seasonPriceId),
      },
      billing: {
        subscriptionStatus: profile?.subscription_status || "free",
        hasCustomer: Boolean(profile?.stripe_customer_id),
        hasSubscription: Boolean(profile?.stripe_subscription_id),
        subscriptionEnd: profile?.subscription_end || null,
      },
    });
  } catch (err) {
    if (err instanceof BillingRouteError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }

    console.error("[stripe/status]", err.message);
    return NextResponse.json({ error: "Failed to read billing status" }, { status: 500 });
  }
}
