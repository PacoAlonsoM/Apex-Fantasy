import { adminAccessErrorResponse, requireAdminRequest } from "../../_lib/localAdminAccess";
import { jsonOk, jsonPartial } from "../../_lib/response";
import { runAiBriefGeneration } from "../../_lib/aiBriefService";
import { requireServiceRole } from "../../_lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    await requireAdminRequest(request, body);

    const season = Number(body?.season || 2026) || 2026;
    const preferredRound = Number(body?.raceRound || body?.round || 0) || null;
    requireServiceRole("AI brief generation");

    const result = await runAiBriefGeneration({ season, preferredRound });
    const responseExtras = {
      runId: result.run.id,
      season,
      round: result.race.r,
      counts: result.run.counts,
      warnings: result.run.warnings,
      headline: result.row.headline,
      mode: result.insight.mode,
      provider: result.row.provider,
      model: result.row.model,
      raceName: result.race.n,
      researchSourceCount: Array.isArray(result.insight.research_sources) ? result.insight.research_sources.length : 0,
    };

    return result.insight.mode === "fallback"
      ? jsonPartial(result.run.message, responseExtras)
      : jsonOk(result.run.message, responseExtras);
  } catch (error) {
    return adminAccessErrorResponse(error, "Could not generate AI brief.");
  }
}
