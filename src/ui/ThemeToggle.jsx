"use client";

import useThemePreference from "@/src/lib/useThemePreference";

const NEXT = { auto: "light", light: "dark", dark: "auto" };
const LABEL = {
  auto:  "Theme: System. Click for Light.",
  light: "Theme: Light. Click for Dark.",
  dark:  "Theme: Dark. Click for System.",
};

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="4" width="20" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

const ICON = { auto: <MonitorIcon />, light: <SunIcon />, dark: <MoonIcon /> };

export default function ThemeToggle({ size = 36 }) {
  const [preference, setPreference] = useThemePreference();
  const next  = NEXT[preference];
  const label = LABEL[preference];

  return (
    <button
      type="button"
      onClick={() => setPreference(next)}
      aria-label={label}
      title={label}
      className="stint-theme-toggle"
      data-hover="minimal"
      style={{
        width:          size,
        height:         size,
        borderRadius:   999,
        border:         "1px solid var(--border-soft)",
        background:     "transparent",
        color:          "var(--text-muted)",
        display:        "inline-flex",
        alignItems:     "center",
        justifyContent: "center",
        cursor:         "pointer",
        flexShrink:     0,
      }}
    >
      {ICON[preference]}
    </button>
  );
}
