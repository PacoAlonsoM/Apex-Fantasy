import "server-only";
import { createClient } from "@supabase/supabase-js";
import { requireAdminRequest, adminAccessErrorResponse, getConfiguredAdminUserId } from "../../_lib/localAdminAccess";
import { jsonOk, jsonError } from "../../_lib/response";

export const runtime = "nodejs";

/**
 * POST /api/admin/dev/set-pro-status
 * Body: { status: "pro" | "free" }
 *
 * Toggles the admin user's own subscription_status.
 * Restricted to the configured admin account only.
 */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid request body", 400);
  }

  try {
    await requireAdminRequest(request, body);
  } catch (err) {
    return adminAccessErrorResponse(err);
  }

  const { status } = body;
  if (!["pro", "free"].includes(status)) {
    return jsonError("status must be 'pro' or 'free'", 400);
  }

  const adminUserId = getConfiguredAdminUserId();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const patch = status === "pro"
    ? {
        subscription_status: "pro",
        subscription_start:  new Date().toISOString(),
        subscription_end:    null,
      }
    : {
        subscription_status: "free",
        subscription_end:    new Date().toISOString(),
      };

  const { error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", adminUserId);

  if (error) {
    return jsonError(`Failed to update subscription: ${error.message}`, 500);
  }

  return jsonOk({ ok: true, status });
}
