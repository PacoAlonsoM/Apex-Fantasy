import { jsonOk } from "../../_lib/response";
import { adminAccessErrorResponse, requireAdminRequest } from "../../_lib/localAdminAccess";
import { getSupabaseAdmin, requireServiceRole } from "../../_lib/supabaseAdmin";
import { wcCodeForExternalName } from "@/src/constants/wc/teams";
import { scoreWcMatchPrediction, normalizeScorerName } from "@/src/lib/wc/scoring";
import { rescoreSurvivorPicksForMatch } from "@/src/lib/wc/survivor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The sync route is reached by:
//   1. The admin UI (Bearer token from the signed-in admin's session)
//   2. The Vercel cron schedule (vercel.json) — Vercel signs the request with
//      its CRON_SECRET, surfaced as the `x-vercel-cron-signature` header in
//      production. We also accept an explicit `WC_CRON_SECRET` for external
//      pingers (uptime monitors, manual cron, etc).
function isCronRequest(request) {
  const url = new URL(request.url);
  if (url.searchParams.get("cron") === "1") return true;
  if (request.headers.get("x-vercel-cron") === "1") return true;
  if (request.headers.get("x-vercel-cron-signature")) return true;
  return false;
}

function hasValidCronSecret(request) {
  const expected = String(process.env.WC_CRON_SECRET || "").trim();
  if (!expected) return false;
  const auth = request.headers.get("authorization") || "";
  if (auth === `Bearer ${expected}`) return true;
  const headerSecret = request.headers.get("x-wc-cron-secret") || "";
  return headerSecret === expected;
}

async function authorize(request, body) {
  if (isCronRequest(request) || hasValidCronSecret(request)) return { cron: true };
  await requireAdminRequest(request, body);
  return { cron: false };
}

// TheSportsDB is the free, no-key source we use to bootstrap real WC 2026
// fixtures. The league id 4429 is "FIFA World Cup" and the season key is
// "2026". The feed grows as FIFA confirms more fixtures.
const SOURCE_NAME = "TheSportsDB";
const SOURCE_URL = "https://www.thesportsdb.com/api/v1/json/3/eventsseason.php?id=4429&s=2026";

function normalizeDate(value) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function normalizeScore(value) {
  if (value === null || value === undefined || value === "") return null;
  const next = Number(value);
  return Number.isInteger(next) && next >= 0 && next <= 99 ? next : null;
}

function externalStatusToLocal(status) {
  const text = String(status || "").toLowerCase();
  if (!text) return null;
  if (/finished|finished|ft|full[- ]?time|complete|aet|pen/.test(text)) return "completed";
  if (/postponed|cancelled|canceled|abandoned/.test(text)) return "cancelled";
  if (/half[- ]?time|live|in[- ]?play|1st|2nd|et\b/.test(text)) return "live";
  if (/not started|scheduled|tbd|tba/.test(text)) return "scheduled";
  return null;
}

// TheSportsDB goal-details strings come in semicolon-separated tokens like
// "Mbappé:23';Griezmann:78'" or "23':Mbappé;78':Griezmann" depending on the
// event. For each token we split on ":" and treat the non-numeric side as
// the scorer name. Names are normalized to a single lowercase last-name
// token so picks match feed entries even with accents/first names.
function parseGoalDetails(value) {
  if (!value || typeof value !== "string") return [];
  return value.split(";")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => {
      const parts = segment.split(":").map((part) => part.trim()).filter(Boolean);
      if (!parts.length) return null;
      const nameToken = parts.find((part) => /[a-z]/i.test(part)) || parts[0];
      return normalizeScorerName(nameToken);
    })
    .filter(Boolean);
}

function scorersFromEvent(event) {
  const home = parseGoalDetails(event?.strHomeGoalDetails);
  const away = parseGoalDetails(event?.strAwayGoalDetails);
  if (!home.length && !away.length) return null;
  return { home, away };
}

function sameScorers(left, right) {
  if (!left && !right) return true;
  if (!left || !right) return false;
  const sideMatches = (a, b) => {
    const x = Array.isArray(a) ? a : [];
    const y = Array.isArray(b) ? b : [];
    if (x.length !== y.length) return false;
    return x.every((value, index) => value === y[index]);
  };
  return sideMatches(left.home, right.home) && sideMatches(left.away, right.away);
}

function pickTimestamp(event) {
  return normalizeDate(event.strTimestamp || event.strTimestampUTC)
    || (event.dateEvent && event.strTime ? normalizeDate(`${event.dateEvent}T${event.strTime}Z`) : null)
    || (event.dateEvent ? normalizeDate(`${event.dateEvent}T19:00:00Z`) : null);
}

async function fetchExternalEvents() {
  let response;
  try {
    response = await fetch(SOURCE_URL, { cache: "no-store", signal: AbortSignal.timeout(12000) });
  } catch (error) {
    throw new Error(`Could not reach ${SOURCE_NAME}: ${error.message || "network error"}.`);
  }
  if (!response.ok) {
    throw new Error(`${SOURCE_NAME} returned HTTP ${response.status}.`);
  }
  const payload = await response.json().catch(() => null);
  return Array.isArray(payload?.events) ? payload.events : [];
}

