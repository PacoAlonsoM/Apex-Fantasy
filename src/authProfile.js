import { supabase } from "./supabase";
import { DEFAULT_AVATAR_COLOR } from "./constants/design";

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

function normalizeProfileSeed(authUser, preferredProfile) {
  if (typeof preferredProfile === "string") {
    return {
      username: preferredProfile,
      avatarColor: authUser?.user_metadata?.avatar_color || DEFAULT_AVATAR_COLOR,
      favoriteTeam: authUser?.user_metadata?.favorite_team || null,
      favoriteDriver: authUser?.user_metadata?.favorite_driver || null,
    };
  }

  return {
    username: preferredProfile?.username || authUser?.user_metadata?.username || null,
    avatarColor: preferredProfile?.avatarColor || authUser?.user_metadata?.avatar_color || DEFAULT_AVATAR_COLOR,
    favoriteTeam: preferredProfile?.favoriteTeam || authUser?.user_metadata?.favorite_team || null,
    favoriteDriver: preferredProfile?.favoriteDriver || authUser?.user_metadata?.favorite_driver || null,
  };
}

export function profileFallbackFromAuthUser(authUser, preferredProfile) {
  if (!authUser?.id) return null;

  const seed = normalizeProfileSeed(authUser, preferredProfile);

  return {
    id: authUser.id,
    email: authUser.email || null,
    username: fallbackUsername(authUser, seed.username),
    points: 0,
    avatar_color: seed.avatarColor || DEFAULT_AVATAR_COLOR,
    favorite_team: seed.favoriteTeam || null,
    favorite_driver: seed.favoriteDriver || null,
  };
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

export async function ensureProfileForUser(authUser, preferredProfile) {
  if (!authUser?.id) return null;
  const seed = normalizeProfileSeed(authUser, preferredProfile);
  const fallbackProfile = profileFallbackFromAuthUser(authUser, preferredProfile);

  try {
    const { data: existing, error: existingError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", authUser.id)
      .maybeSingle();

    if (existingError) return fallbackProfile;

    if (existing) {
      const merged = {
        ...existing,
        avatar_color: existing.avatar_color || seed.avatarColor || DEFAULT_AVATAR_COLOR,
        favorite_team: existing.favorite_team || seed.favoriteTeam || null,
        favorite_driver: existing.favorite_driver || seed.favoriteDriver || null,
      };
      const updates = {};

      if (!existing.avatar_color && seed.avatarColor) updates.avatar_color = seed.avatarColor;
      if (!existing.favorite_team && seed.favoriteTeam) updates.favorite_team = seed.favoriteTeam;
      if (!existing.favorite_driver && seed.favoriteDriver) updates.favorite_driver = seed.favoriteDriver;

      if (Object.keys(updates).length) {
        const { data: updated, error } = await supabase
          .from("profiles")
          .update(updates)
          .eq("id", authUser.id)
          .select("*")
          .maybeSingle();

        if (!error && updated) return updated;
      }

      return merged;
    }

    const base = fallbackUsername(authUser, seed.username);
    const candidates = [
      base,
      `${base}_${String(authUser.id).slice(0, 4)}`,
      `player_${String(authUser.id).slice(0, 8)}`,
    ];

    let lastError = null;

    for (const username of candidates) {
      const fullPayload = {
        id: authUser.id,
        username,
        points: 0,
        avatar_color: seed.avatarColor || DEFAULT_AVATAR_COLOR,
        favorite_team: seed.favoriteTeam,
        favorite_driver: seed.favoriteDriver,
      };

      const { data, error } = await supabase
        .from("profiles")
        .insert(fullPayload)
        .select("*")
        .single();

      if (!error && data) return data;

      lastError = error;
      if (error?.message?.includes("favorite_team") || error?.message?.includes("favorite_driver")) {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("profiles")
          .insert({
            id: authUser.id,
            username,
            points: 0,
            avatar_color: seed.avatarColor || DEFAULT_AVATAR_COLOR,
          })
          .select("*")
          .single();

        if (!fallbackError && fallbackData) return fallbackData;
        lastError = fallbackError;
      }

      if (error?.message?.includes("avatar_color")) {
        const { data: bareData, error: bareError } = await supabase
          .from("profiles")
          .insert({ id: authUser.id, username, points: 0 })
          .select("*")
          .single();

        if (!bareError && bareData) return bareData;
        lastError = bareError;
      }

      if (error?.code !== "23505") break;
    }

    if (lastError) return fallbackProfile;

    const { data: retryProfile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", authUser.id)
      .maybeSingle();

    return retryProfile || fallbackProfile;
  } catch {
    return fallbackProfile;
  }
}

export async function requireActiveSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  let session = data.session || null;
  if (!session) return null;

  const expiresAtMs = Number(session.expires_at || 0) * 1000;
  const needsRefresh = !session.access_token || (expiresAtMs && expiresAtMs - Date.now() < 60_000);

  if (needsRefresh) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) throw refreshError;
    session = refreshed.session || null;
  }

  if (!session?.access_token) return null;

  const { error: userError } = await supabase.auth.getUser(session.access_token);
  if (!userError) return session;

  const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) throw refreshError;

  return refreshed.session || null;
}
