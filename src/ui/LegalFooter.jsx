import { BRAND_NAME, BRAND_TAGLINE, LEGAL_DISCLAIMER, SUPPORT_EMAIL } from "@/src/constants/design";
import { pageToHref } from "@/src/shell/routing";
import BrandLockup from "@/src/ui/BrandLockup";

export default function LegalFooter({ setPage }) {
  const year = new Date().getFullYear();

  return (
    <footer
      style={{
        marginTop: 34,
        borderTop: "1px solid rgba(148,163,184,0.12)",
        background: "linear-gradient(180deg,rgba(7,11,18,0.35),rgba(9,9,11,0.72))",
      }}
    >
      <div
        style={{
          maxWidth: 1260,
          margin: "0 auto",
          padding: "24px 28px 24px",
          display: "grid",
          gap: 14,
        }}
      >
        <div className="stint-footer-row" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "grid", gap: 10 }}>
            <BrandLockup compact descriptor />
            <div style={{ fontSize: 12, color: "rgba(226,232,240,0.82)", maxWidth: 580 }}>
              {BRAND_NAME} · {BRAND_TAGLINE}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              ["Support", "support"],
              ["Terms", "terms"],
              ["Privacy", "privacy"],
            ].map(([label, page]) => (
              <a
                key={label}
                href={pageToHref(page)}
                onClick={(event) => {
                  event.preventDefault();
                  setPage(page);
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(148,163,184,0.16)",
                  borderRadius: 999,
                  color: "#e2e8f0",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                  padding: "6px 10px",
                  textDecoration: "none",
                }}
              >
                {label}
              </a>
            ))}
          </div>
        </div>
        <div style={{ fontSize: 11, lineHeight: 1.7, color: "rgba(148,163,184,0.92)" }}>{LEGAL_DISCLAIMER}</div>
        <div style={{ fontSize: 11, color: "rgba(148,163,184,0.8)" }}>© {year} {BRAND_NAME}. Contact: {SUPPORT_EMAIL}</div>
      </div>
    </footer>
  );
}
