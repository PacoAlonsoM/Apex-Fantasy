"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "stint-theme";
const SYNC_EVENT  = "stint-theme-change";
const VALID       = new Set(["auto", "light", "dark"]);

function readSavedPreference() {
  if (typeof window === "undefined") return "auto";
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return VALID.has(raw) ? raw : "auto";
  } catch {
    return "auto";
  }
}

function resolveTheme(preference, mediaQuery) {
  if (preference === "auto") return mediaQuery.matches ? "light" : "dark";
  return preference;
}

/**
 * Shared theme preference hook. Reads/writes `localStorage["stint-theme"]`,
 * applies `data-theme` + `data-theme-preference` to `<html>`, and listens to
 * OS preference changes when in `auto` mode. Multiple consumers (Navbar
 * toggle, Profile page settings panel) stay in sync via a custom DOM event.
 *
 * Returns `[preference, setPreference]` — preference is `"auto" | "light" | "dark"`.
 */
export default function useThemePreference() {
  const [preference, setPreferenceState] = useState(readSavedPreference);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    try { localStorage.setItem(STORAGE_KEY, preference); } catch { /* noop */ }

    const mql = window.matchMedia("(prefers-color-scheme: light)");
    const apply = () => {
      const resolved = resolveTheme(preference, mql);
      document.documentElement.dataset.theme = resolved;
      document.documentElement.dataset.themePreference = preference;
    };
    apply();

    if (preference === "auto") {
      const listener = () => apply();
      mql.addEventListener("change", listener);
      return () => mql.removeEventListener("change", listener);
    }
    return undefined;
  }, [preference]);

  // Cross-component sync inside the same tab (storage events don't fire here).
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handler = (event) => {
      const next = event.detail;
      if (VALID.has(next)) setPreferenceState(next);
    };
    window.addEventListener(SYNC_EVENT, handler);
    return () => window.removeEventListener(SYNC_EVENT, handler);
  }, []);

  // Cross-tab sync via the storage event.
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handler = (event) => {
      if (event.key !== STORAGE_KEY) return;
      const next = VALID.has(event.newValue) ? event.newValue : "auto";
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
