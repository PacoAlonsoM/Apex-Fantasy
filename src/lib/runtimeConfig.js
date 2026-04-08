const DEFAULT_SITE_URL = "https://www.stint-web.com";

export const PUBLIC_ENV_NAMES = [
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
];

const BLOCKING_PUBLIC_ENV_NAMES = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
];

function hasValue(value) {
  return String(value || "").trim().length > 0;
}

export function getPublicRuntimeConfigStatus() {
  const rawValues = {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || "",
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  };

  const missing = PUBLIC_ENV_NAMES.filter((name) => !hasValue(rawValues[name]));
  const blockingMissing = BLOCKING_PUBLIC_ENV_NAMES.filter((name) => !hasValue(rawValues[name]));

  return {
    ok: blockingMissing.length === 0,
    contractOk: missing.length === 0,
    missing,
    blockingMissing,
    presence: {
      NEXT_PUBLIC_SITE_URL: hasValue(rawValues.NEXT_PUBLIC_SITE_URL),
      NEXT_PUBLIC_SUPABASE_URL: hasValue(rawValues.NEXT_PUBLIC_SUPABASE_URL),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: hasValue(rawValues.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    },
    values: {
      siteUrl: rawValues.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL,
      supabaseUrl: rawValues.NEXT_PUBLIC_SUPABASE_URL || "",
      supabaseAnonKey: rawValues.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    },
  };
}

export function getPublicRuntimeConfig() {
  return getPublicRuntimeConfigStatus().values;
}

export function getPublicRuntimeErrorMessage(status = getPublicRuntimeConfigStatus()) {
  const missing = status?.blockingMissing || [];
  if (!missing.length) return "";
  return `Missing required public config: ${missing.join(", ")}.`;
}
