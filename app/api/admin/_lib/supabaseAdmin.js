import "server-only";

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";

let cachedAdminClient = null;
let cachedReadClient = null;
const LOCAL_ADMIN_ENV_PATH = "/Users/franciscoalonso/Code/apex-fantasy/.env.local";
const execFileAsync = promisify(execFile);

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function env(name) {
  return process.env[name] || "";
}

function isLocalRuntime() {
  return !env("VERCEL") && !env("VERCEL_URL");
}

function environmentLabel() {
  return isLocalRuntime() ? `local env (${LOCAL_ADMIN_ENV_PATH})` : "server environment";
}

function missingEnvMessage(variableName, reason, { plural = false } = {}) {
  if (isLocalRuntime()) {
    return `Missing ${variableName} in ${LOCAL_ADMIN_ENV_PATH}. Restart the local dev server after adding ${plural ? "them" : "it"} to enable ${reason}.`;
  }

  return `Missing ${variableName} in the server environment. Add ${plural ? "them" : "it"} to your deployment environment to enable ${reason}.`;
}

function isJwtLike(value) {
  return String(value || "").trim().split(".").length === 3;
}

function missingServiceRoleMessage(reason = "critical admin actions") {
  return missingEnvMessage("SUPABASE_SERVICE_ROLE_KEY", reason);
}

