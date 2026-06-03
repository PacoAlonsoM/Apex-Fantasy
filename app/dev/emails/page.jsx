"use client";

// Email design concept preview page.
//
// Renders all four candidate email treatments (Plain Letter, Pit Board,
// Editorial, Race Card / Heritage) side-by-side using isolated iframes so
// the email DOM never collides with the app's own styles. Both the welcome
// and post-race results variants are shown for each concept, populated with
// the same sample data, so the team can pick a single direction to ship.

import * as plainLetter from "../../../src/lib/emailConcepts/plainLetter";
import * as pitBoard from "../../../src/lib/emailConcepts/pitBoard";
import * as editorial from "../../../src/lib/emailConcepts/editorial";
import * as raceCard from "../../../src/lib/emailConcepts/raceCard";

const CONCEPTS = [plainLetter, pitBoard, editorial, raceCard];

const SAMPLE = {
  username: "Paco",
  favoriteTeam: "McLaren",
  unsubscribeUrl:
    "https://www.stint-web.com/api/email/unsubscribe?token=sample&cat=all",
  siteUrl: "https://www.stint-web.com",
  raceName: "Monaco GP",
  raceCountry: "Monaco",
  raceRound: 6,
  score: 38,
  bestPick: { type: "winner", value: "Lando Norris", points: 25 },
};

const PAGE_BG = "#06101B";
const INK = "#F2F2F2";
const INK_SOFT = "#9FB0C2";
const HAIRLINE = "rgba(255,255,255,0.08)";
const ORANGE = "#FF6A1A";

const RISK_COLORS = {
  low: "#3DDC97",
  medium: "#FFB740",
  high: "#FF6A6A",
};

function ConceptBlock({ concept, isFirst }) {
  const { meta, welcomeHtml, resultsHtml } = concept;
  const welcome = welcomeHtml(SAMPLE);
  const results = resultsHtml(SAMPLE);
  const riskColor = RISK_COLORS[meta?.promotionsRisk] || INK_SOFT;

  return (
    <section
      style={{
        padding: "56px 0",
        borderTop: isFirst ? "none" : `1px solid ${HAIRLINE}`,
      }}
    >
      <header style={{ marginBottom: 28, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}>
          <h2
            style={{
              fontFamily:
                "'Sora', system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif",
              fontWeight: 900,
              fontSize: 40,
              lineHeight: 1.02,
              letterSpacing: "-0.035em",
              color: INK,
              margin: 0,
            }}
          >
            {meta?.name || "Untitled concept"}
          </h2>
          <span
            style={{
              fontFamily:
                "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
              fontSize: 11,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: riskColor,
              border: `1px solid ${riskColor}`,
              borderRadius: 999,
              padding: "4px 10px",
            }}
          >
            Promotions risk · {meta?.promotionsRisk || "unknown"}
          </span>
        </div>
        <p
          style={{
            color: INK_SOFT,
            fontSize: 15,
            lineHeight: 1.55,
            maxWidth: 760,
            margin: 0,
            fontFamily:
              "'Inter', system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif",
          }}
        >
          {meta?.description}
        </p>
      </header>

      <div className="stint-email-grid">
        <Frame label="Welcome" html={welcome} />
        <Frame label="Race results" html={results} />
      </div>
    </section>
  );
}

function Frame({ label, html }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div
        style={{
          fontFamily:
            "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
          fontSize: 11,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: INK_SOFT,
        }}
      >
        {label}
      </div>
      <iframe
        title={label}
        srcDoc={html}
        style={{
          width: "100%",
          height: 720,
          minHeight: 600,
          border: `1px solid ${HAIRLINE}`,
          borderRadius: 8,
          background: "#fff",
        }}
      />
    </div>
  );
}

export default function EmailConceptsPreviewPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: PAGE_BG,
        color: INK,
        fontFamily:
          "'Inter', system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif",
      }}
    >
      <style>{`
        .stint-email-grid {
          display: grid;
          gap: 24px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        @media (max-width: 880px) {
          .stint-email-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "72px 32px 96px",
        }}
      >
        <header
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
            paddingBottom: 28,
            borderBottom: `1px solid ${HAIRLINE}`,
          }}
        >
          <div
            style={{
              fontFamily:
                "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
              fontSize: 11,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: ORANGE,
            }}
          >
            Stint · internal preview
          </div>
          <h1
            style={{
              fontFamily:
                "'Sora', system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif",
              fontWeight: 900,
              fontSize: 56,
              lineHeight: 1,
              letterSpacing: "-0.04em",
              margin: 0,
            }}
          >
            Email design concepts
          </h1>
          <p
            style={{
              color: INK_SOFT,
              fontSize: 17,
              lineHeight: 1.5,
              maxWidth: 780,
              margin: 0,
            }}
          >
            Four candidate treatments for Stint transactional + lifecycle
            email. Each concept is shown in both its welcome and post-race
            results variants, rendered in an isolated iframe with sample data.
          </p>
        </header>

        {CONCEPTS.map((concept, i) => (
          <ConceptBlock
            key={concept?.meta?.name || i}
            concept={concept}
            isFirst={i === 0}
          />
        ))}

        <footer
          style={{
            marginTop: 56,
            paddingTop: 24,
            borderTop: `1px solid ${HAIRLINE}`,
            color: INK_SOFT,
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          These are previews using sample data. The chosen direction will be
          applied app-wide as the canonical Stint email system.
        </footer>
      </div>
    </main>
  );
}
