import "server-only";

import { ADMIN_ID } from "@/src/constants/design";
import { getSupabaseReadClient } from "./supabaseAdmin";
import { jsonError } from "./response";

export const LOCAL_ADMIN_TOKEN_COOKIE = "stint-local-admin-token";

const ADMIN_USER_ID = String(process.env.ADMIN_USER_ID || process.env.AI_ADMIN_USER_ID || ADMIN_ID || "").trim();

class AdminAccessError extends Error {
  constructor(message, status = 403) {
    super(message);
    this.name = "AdminAccessError";
    this.status = status;
  }
}

function readTokenFromCookieHeader(cookieHeader = "") {
  const cookies = String(cookieHeader || "").split(";");

  for (const cookie of cookies) {
    const [rawName, ...rest] = cookie.split("=");
    if (String(rawName || "").trim() !== LOCAL_ADMIN_TOKEN_COOKIE) continue;

    const value = rest.join("=").trim();
    if (!value) return "";

    try {
      return decodeURIComponent(value);
    } catch (_error) {
      return value;
    }
  }

  return "";
}

export function getRequestAccessToken(request, body = null) {
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }

  const bodyToken = typeof body?.__authToken === "string" ? body.__authToken.trim() : "";
  if (bodyToken) return bodyToken;

  const cookieToken = request.cookies?.get?.(LOCAL_ADMIN_TOKEN_COOKIE)?.value || "";
  if (cookieToken) return cookieToken;

  return readTokenFromCookieHeader(request.headers.get("cookie") || "");
}

export function getConfiguredAdminUserId() {
  return ADMIN_USER_ID;
}

export async function validateAdminAccessToken(accessToken) {
  const token = String(accessToken || "").trim();
  if (!token) {
    throw new AdminAccessError("Missing admin authorization token.", 401);
  }

  if (!ADMIN_USER_ID) {
    throw new AdminAccessError("Missing configured admin user id on the server.", 500);
  }

  const supabase = getSupabaseReadClient();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    throw new AdminAccessError("Your admin session is invalid or expired. Sign in again and retry.", 401);
  }

  if (String(data.user.id || "") !== ADMIN_USER_ID) {
    throw new AdminAccessError("Admin only.", 403);
  }

  return {
    accessToken: token,
    user: data.user,
  };
}

export async function requireAdminRequest(request, body = null) {
  const token = getRequestAccessToken(request, body);
  return await validateAdminAccessToken(token);
}

export function adminAccessErrorResponse(error, fallbackMessage = "Could not verify admin access.") {
  if (error instanceof AdminAccessError) {
    return jsonError(error.message, error.status);
  }

  return jsonError(error instanceof Error ? error.message : fallbackMessage);
}
