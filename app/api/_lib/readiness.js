import "server-only";

import { getPublicRuntimeConfigStatus } from "@/src/lib/runtimeConfig";
import { buildLocalAdminCapabilities, getSupabaseReadClient } from "@/app/api/admin/_lib/supabaseAdmin";

const REQUIRED_SERVER_ENV_NAMES = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "RACE_RESULTS_SYNC_SECRET",
];

const REQUIRED_BILLING_ENV_NAMES = [
  "STRIPE_SECRET_KEY",
  "STRIPE_PRICE_MONTHLY",
  "STRIPE_PRICE_SEASON",
  "STRIPE_WEBHOOK_SECRET",
];

function envPresent(name) {
  return String(process.env[name] || "").trim().length > 0;
}

function buildEnvPresence(names) {
  return Object.fromEntries(names.map((name) => [name, envPresent(name)]));
}

function findMissingEnv(names) {
  return names.filter((name) => !envPresent(name));
}

function shortCommit(sha) {
  const value = String(sha || "").trim();
  return value ? value.slice(0, 7) : null;
}

export async function collectReadinessSnapshot() {
  const publicConfig = getPublicRuntimeConfigStatus();
  const adminCapabilities = buildLocalAdminCapabilities();
  const missingServerEnv = findMissingEnv(REQUIRED_SERVER_ENV_NAMES);
  const missingBillingEnv = findMissingEnv(REQUIRED_BILLING_ENV_NAMES);

  const env = {
    public: {
      contractOk: publicConfig.contractOk,
      blockingOk: publicConfig.ok,
      missing: publicConfig.missing,
      presence: publicConfig.presence,
    },
    server: {
      contractOk: missingServerEnv.length === 0,
      missing: missingServerEnv,
      SUPABASE_SERVICE_ROLE_KEY: envPresent("SUPABASE_SERVICE_ROLE_KEY"),
      RACE_RESULTS_SYNC_SECRET: envPresent("RACE_RESULTS_SYNC_SECRET"),
      OPENAI_API_KEY: envPresent("OPENAI_API_KEY"),
      CALENDAR_SYNC_SECRET: envPresent("CALENDAR_SYNC_SECRET"),
      NEWS_INGEST_SECRET: envPresent("NEWS_INGEST_SECRET"),
    },
  };
  const billing = {
    configured: missingBillingEnv.length === 0,
    missing: missingBillingEnv,
    presence: buildEnvPresence(REQUIRED_BILLING_ENV_NAMES),
  };

  const commitSha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA || null;
  const readiness = {
    ok: false,
    app: {
      name: "STINT",
      version: process.env.npm_package_version || null,
      commitSha,
      commitShort: shortCommit(commitSha),
      siteUrl: publicConfig.values.siteUrl,
    },
    env,
    billing,
    supabase: {
      reachable: false,
      message: "",
    },
    admin: {
      hasServiceRole: adminCapabilities.hasServiceRole,
      canPublishResults: adminCapabilities.canPublishResults,
      canGenerateBrief: adminCapabilities.canGenerateBrief,
      canBackfillHistory: adminCapabilities.canBackfillHistory,
      calendarSyncHealthy: adminCapabilities.calendarSyncHealthy,
      aiExecutionMode: adminCapabilities.aiExecutionMode,
      warnings: adminCapabilities.warnings || [],
    },
  };

  try {
    const supabase = getSupabaseReadClient();
    const { error } = await supabase
      .from("race_calendar")
      .select("id", { head: true, count: "exact" })
      .limit(1);

    if (error) {
      readiness.supabase.message = error.message;
    } else {
      readiness.supabase.reachable = true;
      readiness.supabase.message = "Supabase read client reachable.";
    }
  } catch (error) {
    readiness.supabase.message = error instanceof Error ? error.message : "Supabase read client failed.";
  }

  readiness.ok = (
    publicConfig.ok
    && publicConfig.contractOk
    && env.server.contractOk
    && billing.configured
    && readiness.supabase.reachable
  );
  return readiness;
}
