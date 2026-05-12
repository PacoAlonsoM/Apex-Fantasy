import { BRAND_NAME, BRAND_TAGLINE, LEGAL_DISCLAIMER, SUPPORT_EMAIL } from "@/src/constants/design";
import { pageToHref } from "@/src/shell/routing";
import BrandLockup from "@/src/ui/BrandLockup";

export default function LegalFooter({ setPage }) {
  const year = new Date().getFullYear();

  return (
    <footer
      style={{
        marginTop: 34,
        borderTop: "1px solid var(--border)",
        background: "var(--bg-surface)",
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
            <div style={{ fontSize: 12, color: "var(--text-muted)", maxWidth: 580 }}>
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
                  background: "var(--btn-secondary-bg)",
                  border: "1px solid var(--border-soft)",
                  borderRadius: 999,
                  color: "var(--text)",
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
        <div style={{ fontSize: 11, lineHeight: 1.7, color: "var(--text-muted)" }}>{LEGAL_DISCLAIMER}</div>
        <div style={{ fontSize: 11, color: "var(--text-subtle)" }}>© {year} {BRAND_NAME}. Contact: {SUPPORT_EMAIL}</div>
      </div>
    </footer>
  );
}
