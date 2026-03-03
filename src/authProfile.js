import { supabase } from "./supabase";
export function sanitizeUsername(value) {
  return (value || "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "")
    .slice(0, 24);
}

function fallbackUsername(authUser, preferredUsername) {
  const preferred = sanitizeUsername(preferredUsername);
  if (preferred) return preferred;

  const metadataUsername = sanitizeUsername(authUser?.user_metadata?.username);
  if (metadataUsername) return metadataUsername;

  const emailPrefix = sanitizeUsername(authUser?.email?.split("@")[0]);
  if (emailPrefix) return emailPrefix;

  return `player_${String(authUser?.id || "").slice(0, 8)}`;
}

export async function isUsernameTaken(username, excludeUserId = null) {
  const normalized = sanitizeUsername(username);
  if (!normalized) return false;

  const { data, error } = await supabase
    .from("profiles")
    .select("id,username")
    .ilike("username", normalized);

  if (error) throw error;

  return (data || []).some((profile) => profile.id !== excludeUserId);
}

export async function ensureProfileForUser(authUser, preferredUsername) {
  if (!authUser?.id) return null;

  const { data: existing } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", authUser.id)
    .maybeSingle();

  if (existing) return existing;

  const base = fallbackUsername(authUser, preferredUsername);
  const candidates = [
    base,
    `${base}_${String(authUser.id).slice(0, 4)}`,
    `player_${String(authUser.id).slice(0, 8)}`,
  ];

  let lastError = null;

  for (const username of candidates) {
    const { data, error } = await supabase
      .from("profiles")
      .insert({ id: authUser.id, username, points: 0 })
      .select("*")
      .single();

    if (!error && data) return data;

    lastError = error;
    if (error?.code !== "23505") break;
  }

  if (lastError) throw lastError;

  const { data: retryProfile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", authUser.id)
    .maybeSingle();

  return retryProfile;
}

export async function requireActiveSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session || null;
}
