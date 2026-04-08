import { jsonOk } from "../../_lib/response";
import { appendOperationRun, buildOperationRun, updateLocalAdminStore } from "../../_lib/localAdminStore";
import { adminAccessErrorResponse, requireAdminRequest } from "../../_lib/localAdminAccess";
import { syncNewsArticlesLocally } from "../../_lib/newsIngest";
import { getSupabaseAdmin, requireServiceRole } from "../../_lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    await requireAdminRequest(request, body);
    const season = Number(body?.season || 2026) || 2026;
    requireServiceRole("news ingest");
    const supabase = getSupabaseAdmin();
    const payload = await syncNewsArticlesLocally(supabase);

    const run = buildOperationRun("news-sync", {
      season,
      message: `Synced ${payload?.upsertedCount || 0} news articles.`,
      warnings: payload?.errors || [],
      counts: {
        fetched: payload?.fetchedCount || 0,
        upserted: payload?.upsertedCount || 0,
      },
    });

    await updateLocalAdminStore((store) => {
      appendOperationRun(store, run);
      return store;
    });

    return jsonOk(run.message, {
      runId: run.id,
      season,
      warnings: run.warnings,
      counts: run.counts,
    });
  } catch (error) {
    return adminAccessErrorResponse(error, "News sync failed.");
  }
}
