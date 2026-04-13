import "server-only";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase admin env vars missing");
  return createClient(url, key);
}

function isMissingWebhookTable(error) {
  return error?.code === "42P01" || /stripe_webhook_events/i.test(String(error?.message || ""));
}

function extractStripeEventRefs(event) {
  const object = event?.data?.object || {};
  const customerId = typeof object.customer === "string"
    ? object.customer
    : object.customer?.id || null;
  const subscriptionId = typeof object.subscription === "string"
    ? object.subscription
    : object.subscription?.id || (String(object?.id || "").startsWith("sub_") ? object.id : null);
  const userId = object?.metadata?.supabase_user_id || object?.client_reference_id || null;

  return { customerId, subscriptionId, userId };
}

export async function reserveStripeWebhookEvent(event) {
  const supabase = getAdminClient();
  const refs = extractStripeEventRefs(event);
  const eventPayload = {
    created: event?.created || null,
    pending_webhooks: event?.pending_webhooks || 0,
    request_id: event?.request?.id || null,
    metadata: event?.data?.object?.metadata || null,
  };

  const { error } = await supabase.from("stripe_webhook_events").insert({
    id: event.id,
    event_type: event.type,
    livemode: Boolean(event.livemode),
    api_version: event.api_version || null,
    status: "received",
    received_at: new Date().toISOString(),
    customer_id: refs.customerId,
    subscription_id: refs.subscriptionId,
    user_id: refs.userId,
    event_payload: eventPayload,
  });

  if (!error) return { duplicate: false, loggingAvailable: true };
  if (error.code === "23505") return { duplicate: true, loggingAvailable: true };
  if (isMissingWebhookTable(error)) {
    console.warn("[stripe_webhook_events] table missing; continuing without event log.");
    return { duplicate: false, loggingAvailable: false };
  }

  throw error;
}

export async function markStripeWebhookEventStatus(eventId, status, errorMessage = null) {
  const supabase = getAdminClient();
  const { error } = await supabase
    .from("stripe_webhook_events")
    .update({
      status,
      processed_at: status === "received" ? null : new Date().toISOString(),
      error_message: errorMessage ? String(errorMessage).slice(0, 500) : null,
    })
    .eq("id", eventId);

  if (error && !isMissingWebhookTable(error)) {
    throw error;
  }
}

/**
 * Returns true if the user has an active Pro subscription.
 * Always called server-side — never trust client-side data.
 *
 * @param {string} userId - Supabase profile id
 * @returns {Promise<boolean>}
 */
export async function requiresPro(userId) {
  if (!userId) return false;
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("subscription_status")
    .eq("id", userId)
    .single();

  if (error || !data) return false;
  return data.subscription_status === "pro";
}

/**
 * Check league creation / join limits for a user.
 * Free users: max 1 created, max 2 total.
 * Pro users: unlimited.
 *
 * @param {string} userId - Supabase profile id
 * @returns {Promise<{ canCreate: boolean, canJoin: boolean, currentCount: number, createdCount: number, isPro: boolean }>}
 */
export async function checkLeagueLimits(userId) {
  const supabase = getAdminClient();

  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("subscription_status").eq("id", userId).single(),
    supabase
      .from("league_members")
      .select("league_id, role")
      .eq("user_id", userId)
      .eq("status", "active"),
  ]);

  const isPro = profile?.subscription_status === "pro";
  const currentCount = memberships?.length ?? 0;
  const createdCount = (memberships ?? []).filter((m) => m.role === "comisionado").length;

  if (isPro) {
    return { canCreate: true, canJoin: true, currentCount, createdCount, isPro: true };
  }

  return {
    canCreate: createdCount < 1,
    canJoin: currentCount < 2,
    currentCount,
    createdCount,
    isPro: false,
  };
}

/**
 * Get the Pro Community League id.
 * Returns null if the league hasn't been seeded yet.
 *
 * @returns {Promise<string|null>}
 */
export async function getProCommunityLeagueId() {
  const supabase = getAdminClient();
  const { data } = await supabase
    .from("leagues")
    .select("id")
    .eq("type", "pro_community")
    .single();
  return data?.id ?? null;
}

/**
 * Enroll a user in the Pro Community League.
 * Called from the Stripe webhook on subscription creation.
 *
 * @param {string} userId
 */
export async function enrollInProLeague(userId) {
  const leagueId = await getProCommunityLeagueId();
  if (!leagueId) return; // Pro league not seeded yet

  const supabase = getAdminClient();

  // Upsert — if previously eliminated (cancelled), re-activate
  const { error } = await supabase.from("league_members").upsert(
    {
      league_id: leagueId,
      user_id:   userId,
      role:      "member",
      status:    "active",
    },
    { onConflict: "league_id,user_id" }
  );

  if (error) {
    console.error("[enrollInProLeague]", error.message);
  }
}

/**
 * Mark a user's Pro Community League membership as eliminated.
 * Called from the Stripe webhook on subscription cancellation.
 *
 * @param {string} userId
 */
export async function removeFromProLeague(userId) {
  const leagueId = await getProCommunityLeagueId();
  if (!leagueId) return;

  const supabase = getAdminClient();
  await supabase
    .from("league_members")
    .update({ status: "eliminated" })
    .eq("league_id", leagueId)
    .eq("user_id", userId);
}

/**
 * Upgrade a user to Pro and enroll in the Pro Community League.
 * Expects the full Stripe subscription + customer data.
 *
 * @param {{ userId: string, stripeCustomerId: string, stripeSubscriptionId: string, subscriptionEnd: Date|null }} opts
 */
export async function activateProSubscription({ userId, stripeCustomerId, stripeSubscriptionId, subscriptionEnd }) {
  const supabase = getAdminClient();

  await supabase.from("profiles").update({
    subscription_status:    "pro",
    subscription_start:     new Date().toISOString(),
    subscription_end:       subscriptionEnd ? subscriptionEnd.toISOString() : null,
    stripe_customer_id:     stripeCustomerId,
    stripe_subscription_id: stripeSubscriptionId,
  }).eq("id", userId);

  await enrollInProLeague(userId);
}

/**
 * Downgrade a user from Pro back to free.
 * Called on subscription cancellation or expiry.
 *
 * @param {string} userId
 */
export async function deactivateProSubscription(userId) {
  const supabase = getAdminClient();

  await supabase.from("profiles").update({
    subscription_status: "free",
    subscription_end:    new Date().toISOString(),
  }).eq("id", userId);

  await removeFromProLeague(userId);
}

/**
 * Extend subscription_end on successful invoice payment.
 *
 * @param {{ stripeCustomerId: string, newEnd: Date }} opts
 */
export async function extendSubscription({ stripeCustomerId, newEnd }) {
  const supabase = getAdminClient();
  await supabase
    .from("profiles")
    .update({ subscription_end: newEnd.toISOString(), subscription_status: "pro" })
    .eq("stripe_customer_id", stripeCustomerId);
}

/**
 * Look up a profile by Stripe customer id.
 *
 * @param {string} stripeCustomerId
 * @returns {Promise<{ id: string, username: string, email?: string }|null>}
 */
export async function getProfileByStripeCustomer(stripeCustomerId) {
  const supabase = getAdminClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, username")
    .eq("stripe_customer_id", stripeCustomerId)
    .single();
  return data ?? null;
}
