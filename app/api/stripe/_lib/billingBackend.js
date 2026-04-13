import "server-only";

import { createClient } from "@supabase/supabase-js";

export class BillingRouteError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "BillingRouteError";
    this.status = status;
  }
}

function env(name) {
  return String(process.env[name] || "").trim();
}

export function getSiteUrl() {
  return env("NEXT_PUBLIC_SITE_URL") || "http://localhost:3000";
}

export function getBillingConfig() {
  const monthlyPriceId = env("STRIPE_PRICE_MONTHLY");
  const seasonPriceId = env("STRIPE_PRICE_SEASON");

  return {
    monthlyPriceId,
    seasonPriceId,
    hasSecretKey: Boolean(env("STRIPE_SECRET_KEY")),
    hasWebhookSecret: Boolean(env("STRIPE_WEBHOOK_SECRET")),
    configured: Boolean(monthlyPriceId && seasonPriceId && env("STRIPE_SECRET_KEY")),
  };
}

export function resolvePriceId(plan) {
  const normalizedPlan = String(plan || "monthly").trim().toLowerCase();
  const { monthlyPriceId, seasonPriceId } = getBillingConfig();

  if (normalizedPlan === "monthly" && monthlyPriceId) return monthlyPriceId;
  if (normalizedPlan === "season" && seasonPriceId) return seasonPriceId;

  throw new BillingRouteError("Stripe pricing is not configured for this plan yet.", 503);
}

function getAdminClient() {
  const supabaseUrl = env("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new BillingRouteError("Supabase admin credentials are missing on the server.", 503);
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function readJsonBody(request) {
  const raw = await request.text();
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    throw new BillingRouteError("Request body must be valid JSON.", 400);
  }
}

function readRequestAccessToken(request, body = null) {
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }

  const bodyToken = typeof body?.__authToken === "string" ? body.__authToken.trim() : "";
  return bodyToken;
}

export async function requireBillingContext(request, body = null) {
  const accessToken = readRequestAccessToken(request, body);
  if (!accessToken) {
    throw new BillingRouteError("Sign in again to manage billing.", 401);
  }

  const supabase = getAdminClient();
  const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);

  if (authError || !authData?.user?.id) {
    throw new BillingRouteError("Your session expired. Sign in again to continue.", 401);
  }

  const authUser = authData.user;
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,username,subscription_status,stripe_customer_id,stripe_subscription_id,subscription_end")
    .eq("id", authUser.id)
    .maybeSingle();

  if (profileError) {
    throw new BillingRouteError("Could not load your billing profile.", 500);
  }

  return {
    supabase,
    authUser,
    profile: profile || {
      id: authUser.id,
      username: authUser.user_metadata?.username || "",
      subscription_status: "free",
      stripe_customer_id: null,
      stripe_subscription_id: null,
      subscription_end: null,
    },
  };
}
