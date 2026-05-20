import { upsertCanonicalHistoryFromResults } from "../../_lib/canonicalHistory";
import { runAiBriefGeneration } from "../../_lib/aiBriefService";
import { adminAccessErrorResponse, requireAdminRequest } from "../../_lib/localAdminAccess";
import { appendOperationRun, buildOperationRun, updateLocalAdminStore } from "../../_lib/localAdminStore";
import { jsonOk, jsonPartial } from "../../_lib/response";
import { getSupabaseAdmin, requireServiceRole } from "../../_lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function warningList(values = []) {
  return values.filter(Boolean);
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    await requireAdminRequest(request, body);
    requireServiceRole("AI truth repairs");

    const season = Number(body?.season || 2026) || 2026;
    const supabase = getSupabaseAdmin();
    const { data: resultsRows, error: resultsError } = await supabase
      .from("race_results")
      .select("*")
      .eq("results_entered", true)
      .order("race_round", { ascending: true });

    if (resultsError) throw resultsError;

    const historySync = await upsertCanonicalHistoryFromResults(supabase, resultsRows || [], { season });
    const repairedRounds = historySync.rows.map((row) => Number(row?.race_round || 0)).filter((round) => round > 0);

    let briefResult = null;
    let briefError = null;

    try {
      briefResult = await runAiBriefGeneration({ season });
    } catch (error) {
      briefError = error instanceof Error ? error : new Error("Could not regenerate the AI brief after repairing canonical history.");
    }

    const warnings = warningList([
      repairedRounds.length
        ? null
        : "No published race results were available to rebuild canonical AI history.",
      briefError?.message || null,
    ]);

    const run = buildOperationRun("ai-repair-live-data", {
      season,
      round: briefResult?.race?.r || null,
      status: briefError ? "partial" : "ok",
      message: briefError
        ? "Canonical AI history was rebuilt from published results, but the upcoming brief still needs regeneration."
        : "Canonical AI history was rebuilt from published results and the upcoming brief was regenerated.",
      counts: {
        repairedRounds: repairedRounds.length,
        regeneratedRound: briefResult?.race?.r || null,
      },
      warnings,
      details: {
        repairedRounds,
        regeneratedRace: briefResult?.race?.n || null,
      },
    });

    await updateLocalAdminStore((state) => {
      appendOperationRun(state, run);
      return state;
    });

    const extras = {
      runId: run.id,
      season,
      round: briefResult?.race?.r || null,
      counts: run.counts,
      warnings,
      repairedRounds,
      raceName: briefResult?.race?.n || null,
      mode: briefResult?.insight?.mode || null,
      provider: briefResult?.row?.provider || null,
      model: briefResult?.row?.model || null,
      researchSourceCount: Array.isArray(briefResult?.insight?.research_sources) ? briefResult.insight.research_sources.length : 0,
    };

    return briefError
      ? jsonPartial(run.message, extras)
      : jsonOk(run.message, extras);
  } catch (error) {
    return adminAccessErrorResponse(error, "Could not repair canonical AI data.");
  }
}
