import { jsonError, jsonOk } from "../../_lib/response";
import { adminAccessErrorResponse, requireAdminRequest } from "../../_lib/localAdminAccess";
import { appendOperationRun, buildOperationRun, readLocalAdminStore, roundStoreKey, updateLocalAdminStore } from "../../_lib/localAdminStore";
import { getDraftForRound } from "../../_lib/dashboardData";
import { buildDraftPayload, normalizeDraftRecord } from "../../_lib/results";
import { fetchRaceData } from "@/src/lib/openf1";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    await requireAdminRequest(request, body);
    const season = Number(body?.season || 2026) || 2026;
    const round = Number(body?.round || body?.raceRound || 0);

    if (!round) {
      return jsonError("Missing race round for import.", 400);
    }

    const imported = await fetchRaceData(season, round);
    if (!imported) {
      return jsonError(`No OpenF1 race result payload found for round ${round}.`, 404);
    }

    const store = await readLocalAdminStore();
    const previousDraft = getDraftForRound(store, season, round);
    const nextDraft = normalizeDraftRecord({
      ...(previousDraft || {}),
      season,
      round,
      ...buildDraftPayload({
        season,
        round,
        imported,
        manual: previousDraft?.payload || {},
        previousDraft,
      }),
      status: "draft",
      importedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: {
        provider: "OpenF1",
        integrity: imported?.integrity || null,
        rawResults: imported?.raw_results || [],
      },
    });

    const warnings = [];
    if (imported?.integrity && imported.integrity.isSafeToSave === false) {
      warnings.push(`OpenF1 integrity check is incomplete: ${imported.integrity.classifiedCount || 0} classified from ${imported.integrity.totalRows || 0} rows.`);
    }

    const run = buildOperationRun("results-import", {
      season,
      round,
      status: warnings.length ? "partial" : "ok",
      message: `Imported OpenF1 data for round ${round}.`,
      warnings,
      counts: {
        classified: imported?.integrity?.classifiedCount || 0,
        rows: imported?.integrity?.totalRows || 0,
      },
    });

    const nextStore = await updateLocalAdminStore((currentStore) => {
      currentStore.resultsDrafts[roundStoreKey(season, round)] = nextDraft;
      appendOperationRun(currentStore, run);
      return currentStore;
    });

    return jsonOk(`Imported OpenF1 results for round ${round}.`, {
      runId: run.id,
      season,
      round,
      draft: nextStore.resultsDrafts[roundStoreKey(season, round)],
      warnings,
      counts: run.counts,
    });
  } catch (error) {
    return adminAccessErrorResponse(error, "OpenF1 import failed.");
  }
}