async function performSync(supabase, { invokedBy }) {
  const events = await fetchExternalEvents();

  const { data: groupMatches, error: groupError } = await supabase
    .from("wc_matches")
    .select("*")
    .eq("stage", "group");
  if (groupError) throw groupError;

  const matchByPair = new Map();
  (groupMatches || []).forEach((match) => {
    if (!match.home_team_code || !match.away_team_code) return;
    matchByPair.set(`${match.home_team_code}|${match.away_team_code}`, match);
  });

  const updated = [];
  const skipped = [];
  let completedScored = 0;

  for (const event of events) {
    const homeCode = wcCodeForExternalName(event.strHomeTeam);
    const awayCode = wcCodeForExternalName(event.strAwayTeam);
    if (!homeCode || !awayCode) {
      skipped.push({ event: event.strEvent || event.idEvent, reason: "Unknown team name" });
      continue;
    }
    const localMatch = matchByPair.get(`${homeCode}|${awayCode}`)
      || matchByPair.get(`${awayCode}|${homeCode}`);
    if (!localMatch) {
      skipped.push({ event: event.strEvent || event.idEvent, reason: "No matching group fixture" });
      continue;
    }

    const kickoff = pickTimestamp(event);
    const homeScore = normalizeScore(event.intHomeScore);
    const awayScore = normalizeScore(event.intAwayScore);
    const status = externalStatusToLocal(event.strStatus);

    const patch = { updated_at: new Date().toISOString() };
    if (kickoff && kickoff !== localMatch.kickoff_at) {
      patch.kickoff_at = kickoff;
      patch.lock_at = kickoff;
    }
    if (event.strVenue && event.strVenue !== localMatch.venue) {
      patch.venue = event.strVenue;
    }
    if (homeScore !== null && homeScore !== localMatch.home_score) {
      patch.home_score = homeScore;
    }
    if (awayScore !== null && awayScore !== localMatch.away_score) {
      patch.away_score = awayScore;
    }
    if (status && status !== localMatch.status) {
      patch.status = status;
    }

    const eventScorers = scorersFromEvent(event);
    if (eventScorers && !sameScorers(eventScorers, localMatch.scorers)) {
      patch.scorers = eventScorers;
    }
    if (patch.status === "completed" && patch.home_score === undefined && patch.away_score === undefined && localMatch.home_score === null) {
      delete patch.status;
    }
    if (patch.status === "completed" || (localMatch.status === "completed" && patch.home_score !== undefined)) {
      const finalHome = patch.home_score ?? localMatch.home_score;
      const finalAway = patch.away_score ?? localMatch.away_score;
      if (finalHome !== null && finalAway !== null && finalHome !== finalAway) {
        const winnerCode = finalHome > finalAway ? localMatch.home_team_code : localMatch.away_team_code;
        if (winnerCode !== localMatch.winner_team_code) {
          patch.winner_team_code = winnerCode;
        }
      }
    }

    const meaningfulChange = Object.keys(patch).some((key) => key !== "updated_at");
    if (!meaningfulChange) {
      skipped.push({ event: event.strEvent, reason: "Already up to date" });
      continue;
    }

    const { data: nextMatch, error: updateError } = await supabase
      .from("wc_matches")
      .update(patch)
      .eq("id", localMatch.id)
      .select("*")
      .single();
    if (updateError) throw updateError;
    updated.push({ matchNumber: nextMatch.match_number, label: `${nextMatch.home_label} vs ${nextMatch.away_label}` });

    if (nextMatch.status === "completed" && nextMatch.home_score !== null && nextMatch.away_score !== null) {
      const { data: predictions, error: pickError } = await supabase
        .from("wc_match_predictions")
        .select("*")
        .eq("match_id", nextMatch.id);
      if (pickError) throw pickError;
      for (const prediction of predictions || []) {
        const result = scoreWcMatchPrediction(prediction, nextMatch);
        const { error: updError } = await supabase
          .from("wc_match_predictions")
          .update({
            points: result.points,
            score_breakdown: result.breakdown,
            updated_at: new Date().toISOString(),
          })
          .eq("id", prediction.id);
        if (updError) throw updError;
        completedScored += 1;
      }
      await rescoreSurvivorPicksForMatch(supabase, nextMatch);
    }
  }

  const counts = {
    eventsReceived: events.length,
    updated: updated.length,
    skipped: skipped.length,
    predictionsRescored: completedScored,
  };

  await supabase.from("wc_score_runs").insert({
    operation_type: "fixture-sync",
    status: "ok",
    message: `Synced ${updated.length} WC match(es) from ${SOURCE_NAME}.`,
    counts,
    metadata: { source: SOURCE_NAME, invokedBy, sourceUrl: SOURCE_URL, sampleSkipped: skipped.slice(0, 8) },
  });

  return jsonOk(`Synced ${updated.length} WC fixture(s) from ${SOURCE_NAME}.`, { counts, updated, skipped: skipped.slice(0, 24) });
}

async function runSync(request, body) {
  const { cron } = await authorize(request, body);
  requireServiceRole("WC fixture sync");
  const supabase = getSupabaseAdmin();
  return { cron, supabase };
}

export async function GET(request) {
  try {
    const { cron, supabase } = await runSync(request, null);
    return await performSync(supabase, { invokedBy: cron ? "cron" : "admin-get" });
  } catch (error) {
    return adminAccessErrorResponse(error, "Could not sync WC fixtures.");
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { cron, supabase } = await runSync(request, body);
    return await performSync(supabase, { invokedBy: cron ? "cron" : "admin" });
  } catch (error) {
    return adminAccessErrorResponse(error, "Could not sync WC fixtures.");
  }
}
