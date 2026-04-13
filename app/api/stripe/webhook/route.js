import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getStripeClient } from "@/src/lib/stripe";
import {
  activateProSubscription,
  deactivateProSubscription,
  extendSubscription,
  getProfileByStripeCustomer,
  markStripeWebhookEventStatus,
  reserveStripeWebhookEvent,
} from "@/src/lib/subscription";
import { sendProWelcomeEmail, sendProCancellationEmail } from "@/src/lib/email";

export const runtime = "nodejs";

// Stripe requires the raw body to verify the signature
export async function POST(request) {
  const sig     = request.headers.get("stripe-signature");
  const secret  = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !secret) {
    return NextResponse.json({ error: "Missing signature or secret" }, { status: 400 });
  }

  let event;
  try {
    const stripe = getStripeClient();
    const rawBody = await request.text();
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    console.error("[stripe/webhook] Signature verification failed:", err.message);
    return NextResponse.json({ error: "Webhook signature invalid" }, { status: 400 });
  }

  try {
    const reservation = await reserveStripeWebhookEvent(event);
    if (reservation.duplicate) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    const outcome = await handleEvent(event);
    await markStripeWebhookEventStatus(event.id, outcome);
    return NextResponse.json({ received: true, status: outcome });
  } catch (err) {
    try {
      if (event?.id) {
        await markStripeWebhookEventStatus(event.id, "failed", err.message);
      }
    } catch (markError) {
      console.error("[stripe/webhook] Could not update webhook log:", markError.message);
    }
    console.error("[stripe/webhook] Handler error:", err.message);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}

async function handleEvent(event) {
  const { type, data } = event;
  const obj = data.object;
  const stripe = getStripeClient();

  switch (type) {
    case "checkout.session.completed": {
      // Map Stripe session → Supabase user
      const userId = obj.metadata?.supabase_user_id;
      if (!userId) { console.warn("[webhook] No supabase_user_id in session metadata"); return; }

      // Retrieve full subscription for period_end
      let subscriptionEnd = null;
      if (obj.subscription) {
        const sub = await stripe.subscriptions.retrieve(obj.subscription);
        subscriptionEnd = new Date(sub.current_period_end * 1000);
      }

      await activateProSubscription({
        userId,
        stripeCustomerId:     obj.customer,
        stripeSubscriptionId: obj.subscription,
        subscriptionEnd,
      });

      // Fetch user email for welcome email
      const supabase = getAdminClient();
      const authUser = await getAuthUser(supabase, userId);
      if (authUser?.email) {
        await sendProWelcomeEmail({ email: authUser.email, username: authUser.username }).catch(console.error);
      }
      return "processed";
    }

    case "invoice.payment_succeeded": {
      // Extend subscription_end on each successful renewal
      const customerId = obj.customer;
      const lines = obj.lines?.data ?? [];
      const periodEnd = lines[0]?.period?.end
        ? new Date(lines[0].period.end * 1000)
        : null;

      if (customerId && periodEnd) {
        await extendSubscription({ stripeCustomerId: customerId, newEnd: periodEnd });
      }
      return "processed";
    }

    case "customer.subscription.updated": {
      const customerId = obj.customer;
      const status     = obj.status; // 'active', 'past_due', 'canceled', etc.

      if (status === "active") {
        // Re-activate if previously lapsed
        const profile = await getProfileByStripeCustomer(customerId);
        if (profile) {
          const periodEnd = obj.current_period_end
            ? new Date(obj.current_period_end * 1000)
            : null;
          await activateProSubscription({
            userId:               profile.id,
            stripeCustomerId:     customerId,
            stripeSubscriptionId: obj.id,
            subscriptionEnd:      periodEnd,
          });
        }
      } else if (["canceled", "unpaid", "past_due"].includes(status)) {
        const profile = await getProfileByStripeCustomer(customerId);
        if (profile) await deactivateProSubscription(profile.id);
      }
      return "processed";
    }

    case "customer.subscription.deleted": {
      const customerId = obj.customer;
      const profile    = await getProfileByStripeCustomer(customerId);

      if (profile) {
        await deactivateProSubscription(profile.id);

        // Cancellation confirmation email
        const supabase = getAdminClient();
        const authUser = await getAuthUser(supabase, profile.id);
        if (authUser?.email) {
          const endsAt = obj.current_period_end
            ? new Date(obj.current_period_end * 1000).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
            : null;
          await sendProCancellationEmail({ email: authUser.email, username: profile.username, endsAt }).catch(console.error);
        }
      }
      return "processed";
    }

    default:
      return "ignored";
  }
}

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

async function getAuthUser(supabase, userId) {
  try {
    const { data: { user } } = await supabase.auth.admin.getUserById(userId);
    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", userId)
      .single();
    return { email: user?.email, username: profile?.username };
  } catch {
    return null;
  }
}
