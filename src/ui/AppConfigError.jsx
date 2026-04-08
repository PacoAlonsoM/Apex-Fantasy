import { BG_BASE, PANEL_BG, PANEL_BORDER, TEXT_PRIMARY, TEXT_SECONDARY, ACCENT } from "@/src/constants/design";

export default function AppConfigError({ status }) {
  const missing = Array.isArray(status?.missing) ? status.missing : [];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: BG_BASE,
        color: TEXT_PRIMARY,
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "min(720px, 100%)",
          display: "grid",
          gap: 20,
          padding: 28,
          borderRadius: 24,
          background: PANEL_BG,
          border: PANEL_BORDER,
          boxShadow: "0 24px 80px rgba(0,0,0,0.28)",
        }}
      >
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: TEXT_SECONDARY, fontWeight: 700 }}>
            Config Error
          </div>
          <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 34, lineHeight: 1.05, fontWeight: 800 }}>
            STINT could not start because required public configuration is missing.
          </div>
          <div style={{ fontSize: 15, lineHeight: 1.7, color: TEXT_SECONDARY }}>
            This usually means the deployment or local environment is missing one of the required <code>NEXT_PUBLIC_*</code> variables.
          </div>
        </div>

        <div
          style={{
            padding: 18,
            borderRadius: 18,
            background: "rgba(255,106,26,0.08)",
            border: `1px solid rgba(255,106,26,0.26)`,
            display: "grid",
            gap: 10,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: ACCENT }}>
            Missing variables
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {missing.map((name) => (
              <code
                key={name}
                style={{
                  padding: "6px 10px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: TEXT_PRIMARY,
                  fontSize: 12,
                }}
              >
                {name}
              </code>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gap: 8, color: TEXT_SECONDARY, fontSize: 14, lineHeight: 1.7 }}>
          <div>Localhost fix: update <code>.env.local</code> and restart the dev server.</div>
          <div>Production fix: add the same variable names in Vercel Environment Variables and redeploy.</div>
          <div>The supported public contract is: <code>NEXT_PUBLIC_SITE_URL</code>, <code>NEXT_PUBLIC_SUPABASE_URL</code>, <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.</div>
        </div>
      </div>
    </div>
  );
}
