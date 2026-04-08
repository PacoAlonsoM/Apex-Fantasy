import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const ADMIN_BASE_URL = process.env.ADMIN_BASE_URL || "http://127.0.0.1:3000";
const SEASON = Number(process.env.ADMIN_SEASON || 2026) || 2026;
const ROUND = Number(process.env.ADMIN_ROUND || 1) || 1;
const ADMIN_ACCESS_TOKEN = String(process.env.ADMIN_ACCESS_TOKEN || "").trim();
const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || process.env.STINT_ADMIN_EMAIL || "").trim();
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || process.env.STINT_ADMIN_PASSWORD || "").trim();
const SUPABASE_URL = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const SUPABASE_ANON_KEY = String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();

const REQUIRED_RESULT_FIELDS = [
  "winner",
  "p2",
  "p3",
  "pole",
  "fastest_lap",
  "dotd",
  "best_constructor",
];

let cachedAccessTokenPromise = null;

async function getAdminAccessToken() {
  if (!cachedAccessTokenPromise) {
    cachedAccessTokenPromise = (async () => {
      if (ADMIN_ACCESS_TOKEN) return ADMIN_ACCESS_TOKEN;

      if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
        throw new Error(
          "Admin smoke auth is missing. Set ADMIN_ACCESS_TOKEN or ADMIN_EMAIL and ADMIN_PASSWORD in the environment before running npm run smoke:local-admin.",
        );
      }

      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY for admin smoke auth.");
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
      const { data, error } = await supabase.auth.signInWithPassword({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
      });

      if (error || !data?.session?.access_token) {
        throw new Error(error?.message || "Admin smoke could not sign in with the provided admin email/password.");
      }

      return data.session.access_token;
    })();
  }

  return await cachedAccessTokenPromise;
}

