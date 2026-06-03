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
  syncSubscriptionState,
} from "@/src/lib/subscription";
import {
  sendProWelcomeEmail,
  sendProReceiptEmail,
  sendProCancellationEmail,
} from "@/src/lib/email";

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
        await activateProSubscription({
          userId,
          stripeCustomerId:     obj.customer,
          stripeSubscriptionId: obj.subscription,
          subscriptionEnd,
          cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
          canceledAt: sub.cancel_at ? new Date(sub.cancel_at * 1000) : null,
        });
      } else {
        await activateProSubscription({
          userId,
          stripeCustomerId:     obj.customer,
          stripeSubscriptionId: obj.subscription,
          subscriptionEnd,
        });
      }

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
      const firstLine = lines[0];
      const periodEnd = firstLine?.period?.end
        ? new Date(firstLine.period.end * 1000)
        : null;

      if (customerId && periodEnd) {
        await extendSubscription({ stripeCustomerId: customerId, newEnd: periodEnd });
      }

      // Only send receipt on renewal cycles. Skip initial subscription_create
      // (handled by pro_welcome on checkout.session.completed) and other reasons
      // like manual invoices.
      if (obj.billing_reason === "subscription_cycle" && customerId) {
        const profile = await getProfileByStripeCustomer(customerId);
        if (profile) {
          const supabase = getAdminClient();
          const authUser = await getAuthUser(supabase, profile.id);
          if (authUser?.email) {
            const nextBillingDate = periodEnd
              ? periodEnd.toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })
              : null;
            await sendProReceiptEmail({
              email: authUser.email,
              username: authUser.username,
              amount: (obj.amount_paid ?? 0) / 100,
              currency: obj.currency || "usd",
              billingPeriodLabel: deriveBillingPeriodLabel(obj),
              nextBillingDate,
              invoiceUrl: obj.hosted_invoice_url,
            }).catch(console.error);
          }
        }
      }
      return "processed";
    }

    case "customer.subscription.updated": {
      const customerId = obj.customer;
      const status     = obj.status; // 'active', 'past_due', 'canceled', etc.
      const periodEnd = obj.current_period_end
        ? new Date(obj.current_period_end * 1000)
        : null;
      const cancelAtPeriodEnd = Boolean(obj.cancel_at_period_end);
      const canceledAt = obj.cancel_at
        ? new Date(obj.cancel_at * 1000)
        : obj.canceled_at
          ? new Date(obj.canceled_at * 1000)
          : null;

      if (["active", "trialing", "past_due"].includes(status)) {
        // Keep Pro active while Stripe still considers the subscription live,
        // even if it is scheduled to cancel at the end of the period.
        const profile = await getProfileByStripeCustomer(customerId);
        if (profile) {
          await syncSubscriptionState({
            stripeCustomerId: customerId,
            stripeSubscriptionId: obj.id,
            subscriptionEnd: periodEnd,
            cancelAtPeriodEnd,
            canceledAt,
          });
        }
      } else if (["canceled", "unpaid", "incomplete_expired"].includes(status)) {
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

/**
 * Derive a human-friendly billing period label from a Stripe invoice.
 * Prefers price metadata (e.g. metadata.period_label), then falls back to
 * the line's recurring interval, then to the period length in days.
 */
function deriveBillingPeriodLabel(invoice) {
  const line = invoice?.lines?.data?.[0];
  if (!line) return "Monthly";

  const price = line.price ?? line.plan ?? null;
  const metaLabel =
    price?.metadata?.period_label ||
    price?.metadata?.billing_period_label ||
    line.metadata?.period_label;
  if (metaLabel) return metaLabel;

  const interval = price?.recurring?.interval || price?.interval;
  const intervalCount = price?.recurring?.interval_count || price?.interval_count || 1;
  if (interval) {
    if (interval === "month" && intervalCount === 1) return "Monthly";
    if (interval === "year"  && intervalCount === 1) return "Annual";
    if (interval === "week"  && intervalCount === 1) return "Weekly";
    if (interval === "day"   && intervalCount === 1) return "Daily";
    return `Every ${intervalCount} ${interval}${intervalCount === 1 ? "" : "s"}`;
  }

  const start = line.period?.start;
  const end   = line.period?.end;
  if (start && end) {
    const days = Math.round((end - start) / 86400);
    if (days >= 300) return "Season";
    if (days >= 28 && days <= 31) return "Monthly";
    return `${days} days`;
  }

  return "Monthly";
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
