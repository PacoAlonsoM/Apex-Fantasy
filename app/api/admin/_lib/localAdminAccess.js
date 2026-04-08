const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
export const LOCAL_ADMIN_TOKEN_COOKIE = "stint-local-admin-token";

export function resolveRequestHost(request) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost || request.headers.get("host") || "";
  return String(host).split(":")[0].trim().toLowerCase();
}

export function isLocalAdminRequest(request) {
  return LOCAL_HOSTS.has(resolveRequestHost(request));
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
