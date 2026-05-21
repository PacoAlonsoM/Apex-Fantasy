import { NextResponse } from "next/server";
import { requireWcUser } from "../_lib/wcServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_AWARD_LENGTH = 80;
const VALID_GROUP_KEYS = new Set(["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"]);

function sanitizeGroupBucket(raw) {
  if (!raw || typeof raw !== "object") return {};
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    const groupKey = String(key || "").trim().toUpperCase();
    if (!VALID_GROUP_KEYS.has(groupKey)) continue;
    const teamCode = String(value || "").trim().toUpperCase();
    if (!teamCode) continue;
    out[groupKey] = teamCode.slice(0, 6);
  }
  return out;
}

function sanitizePicks(raw) {
  if (!raw || typeof raw !== "object") return {};
  return {
    groupWinners: sanitizeGroupBucket(raw.groupWinners),
    groupRunnersUp: sanitizeGroupBucket(raw.groupRunnersUp),
    champion: String(raw.champion || "").trim().toUpperCase().slice(0, 6),
    goldenBoot: String(raw.goldenBoot || "").trim().slice(0, MAX_AWARD_LENGTH),
    goldenBall: String(raw.goldenBall || "").trim().slice(0, MAX_AWARD_LENGTH),
  };
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));

  try {
    const { user, supabase } = await requireWcUser(request, body);
    const picks = sanitizePicks(body?.picks);

    const { data, error } = await supabase
      .from("wc_bracket_predictions")
      .upsert({
        user_id: user.id,
        picks,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" })
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({ status: "ok", message: "WC bracket saved.", prediction: data });
  } catch (error) {
    return NextResponse.json({
      status: "error",
      message: error instanceof Error ? error.message : "Could not save WC bracket.",
    }, { status: error.status || 500 });
  }
}
