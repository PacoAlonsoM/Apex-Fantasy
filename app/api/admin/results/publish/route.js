import { after } from "next/server";

import { jsonError, jsonOk } from "../../_lib/response";
import { upsertCanonicalHistoryFromResults } from "../../_lib/canonicalHistory";
import { appendOperationRun, buildOperationRun, roundStoreKey, updateLocalAdminStore } from "../../_lib/localAdminStore";
import { adminAccessErrorResponse, requireAdminRequest } from "../../_lib/localAdminAccess";
import { markUpcomingAiBriefStale, runAiBriefGeneration } from "../../_lib/aiBriefService";
import {
  buildRaceResultsRowFromDraft,
  buildSprintResultsRowFromDraft,
  deriveManualFieldsUsed,
  normalizeDraftRecord,
  normalizeOfficialResultsRow,
  validateDraftForPublish,
} from "../../_lib/results";
import { getSupabaseAdmin, getSupabaseReadClient, requireServiceRole } from "../../_lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function rowsDiffer(left, right) {
  return JSON.stringify(left || {}) !== JSON.stringify(right || {});
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    await requireAdminRequest(request, body);
    const season = Number(body?.season || 2026) || 2026;
    const round = Number(body?.round || 0);
    const scope = body?.scope === "sprint" ? "sprint" : "full";

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

      const validation = validateDraftForPublish(draft, { scope });
      if (!validation.ok) {
        throw new Error(`Missing ${scope === "sprint" ? "sprint" : "manual result"} fields: ${validation.missing.join(", ")}.`);
      }

      publishedRow = scope === "sprint"
        ? buildSprintResultsRowFromDraft(draft, existingOfficial)
        : buildRaceResultsRowFromDraft(draft, existingOfficial);

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
      if (Number(verifiedRow?.race_round || 0) !== round) {
        throw new Error(`Publish verification failed for round ${round}.`);
      }
      if (scope === "full" && !verifiedRow?.results_entered) {
        throw new Error(`Publish verification failed for round ${round}.`);
      }
      if (scope === "sprint" && (!verifiedRow?.sp_pole || !verifiedRow?.sp_winner || !verifiedRow?.sp_p2 || !verifiedRow?.sp_p3)) {
        throw new Error(`Sprint publish verification failed for round ${round}.`);
      }

      const changedOfficialRow = existingOfficial ? rowsDiffer(existingOfficial, publishedRow) : true;
      if (changedOfficialRow && existingOfficial?.results_entered) {
        warnings = [`${scope === "sprint" ? "Sprint results" : "Official results"} changed. Award points again to refresh stored scores.`];
      }

      store.resultsDrafts[key] = {
        ...draft,
        status: scope === "sprint" && !publishedRow.results_entered ? "sprint-published" : "published",
        publishedAt: scope === "full" ? updatedAt : draft.publishedAt || null,
        updatedAt,
        publishedSnapshot: {
          publishedAt: updatedAt,
          publishedBy: "local-admin",
          scope,
          manualFields: deriveManualFieldsUsed(draft.payload),
          officialRow: publishedRow,
        },
      };

      run = buildOperationRun("results-publish", {
        season,
        round,
        status: warnings.length ? "partial" : "ok",
        message: `Published ${scope === "sprint" ? "sprint" : "official"} results for round ${round}.`,
        warnings,
        counts: {
          manualFields: deriveManualFieldsUsed(draft.payload).length,
        },
        details: { scope },
        updatedAt,
      });

      appendOperationRun(store, run);
      return store;
    });

    if (scope === "full") {
      try {
        const historySync = await upsertCanonicalHistoryFromResults(adminSupabase, publishedRow, { season });
        if (!historySync.count) {
          warnings = [...warnings, "History refresh skipped: no published result row was available."];
        }
      } catch (error) {
        warnings = [...warnings, `History refresh skipped: ${error instanceof Error ? error.message : "unknown error"}`];
      }
    }

    if (scope === "full") {
      after(async () => {
        try {
          await markUpcomingAiBriefStale({
            round,
            reason: `Official results changed for round ${round}. Refreshing the upcoming AI brief.`,
          });
        } catch (error) {
          console.warn("AI brief stale marker skipped", error?.message || error);
        }

        try {
          await runAiBriefGeneration({ season });
        } catch (error) {
          console.warn("Post-publish AI brief refresh skipped", error?.message || error);
        }
      });
    }

    if (warnings.length) {
      return jsonOk(`Published ${scope === "sprint" ? "sprint" : "official"} results for round ${round}.`, {
        runId: run?.id,
        season,
        round,
        scope,
        warnings,
        aiRefreshScheduled: scope === "full",
        official: publishedRow,
        draft: nextStore.resultsDrafts[key],
      });
    }

    return jsonOk(`Published ${scope === "sprint" ? "sprint" : "official"} results for round ${round}.`, {
      runId: run?.id,
      season,
      round,
      scope,
      aiRefreshScheduled: scope === "full",
      official: publishedRow,
      draft: nextStore.resultsDrafts[key],
    });
  } catch (error) {
    return adminAccessErrorResponse(error, "Could not publish results.");
  }
}
