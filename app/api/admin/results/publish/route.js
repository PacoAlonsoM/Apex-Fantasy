import { jsonError, jsonOk } from "../../_lib/response";
import { appendOperationRun, buildOperationRun, roundStoreKey, updateLocalAdminStore } from "../../_lib/localAdminStore";
import { isLocalAdminRequest } from "../../_lib/localAdminAccess";
import { buildRaceResultsRowFromDraft, deriveManualFieldsUsed, normalizeDraftRecord, normalizeOfficialResultsRow, validateDraftForPublish } from "../../_lib/results";
import { getSupabaseAdmin, getSupabaseReadClient, invokeSupabaseFunction, requireServiceRole } from "../../_lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function rowsDiffer(left, right) {
  return JSON.stringify(left || {}) !== JSON.stringify(right || {});
}

export async function POST(request) {
  if (!isLocalAdminRequest(request)) {
    return jsonError("The local admin routes only run on localhost.", 403);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const season = Number(body?.season || 2026) || 2026;
    const round = Number(body?.round || 0);

    if (!round) {
      return jsonError("Missing round for publish.", 400);
    }

    requireServiceRole("publishing official results");

    const supabase = getSupabaseReadClient();
    const adminSupabase = getSupabaseAdmin();
    const key = roundStoreKey(season, round);
    let existingOfficial = null;

    try {
      const { data } = await supabase
        .from("race_results")
        .select("*")
        .eq("race_round", round)
        .maybeSingle();
      existingOfficial = normalizeOfficialResultsRow(data || null);
    } catch (error) {
      console.warn("Publish official lookup fallback", error?.message || error);
    }

    let warnings = [];
    const updatedAt = new Date().toISOString();
    let publishedRow = null;
    let run = null;
    let nextStore = null;

    nextStore = await updateLocalAdminStore(async (store) => {
      const storedDraft = store.resultsDrafts[key];
      if (!storedDraft?.payload) {
        throw new Error(`No saved draft exists for round ${round}.`);
      }
      const draft = normalizeDraftRecord(storedDraft);

      const validation = validateDraftForPublish(draft);
      if (!validation.ok) {
        throw new Error(`Missing manual result fields: ${validation.missing.join(", ")}.`);
      }

      publishedRow = buildRaceResultsRowFromDraft(draft);

      const { error: upsertError } = await adminSupabase
        .from("race_results")
        .upsert(publishedRow, { onConflict: "race_round" });
      if (upsertError) throw upsertError;

      const { data: storedOfficial, error: verifyError } = await adminSupabase
        .from("race_results")
        .select("*")
        .eq("race_round", round)
        .maybeSingle();

      if (verifyError) throw verifyError;
      const verifiedRow = normalizeOfficialResultsRow(storedOfficial || null);
      if (!verifiedRow?.results_entered || Number(verifiedRow.race_round || 0) !== round) {
        throw new Error(`Publish verification failed for round ${round}.`);
      }

      const changedOfficialRow = existingOfficial ? rowsDiffer(existingOfficial, publishedRow) : true;
      if (changedOfficialRow && existingOfficial?.results_entered) {
        warnings = ["Official results changed. Award points again to refresh stored scores."];
      }

      store.resultsDrafts[key] = {
        ...draft,
        status: "published",
        publishedAt: updatedAt,
        updatedAt,
        publishedSnapshot: {
          publishedAt: updatedAt,
          publishedBy: "local-admin",
          manualFields: deriveManualFieldsUsed(draft.payload),
          officialRow: publishedRow,
        },
      };

      run = buildOperationRun("results-publish", {
        season,
        round,
        status: warnings.length ? "partial" : "ok",
        message: `Published official results for round ${round}.`,
        warnings,
        counts: {
          manualFields: deriveManualFieldsUsed(draft.payload).length,
        },
        updatedAt,
      });

      appendOperationRun(store, run);
      return store;
    });

    try {
      await invokeSupabaseFunction(
        "race-results-sync",
        {
          year: season,
          raceRound: round,
          historyOnly: true,
          persistRaceResults: false,
          persistRaceContextHistory: true,
          score: false,
        },
        {
          secretEnv: "RACE_RESULTS_SYNC_SECRET",
          secretHeader: "x-sync-secret",
          requireSecret: false,
          preferSecretAuth: true,
        },
      );
    } catch (error) {
      warnings = [...warnings, `History refresh skipped: ${error instanceof Error ? error.message : "unknown error"}`];
    }

    if (warnings.length) {
      return jsonOk(`Published official results for round ${round}.`, {
        runId: run?.id,
        season,
        round,
        warnings,
        official: publishedRow,
        draft: nextStore.resultsDrafts[key],
      });
    }

    return jsonOk(`Published official results for round ${round}.`, {
      runId: run?.id,
      season,
      round,
      official: publishedRow,
      draft: nextStore.resultsDrafts[key],
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not publish results.");
  }
}
