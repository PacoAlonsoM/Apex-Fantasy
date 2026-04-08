let lastSyncedToken = null;

export async function syncLocalAdminSession(accessToken = "") {
  if (typeof window === "undefined") return;

  const token = String(accessToken || "").trim();
  if (token === lastSyncedToken) return;
  lastSyncedToken = token;

  const method = token ? "POST" : "DELETE";
  const init = {
    method,
    credentials: "same-origin",
    keepalive: true,
  };

  if (token) {
    init.headers = {
      "Content-Type": "application/json",
    };
    init.body = JSON.stringify({ accessToken: token });
  }

  try {
    await fetch("/api/admin/session", init);
  } catch (_error) {
    // Best effort only. Direct header/body auth still exists.
  }
}
