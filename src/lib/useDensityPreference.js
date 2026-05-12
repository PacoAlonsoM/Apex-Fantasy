"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "stint-density";
const SYNC_EVENT  = "stint-density-change";
const VALID       = new Set(["comfortable", "compact"]);
const DEFAULT     = "comfortable";

function readSavedPreference() {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return VALID.has(raw) ? raw : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

/**
 * Density preference hook (audit Rec #09). Mirrors `useThemePreference` —
 * persists `localStorage["stint-density"]`, applies `data-density` to `<html>`,
 * and broadcasts changes via a custom event so multiple consumers stay in sync.
 *
 * Returns `[preference, setPreference]` where preference is
 * `"comfortable" | "compact"`. `comfortable` is the default and renders
 * normal padding; `compact` drops vertical padding ~30% on data-dense rows.
 */
export default function useDensityPreference() {
  const [preference, setPreferenceState] = useState(readSavedPreference);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try { localStorage.setItem(STORAGE_KEY, preference); } catch { /* noop */ }
    document.documentElement.dataset.density = preference;
  }, [preference]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handler = (event) => {
      const next = event.detail;
      if (VALID.has(next)) setPreferenceState(next);
    };
    window.addEventListener(SYNC_EVENT, handler);
    return () => window.removeEventListener(SYNC_EVENT, handler);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handler = (event) => {
      if (event.key !== STORAGE_KEY) return;
      const next = VALID.has(event.newValue) ? event.newValue : DEFAULT;
      setPreferenceState(next);
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const setPreference = (next) => {
    if (!VALID.has(next)) return;
    setPreferenceState(next);
    if (typeof window === "undefined") return;
    try {
      window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: next }));
    } catch { /* noop */ }
  };

  return [preference, setPreference];
}
