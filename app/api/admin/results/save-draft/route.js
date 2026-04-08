import { jsonError, jsonOk } from "../../_lib/response";
import { appendOperationRun, buildOperationRun, roundStoreKey, updateLocalAdminStore } from "../../_lib/localAdminStore";
import { adminAccessErrorResponse, requireAdminRequest } from "../../_lib/localAdminAccess";
import { normalizeDraftRecord } from "../../_lib/results";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    await requireAdminRequest(request, body);
    const season = Number(body?.season || 2026) || 2026;
    const round = Number(body?.round || 0);
    const draft = body?.draft;

    if (!round || !draft?.payload) {
      return jsonError("Missing round or draft payload.", 400);
    }

    const normalizedDraft = normalizeDraftRecord({
      ...draft,
      season,
      round,
    });

    const updatedAt = new Date().toISOString();
    const key = roundStoreKey(season, round);
    const run = buildOperationRun("results-save-draft", {
      season,
      round,
      message: `Saved draft results for round ${round}.`,
      counts: {
        manualFields: Object.values(normalizedDraft?.payload || {}).filter(Boolean).length,
      },
      updatedAt,
    });

    const nextStore = await updateLocalAdminStore((store) => {
      const existing = store.resultsDrafts[key] || {};
      store.resultsDrafts[key] = {
        ...existing,
        ...normalizedDraft,
        publishedSnapshot: normalizedDraft.publishedSnapshot || existing.publishedSnapshot || null,
        season,
        round,
        status: "draft",
        updatedAt,
      };

      appendOperationRun(store, run);
      return store;
    });

    return jsonOk(`Draft saved for round ${round}.`, {
      runId: run.id,
      season,
      round,
      draft: nextStore.resultsDrafts[key],
    });
  } catch (error) {
    return adminAccessErrorResponse(error, "Could not save draft.");
  }
}