function createSupabaseServerClient(key) {
  const supabaseUrl = env("NEXT_PUBLIC_SUPABASE_URL");

  if (!supabaseUrl || !key) {
    throw new Error(`Missing NEXT_PUBLIC_SUPABASE_URL or a Supabase key in the ${environmentLabel()}.`);
  }

  return createClient(supabaseUrl, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function isServiceRoleConfigured() {
  return Boolean(env("SUPABASE_SERVICE_ROLE_KEY"));
}

export function requireServiceRole(reason = "admin write actions") {
  if (!isServiceRoleConfigured()) {
    throw new Error(missingServiceRoleMessage(reason));
  }
}

export function buildLocalAdminCapabilities() {
  const hasServiceRole = isServiceRoleConfigured();
  const serviceRoleReason = hasServiceRole
    ? ""
    : missingServiceRoleMessage("publishing, scoring, AI brief generation, and AI history backfills");
  const hasCalendarSecret = Boolean(env("CALENDAR_SYNC_SECRET") || env("RACE_RESULTS_SYNC_SECRET"));
  const hasLocalOpenAiKey = Boolean(env("OPENAI_API_KEY"));
  const hasRemoteAiProxy = Boolean(env("RACE_RESULTS_SYNC_SECRET"));
  const canGenerateBrief = hasServiceRole && (hasLocalOpenAiKey || hasRemoteAiProxy);
  const aiExecutionMode = hasLocalOpenAiKey
    ? "local-openai"
    : hasRemoteAiProxy
      ? "remote-openai-proxy"
      : "unavailable";
  const aiExecutionWarning = !hasLocalOpenAiKey && hasRemoteAiProxy
    ? isLocalRuntime()
      ? `AI briefs are currently proxy-backed because OPENAI_API_KEY is missing in ${LOCAL_ADMIN_ENV_PATH}. Add it and restart the local dev server if you want AI generation to remain fully local when Supabase functions are unavailable.`
      : "AI briefs are currently proxy-backed because OPENAI_API_KEY is missing in the server environment."
    : "";
  const generateBriefReason = !hasServiceRole
    ? serviceRoleReason
    : canGenerateBrief
      ? ""
      : missingEnvMessage("OPENAI_API_KEY and RACE_RESULTS_SYNC_SECRET", "AI brief generation", { plural: true });

  const warnings = [];
  if (!hasServiceRole) warnings.push(serviceRoleReason);
  if (aiExecutionWarning) warnings.push(aiExecutionWarning);

  return {
    hasServiceRole,
    hasLocalOpenAiKey,
    hasRemoteAiProxy,
    aiExecutionMode,
    aiExecutionWarning,
    canPublishResults: hasServiceRole,
    publishReason: serviceRoleReason,
    canAwardPoints: hasServiceRole,
    awardPointsReason: serviceRoleReason,
    canGenerateBrief,
    generateBriefReason,
    canBackfillHistory: hasServiceRole,
    backfillHistoryReason: serviceRoleReason,
    calendarSyncHealthy: hasCalendarSecret || hasServiceRole,
    calendarSyncReason: hasCalendarSecret || hasServiceRole
      ? ""
      : isLocalRuntime()
        ? "Schedule sync is missing a local secret. Add CALENDAR_SYNC_SECRET or RACE_RESULTS_SYNC_SECRET for manual localhost syncs."
        : "Schedule sync is missing CALENDAR_SYNC_SECRET or RACE_RESULTS_SYNC_SECRET in the server environment.",
    warnings,
  };
}

export function getSupabaseReadClient() {
  if (cachedReadClient) return cachedReadClient;

  const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = env("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const key = serviceRoleKey || anonKey;

  if (!key) {
    throw new Error(`Missing NEXT_PUBLIC_SUPABASE_ANON_KEY in the ${environmentLabel()}.`);
  }

  cachedReadClient = createSupabaseServerClient(key);
  return cachedReadClient;
}

export function getSupabaseAdmin() {
  if (cachedAdminClient) return cachedAdminClient;

  const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");
  requireServiceRole("server-side admin writes");

  cachedAdminClient = createSupabaseServerClient(serviceRoleKey);
  return cachedAdminClient;
}

function normalizeFunctionErrorMessage(message) {
  const text = String(message || "").trim();
  if (!text) return "Supabase function request failed.";

  if (/missing auth token|invalid auth token|invalid jwt|protected header formatting|invalid token/i.test(text)) {
    return isServiceRoleConfigured()
      ? "Supabase rejected the server-side admin function request. Check SUPABASE_SERVICE_ROLE_KEY and the deployed function auth settings."
      : missingServiceRoleMessage("server-side admin requests");
  }

  return text;
}

function parseFunctionPayload(raw) {
  const text = String(raw || "").trim();
  if (!text) return "";

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function readFunctionErrorMessage(payload, fallback) {
  if (typeof payload === "string") return payload;
  return payload?.error || payload?.message || fallback;
}

async function invokeSupabaseFunctionWithCurl(url, headers, body) {
  const statusMarker = "__APEX_FUNCTION_STATUS__:";
  const args = [
    "-sS",
    "-X",
    "POST",
    url,
    "-H",
    "Accept: application/json",
    "--data-binary",
    JSON.stringify(body || {}),
    "-w",
    `\n${statusMarker}%{http_code}`,
  ];

  Object.entries(headers || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    args.push("-H", `${key}: ${value}`);
  });

  let stdout = "";
  let stderr = "";
  let lastError = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const result = await execFileAsync("curl", args, {
        maxBuffer: 10 * 1024 * 1024,
      });
      stdout = String(result.stdout || "");
      stderr = String(result.stderr || "");
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
      const stderrText = String(error?.stderr || "").trim();
      const looksRetryable = /could not resolve host|timed out|connection reset|failed to connect/i.test(stderrText);

      if (!looksRetryable || attempt === 2) {
        const reason = stderrText
          ? `Curl fallback failed: ${stderrText}`
          : "Curl fallback failed before Supabase returned a response.";
        throw new Error(normalizeFunctionErrorMessage(reason));
      }

      await delay(300 * (attempt + 1));
    }
  }

  if (lastError) {
    throw lastError;
  }
  const output = String(stdout || "");
  const markerIndex = output.lastIndexOf(statusMarker);

  if (markerIndex === -1) {
    throw new Error(String(stderr || "Supabase function request failed."));
  }

  const rawBody = output.slice(0, markerIndex).trim();
  const status = Number(output.slice(markerIndex + statusMarker.length).trim()) || 0;
  const payload = parseFunctionPayload(rawBody);

  if (status < 200 || status >= 300) {
    throw new Error(
      normalizeFunctionErrorMessage(
        readFunctionErrorMessage(payload, `Supabase function failed with ${status || "unknown status"}.`)
      )
    );
  }

  return payload;
}

export async function invokeSupabaseFunction(name, body = {}, options = {}) {
  const supabaseUrl = env("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = env("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL in local env.");
  }

  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  const functionApiKey = serviceRoleKey || anonKey;
  if (functionApiKey && !headers.apikey) {
    headers.apikey = functionApiKey;
  }
  let secretValue = "";

  if (options.secretEnv) {
    secretValue = process.env[options.secretEnv] || "";

    if (!secretValue && options.requireSecret !== false) {
      throw new Error(`Missing ${options.secretEnv} in local env.`);
    }

    if (secretValue) {
      headers[options.secretHeader || "x-sync-secret"] = secretValue;
    }
  }

  const functionAuthToken = String(
    options.authToken
    || (options.preferServiceRoleAuth !== false ? serviceRoleKey : "")
    || (isJwtLike(anonKey) ? anonKey : "")
  ).trim();

  if (functionAuthToken) {
    headers.Authorization = `Bearer ${functionAuthToken}`;
  }

  const functionUrl = `${supabaseUrl}/functions/v1/${name}`;

  try {
    const response = await fetch(functionUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body || {}),
      cache: "no-store",
    });

    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      throw new Error(
        normalizeFunctionErrorMessage(
          readFunctionErrorMessage(payload, `${name} failed with ${response.status}`)
        )
      );
    }

    return payload;
  } catch (error) {
    console.warn(`Supabase function fetch failed for ${name}; retrying with curl.`, error?.message || error);
    return invokeSupabaseFunctionWithCurl(functionUrl, headers, body);
  }
}
