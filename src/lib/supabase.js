import { createClient } from "@supabase/supabase-js";
import { getPublicRuntimeConfig, getPublicRuntimeConfigStatus, getPublicRuntimeErrorMessage } from "@/src/lib/runtimeConfig";

export const SUPABASE_URL = getPublicRuntimeConfig().supabaseUrl;
export const SUPABASE_ANON_KEY = getPublicRuntimeConfig().supabaseAnonKey;

let cachedSupabaseClient = null;

export function isSupabaseConfigured() {
  return getPublicRuntimeConfigStatus().ok;
}

export function getSupabaseBrowserClient() {
  const status = getPublicRuntimeConfigStatus();

  if (!status.ok) {
    throw new Error(getPublicRuntimeErrorMessage(status));
  }

  if (!cachedSupabaseClient) {
    cachedSupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  return cachedSupabaseClient;
}

export const supabase = new Proxy({}, {
  get(_target, key) {
    const client = getSupabaseBrowserClient();
    const value = Reflect.get(client, key, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
