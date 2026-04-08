import { jsonError, jsonOk } from "../_lib/response";
import { buildLocalAdminCapabilities, getSupabaseReadClient } from "../_lib/supabaseAdmin";
import { readLocalAdminStore, getLatestOperationRun } from "../_lib/localAdminStore";
import { getDraftForRound, getRoundControls, getRoundSessions } from "../_lib/dashboardData";
import { adminAccessErrorResponse, requireAdminRequest } from "../_lib/localAdminAccess";
import { deriveManualFieldsUsed, normalizeDraftRecord, normalizeOfficialResultsRow } from "../_lib/results";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    await requireAdminRequest(request);
    const url = new URL(request.url);
    const season = Number(url.searchParams.get("season") || 2026) || 2026;
    const round = Number(url.searchParams.get("round") || 0);

    if (!round) {
      return jsonError("Missing round query parameter.", 400);
    }

    const supabase = getSupabaseReadClient();
    const store = await readLocalAdminStore();
    const draft = normalizeDraftRecord(getDraftForRound(store, season, round) || {
      season,
      round,
      payload: { race_round: round },
    });
    const roundControls = getRoundControls(store, season, round);
    const roundSessions = getRoundSessions(store, season, round);
    const latestPublishRun = getLatestOperationRun(store, "results-publish", round);
    const latestAwardRun = getLatestOperationRun(store, "award-points", round);
    let official = null;
    try {
      const { data } = await supabase
        .from("race_results")
        .select("*")
        .eq("race_round", round)
        .maybeSingle();
      official = normalizeOfficialResultsRow(data || null);
    } catch (error) {
      console.warn("Official result lookup fallback", error?.message || error);
    }

    return jsonOk(`Loaded round ${round} results workspace.`, {
      season,
      round,
      draft,
      official: official
        ? {
            ...official,
            manualFields: deriveManualFieldsUsed(official),
          }
        : null,
      controls: roundControls,
      sessions: roundSessions,
      latestPublishRun,
      latestAwardRun,
      capabilities: buildLocalAdminCapabilities(),
    });
  } catch (error) {
    return adminAccessErrorResponse(error, "Could not load round results.");
  }
}