async function api(method, path, body = null) {
  const accessToken = await getAdminAccessToken();
  const response = await fetch(`${ADMIN_BASE_URL}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${accessToken}`,
    },
    body: body ? JSON.stringify({ ...body, __authToken: accessToken }) : undefined,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${method} ${path} failed: ${payload?.message || response.statusText}`);
  }

  return payload;
}

function ensurePublishablePayload(roundData) {
  const draftPayload = {
    ...(roundData?.draft?.payload || {}),
  };
  const official = roundData?.official || {};

  REQUIRED_RESULT_FIELDS.forEach((field) => {
    if (!draftPayload[field] && official[field]) {
      draftPayload[field] = official[field];
    }
  });

  if ((!draftPayload.dnf_list || !draftPayload.dnf_list.length) && Array.isArray(official?.dnf_list)) {
    draftPayload.dnf_list = official.dnf_list;
  }

  draftPayload.race_round = ROUND;

  const missing = REQUIRED_RESULT_FIELDS.filter((field) => !draftPayload[field]);
  assert.equal(missing.length, 0, `Round ${ROUND} draft is still missing required publish fields: ${missing.join(", ")}`);

  return {
    ...(roundData?.draft || {}),
    season: SEASON,
    round: ROUND,
    payload: draftPayload,
  };
}

function expectRound(rounds, roundNumber, status) {
  const row = (rounds || []).find((item) => Number(item?.round || 0) === Number(roundNumber));
  assert.ok(row, `Expected round ${roundNumber} to exist on the admin dashboard.`);
  assert.equal(row.status, status, `Expected round ${roundNumber} to be ${status}, got ${row.status || "unknown"}.`);
}

function expectOfficialMatchesDraft(roundData) {
  const official = roundData?.official || {};
  const draft = roundData?.draft?.payload || {};

  assert.ok(official?.results_entered, `Expected round ${ROUND} to be marked as published in race_results.`);
  REQUIRED_RESULT_FIELDS.forEach((field) => {
    assert.equal(
      official[field],
      draft[field],
      `Expected published ${field} to match the saved draft for round ${ROUND}.`
    );
  });
}

async function main() {
  const dashboard = await api("GET", `/api/admin/dashboard?season=${SEASON}`);
  assert.equal(
    dashboard?.dashboard?.capabilities?.hasServiceRole,
    true,
    "The admin dashboard is not seeing SUPABASE_SERVICE_ROLE_KEY locally."
  );
  assert.equal(
    dashboard?.dashboard?.capabilities?.calendarSyncHealthy,
    true,
    "The admin dashboard is not seeing a healthy local schedule-sync capability."
  );

  expectRound(dashboard?.dashboard?.rounds, 4, "cancelled");
  expectRound(dashboard?.dashboard?.rounds, 5, "cancelled");
  assert.match(
    String(dashboard?.dashboard?.currentRound?.name || ""),
    /Miami GP/i,
    "Expected the live admin round to be Miami GP."
  );

  const news = await api("POST", "/api/admin/news/sync", { season: SEASON });
  assert.ok(
    ["ok", "partial"].includes(String(news?.status || "")),
    `Expected news sync to succeed, got status ${news?.status || "unknown"}.`
  );
  assert.ok(
    Number(news?.counts?.upserted || 0) > 0,
    "Expected news sync to upsert at least one article."
  );

  const schedule = await api("POST", "/api/admin/schedule/sync", { season: SEASON });
  assert.equal(
    String(schedule?.status || ""),
    "ok",
    `Expected schedule sync to return ok, got ${schedule?.status || "unknown"}.`
  );
  assert.ok(
    Number(schedule?.counts?.rounds || 0) > 0,
    "Expected schedule sync to update at least one round."
  );

  const history = await api("POST", "/api/admin/history-backfill", { season: SEASON });
  assert.ok(
    ["ok", "partial"].includes(String(history?.status || "")),
    `Expected history backfill to succeed, got status ${history?.status || "unknown"}.`
  );

  const imported = await api("POST", "/api/admin/results/import", { season: SEASON, round: ROUND });
  assert.ok(
    ["ok", "partial"].includes(String(imported?.status || "")),
    `Expected OpenF1 import to succeed, got status ${imported?.status || "unknown"}.`
  );

  const roundData = await api("GET", `/api/admin/results?season=${SEASON}&round=${ROUND}`);
  const draft = ensurePublishablePayload(roundData);
  await api("POST", "/api/admin/results/save-draft", { season: SEASON, round: ROUND, draft });

  const publish = await api("POST", "/api/admin/results/publish", { season: SEASON, round: ROUND });
  assert.ok(
    ["ok", "partial"].includes(String(publish?.status || "")),
    `Expected publish to succeed, got status ${publish?.status || "unknown"}.`
  );

  const afterPublish = await api("GET", `/api/admin/results?season=${SEASON}&round=${ROUND}`);
  expectOfficialMatchesDraft(afterPublish);

  const award = await api("POST", "/api/admin/results/award-points", { season: SEASON, round: ROUND });
  assert.ok(
    ["ok", "partial"].includes(String(award?.status || "")),
    `Expected points award to succeed, got status ${award?.status || "unknown"}.`
  );

  const ai = await api("POST", "/api/admin/ai/generate-brief", { season: SEASON });
  assert.ok(
    ["ok", "partial"].includes(String(ai?.status || "")),
    `Expected AI brief generation to succeed, got status ${ai?.status || "unknown"}.`
  );
  assert.equal(
    String(ai?.mode || ""),
    "openai",
    `Expected the AI brief to use OpenAI mode, got ${ai?.mode || "unknown"}.`
  );
  assert.match(String(ai?.raceName || ""), /Miami GP/i, "Expected the AI brief to target Miami GP.");
  assert.ok(
    Number(ai?.researchSourceCount || 0) > 0,
    "Expected the AI brief to include live web research sources."
  );
  assert.ok(
    String(ai?.model || "").trim() && !/mini/i.test(String(ai?.model || "")),
    `Expected the AI brief to use a full GPT model, got ${ai?.model || "unknown"}.`
  );

  const afterAiDashboard = await api("GET", `/api/admin/dashboard?season=${SEASON}`);
  assert.match(
    String(afterAiDashboard?.dashboard?.latestInsight?.race_name || ""),
    /Miami GP/i,
    "Expected the saved dashboard AI brief to be attached to Miami GP."
  );
  assert.equal(
    String(afterAiDashboard?.dashboard?.latestInsight?.provider || ""),
    "openai",
    `Expected the saved dashboard AI brief provider to be openai, got ${afterAiDashboard?.dashboard?.latestInsight?.provider || "unknown"}.`
  );
  assert.ok(
    Array.isArray(afterAiDashboard?.dashboard?.latestInsight?.metadata?.research_sources)
      && afterAiDashboard.dashboard.latestInsight.metadata.research_sources.length > 0,
    "Expected the saved dashboard AI brief metadata to include live web research sources."
  );

  const repair = await api("POST", "/api/admin/ai/repair-live-data", { season: SEASON });
  assert.ok(
    ["ok", "partial"].includes(String(repair?.status || "")),
    `Expected AI repair to succeed, got status ${repair?.status || "unknown"}.`
  );

  const publicInsight = await fetch(`${ADMIN_BASE_URL}/api/insight?season=${SEASON}`, {
    cache: "no-store",
  }).then(async (response) => {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`GET /api/insight failed: ${payload?.message || response.statusText}`);
    }
    return payload;
  });

  const previousRace = publicInsight?.historicalEdge?.previousRace || publicInsight?.insight?.metadata?.previous_race || null;
  const recentResult = Array.isArray(publicInsight?.historicalEdge?.recentResults)
    ? publicInsight.historicalEdge.recentResults[0] || null
    : null;
  assert.ok(previousRace?.winner, "Expected the public AI payload to expose a canonical previous-race winner.");
  assert.ok(recentResult?.winner, "Expected the public AI payload to expose recent completed results.");
  assert.equal(
    String(previousRace?.winner || ""),
    String(recentResult?.winner || ""),
    "Expected the public AI previous-race winner to match the canonical recent-results winner.",
  );

  console.log("Admin localhost smoke test passed.");
  console.log(`News sync status: ${news.status}`);
  console.log(`Schedule sync status: ${schedule.status}`);
  console.log(`History backfill status: ${history.status}`);
  console.log(`Publish status: ${publish.status}`);
  console.log(`Award points status: ${award.status}`);
  if (Array.isArray(publish?.warnings) && publish.warnings.length) {
    console.log(`Publish warnings: ${publish.warnings.join(" | ")}`);
  }
  console.log(`AI brief target: ${ai.raceName}`);
  console.log(`AI brief mode: ${ai.mode}`);
  console.log(`AI repair status: ${repair.status}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
