import { useEffect, useMemo, useState } from "react";
import { CAL } from "@/src/constants/calendar";
import { TEAMS } from "@/src/constants/teams";
import {
  ACCENT,
  CARD_RADIUS,
  HAIRLINE,
  LIFTED_SHADOW,
  MUTED_TEXT,
  PANEL_BG,
  PANEL_BG_ALT,
  PANEL_BORDER,
  SECTION_RADIUS,
  SOFT_SHADOW,
  SUBTLE_TEXT,
  TEXT_PRIMARY,
} from "@/src/constants/design";
import { fetchSeasonStandings } from "@/src/lib/openf1";
import { IS_SNAPSHOT } from "@/src/lib/runtimeFlags";
import usePageMetadata from "@/src/lib/usePageMetadata";
import useViewport from "@/src/lib/useViewport";
import { hexToRgba } from "@/src/lib/colors";
import PageMasthead from "@/src/ui/PageMasthead";
import PageShell from "@/src/ui/PageShell";

function teamAccent(teamName) {
  return TEAMS[teamName]?.c || "#94a3b8";
}

function teamSoft(teamName) {
  return TEAMS[teamName]?.soft || "rgba(148,163,184,0.12)";
}

function formatRoundDate(value) {
  if (!value) return "No completed race yet";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function DriversTable({ rows, isMobile }) {
  if (!rows.length) {
    return (
      <div style={{ padding: "26px 24px", color: MUTED_TEXT, fontSize: 14 }}>
        No completed race sessions have been processed yet.
      </div>
    );
  }

  return (
    <div className="stnt-stagger">
      {rows.map((row, index) => {
        const accent = teamAccent(row.team);
        const soft = teamSoft(row.team);

        return (
          <div
            key={`${row.driverNumber || row.name}-${row.rank}`}
            className="stnt-driver-row"
            style={{
              display: "grid",
              gridTemplateColumns: isMobile
                ? "56px minmax(0,1fr) 72px"
                : "60px minmax(0,1.4fr) minmax(130px,0.6fr) 100px 88px",
              gap: 0,
              alignItems: "center",
              borderBottom: index < rows.length - 1 ? `1px solid ${HAIRLINE}` : "none",
            }}
          >
            {/* Rank badge */}
            <div style={{ padding: isMobile ? "14px 8px" : "16px 12px", display: "flex", justifyContent: "center" }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 11,
                  display: "grid",
                  placeItems: "center",
                  fontWeight: 900,
                  fontSize: 17,
                  background: soft,
                  color: accent,
                  border: `1px solid ${accent}33`,
                }}
              >
                {row.rank}
              </div>
            </div>

            {/* Name + team */}
            <div style={{ padding: isMobile ? "14px 0 14px 4px" : "16px 0 16px 4px", minWidth: 0 }}>
              <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 900, letterSpacing: -0.5, marginBottom: 3 }}>
                {row.name}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", color: MUTED_TEXT, fontSize: 12 }}>
                <span>{row.team}</span>
                {row.driverNumber ? (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      minWidth: 30,
                      height: 20,
                      padding: "0 6px",
                      borderRadius: 999,
                      background: "rgba(148,163,184,0.1)",
                      border: "1px solid rgba(148,163,184,0.12)",
                      fontWeight: 800,
                      color: "var(--text)",
                      fontSize: 11,
                    }}
                  >
                    #{row.driverNumber}
                  </span>
                ) : null}
              </div>
              {isMobile && (
                <div style={{ display: "flex", gap: 10, marginTop: 4, fontSize: 11, color: MUTED_TEXT }}>
                  <span>
                    <span style={{ color: "var(--text)", fontWeight: 800 }}>{row.wins}</span>W ·{" "}
                    <span style={{ color: "var(--text)", fontWeight: 800 }}>{row.podiums}</span>P
                  </span>
                  {row.rank > 1 && (
                    <span>+{row.gapToLeader}</span>
                  )}
                </div>
              )}
            </div>

            {/* Stats — desktop */}
            {!isMobile ? (
              <div style={{ display: "flex", gap: 14, fontSize: 13, color: MUTED_TEXT, padding: "0 12px" }}>
                <span>
                  <span style={{ color: "var(--text)", fontWeight: 800 }}>{row.wins}</span>W
                </span>
                <span>
                  <span style={{ color: "var(--text)", fontWeight: 800 }}>{row.podiums}</span>P
                </span>
                {row.sprintWins > 0 && (
                  <span>
                    <span style={{ color: "var(--text)", fontWeight: 800 }}>{row.sprintWins}</span>S
                  </span>
                )}
              </div>
            ) : null}

            {/* Gap — desktop */}
            {!isMobile ? (
              <div style={{ textAlign: "right", padding: "0 16px 0 0" }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: row.rank === 1 ? "var(--text-subtle)" : MUTED_TEXT }}>
                  {row.rank === 1 ? "—" : `+${row.gapToLeader}`}
                </div>
              </div>
            ) : null}

            {/* Points */}
            <div style={{ textAlign: "right", padding: isMobile ? "0 16px 0 0" : "0 20px 0 0" }}>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: isMobile ? 22 : 28,
                  fontWeight: 700,
                  letterSpacing: -0.5,
                  fontVariantNumeric: "tabular-nums",
                  color: TEXT_PRIMARY,
                }}
              >
                {row.points}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ConstructorsTable({ rows, isMobile }) {
  if (!rows.length) {
    return (
      <div style={{ padding: "26px 24px", color: MUTED_TEXT, fontSize: 14 }}>
        No completed constructor standings have been processed yet.
      </div>
    );
  }

  return (
    <div className="stnt-stagger">
      {rows.map((row, index) => {
        const accent = teamAccent(row.team);
        const soft = teamSoft(row.team);

        return (
          <div
            key={`${row.team}-${row.rank}`}
            className="stnt-driver-row"
            style={{
              display: "grid",
              gridTemplateColumns: isMobile
                ? "56px minmax(0,1fr) 72px"
                : "60px minmax(0,1.4fr) minmax(130px,0.6fr) 100px 88px",
              gap: 0,
              alignItems: "center",
              borderBottom: index < rows.length - 1 ? `1px solid ${HAIRLINE}` : "none",
            }}
          >
            {/* Rank badge */}
            <div style={{ padding: isMobile ? "14px 8px" : "16px 12px", display: "flex", justifyContent: "center" }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 11,
                  display: "grid",
                  placeItems: "center",
                  fontWeight: 900,
                  fontSize: 17,
                  background: soft,
                  color: accent,
                  border: `1px solid ${accent}33`,
                }}
              >
                {row.rank}
              </div>
            </div>

            {/* Team name */}
            <div style={{ padding: isMobile ? "14px 0 14px 4px" : "16px 0 16px 4px", minWidth: 0 }}>
              <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 900, letterSpacing: -0.5, marginBottom: 3 }}>
                {row.team}
              </div>
              <div style={{ color: MUTED_TEXT, fontSize: 12 }}>
                <span style={{ color: "var(--text)", fontWeight: 800 }}>{row.wins}</span>W ·{" "}
                <span style={{ color: "var(--text)", fontWeight: 800 }}>{row.podiums}</span>P ·{" "}
                <span style={{ color: "var(--text)", fontWeight: 800 }}>{row.sprintWins}</span>S
              </div>
            </div>

            {/* Stats — desktop */}
            {!isMobile ? (
              <div style={{ display: "flex", gap: 14, fontSize: 13, color: MUTED_TEXT, padding: "0 12px" }}>
                <span><span style={{ color: "var(--text)", fontWeight: 800 }}>{row.wins}</span>W</span>
                <span><span style={{ color: "var(--text)", fontWeight: 800 }}>{row.podiums}</span>P</span>
                {row.sprintWins > 0 && (
                  <span><span style={{ color: "var(--text)", fontWeight: 800 }}>{row.sprintWins}</span>S</span>
                )}
              </div>
            ) : null}

            {/* Gap — desktop */}
            {!isMobile ? (
              <div style={{ textAlign: "right", padding: "0 16px 0 0" }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: row.rank === 1 ? "var(--text-subtle)" : MUTED_TEXT }}>
                  {row.rank === 1 ? "—" : `+${row.gapToLeader}`}
                </div>
              </div>
            ) : null}

            {/* Points */}
            <div style={{ textAlign: "right", padding: isMobile ? "0 16px 0 0" : "0 20px 0 0" }}>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: isMobile ? 22 : 28,
                  fontWeight: 700,
                  letterSpacing: -0.5,
                  fontVariantNumeric: "tabular-nums",
                  color: TEXT_PRIMARY,
                }}
              >
                {row.points}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function StandingsPage({ compact = false }) {
  const { isMobile, isTablet } = useViewport();
  const [tab, setTab] = useState("drivers");
  const [standings, setStandings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  usePageMetadata({
    title: "F1 Championship Standings",
    description: "Track the live Formula 1 drivers and constructors standings in one clean championship view built around completed race-week results.",
    skip: compact,
    path: "/leaderboard",
  });

  const seasonYear = useMemo(
    () => Math.max(...CAL.map((race) => Number(String(race.date).slice(0, 4)) || new Date().getFullYear())),
    []
  );

  useEffect(() => {
    let active = true;

    async function loadStandings() {
      setLoading(true);
      setError("");

      try {
        const live = await fetchSeasonStandings(seasonYear, { includeSprints: !IS_SNAPSHOT });
        if (!active) return;
        setStandings(live);
      } catch (loadError) {
        if (!active) return;
        setStandings(null);
        setError(loadError instanceof Error ? loadError.message : "Could not load championship standings.");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadStandings();
    return () => {
      active = false;
    };
  }, [seasonYear]);

  const driverLeader = standings?.drivers?.[0] || null;
  const constructorLeader = standings?.constructors?.[0] || null;
  const lastRaceName = standings?.lastRace?.name || "Waiting for first result";
  const lastRaceDate = standings?.lastRace?.date ? formatRoundDate(standings.lastRace.date) : "No completed race yet";
  const currentRows = tab === "drivers" ? (standings?.drivers || []) : (standings?.constructors || []);

  const content = (
    // Width + padding owned by PageShell (or by the parent in `compact` mode).
    // No inline maxWidth here — that's the system rule.
    <div data-page-density="dense" style={{ position: "relative", zIndex: 1 }}>
      <style>{`
        .stnt-tab,.stnt-vtab{white-space:nowrap;transition:background 110ms ease,border-color 110ms ease,color 100ms ease,transform 90ms cubic-bezier(0.23,1,0.32,1)!important}
        .stnt-tab:active,.stnt-vtab:active{transform:scale(0.97)!important}
        .stnt-tab:focus-visible,.stnt-vtab:focus-visible{outline:2px solid rgba(255,106,26,0.5);outline-offset:2px}
        .stnt-driver-row{transition:background 70ms ease,transform 70ms cubic-bezier(0.23,1,0.32,1)}
        .stnt-driver-row:active{transform:scale(0.995)!important}
        @media(hover:hover)and(pointer:fine){.stnt-driver-row:hover{background:var(--btn-secondary-bg)}}
        @keyframes stntUp{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
        .stnt-in{animation:stntUp 180ms cubic-bezier(0.23,1,0.32,1) both}
        .stnt-stagger>*{animation:stntUp 200ms cubic-bezier(0.23,1,0.32,1) both}
        .stnt-stagger>*:nth-child(1){animation-delay:0ms}
        .stnt-stagger>*:nth-child(2){animation-delay:22ms}
        .stnt-stagger>*:nth-child(3){animation-delay:44ms}
        .stnt-stagger>*:nth-child(4){animation-delay:66ms}
        .stnt-stagger>*:nth-child(5){animation-delay:88ms}
        .stnt-stagger>*:nth-child(6){animation-delay:110ms}
        .stnt-stagger>*:nth-child(7){animation-delay:132ms}
        .stnt-stagger>*:nth-child(8){animation-delay:150ms}
        .stnt-stagger>*:nth-child(n+9){animation-delay:150ms}
        @media(prefers-reduced-motion:reduce){
          .stnt-tab,.stnt-vtab,.stnt-driver-row{transition:none!important}
          .stnt-in,.stnt-stagger>*{animation:none!important}
        }
      `}</style>

      {/* ── Hero section ── */}
      <section
        style={{
          borderRadius: SECTION_RADIUS,
          border: PANEL_BORDER,
          background: PANEL_BG,
          boxShadow: LIFTED_SHADOW,
          overflow: "hidden",
          marginBottom: 18,
        }}
      >
        <PageMasthead
          variant="flush"
          marginBottom={0}
          eyebrow={loading ? "Loading standings" : `${seasonYear} championship standings`}
          title={<>Real championship standings.<br />Drivers and constructors.</>}
          description="Live F1 season standings from completed OpenF1 race and sprint sessions. Fantasy scoring lives in your picks history and leagues."
          image={compact ? null : { src: "/images/Car%20queue.png" }}
          tone={compact ? "flat" : "ambient"}
          minHeight={compact ? 0 : (isMobile ? 0 : isTablet ? 240 : 280)}
          style={{ padding: isMobile ? "24px 20px" : "28px 30px 24px" }}
          aside={(
            <div style={{ display: "grid", gap: 6 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: SUBTLE_TEXT,
                }}
              >
                Last completed round
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.8, lineHeight: 1.1 }}>
                {lastRaceName}
              </div>
              <div style={{ fontSize: 12, color: MUTED_TEXT }}>{lastRaceDate}</div>
              {driverLeader && (
                <div style={{ marginTop: 6, paddingTop: 8, borderTop: `1px solid ${HAIRLINE}`, fontSize: 12, color: MUTED_TEXT }}>
                  <span style={{ color: teamAccent(driverLeader.team), fontWeight: 800 }}>{driverLeader.name}</span>
                  {" "}leads ·{" "}
                  <span style={{ color: "var(--text)", fontWeight: 700 }}>{driverLeader.points} pts</span>
                </div>
              )}
            </div>
          )}
        />

        {error ? (
          <div
            style={{
              margin: 18,
              borderRadius: CARD_RADIUS,
              border: "1px solid rgba(245,158,11,0.22)",
              background: "rgba(245,158,11,0.08)",
              padding: "12px 14px",
              color: "var(--text-pro)",
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            {error}
          </div>
        ) : null}

        {/* Season summary stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,minmax(0,1fr))",
            gap: 1,
            background: HAIRLINE,
            borderTop: `1px solid ${HAIRLINE}`,
          }}
        >
          {[
            {
              label: "Drivers leader",
              value: driverLeader?.name || "—",
              sub: driverLeader ? `${driverLeader.points} pts` : "No results yet",
              accent: teamAccent(driverLeader?.team),
            },
            {
              label: "Constructors leader",
              value: constructorLeader?.team || "—",
              sub: constructorLeader ? `${constructorLeader.points} pts` : "No results yet",
              accent: teamAccent(constructorLeader?.team),
            },
            {
              label: "Completed rounds",
              value: String(standings?.completedRounds || 0),
              sub: "Grand Prix races",
              accent: "var(--text-pro)",
            },
            {
              label: "Sprint sessions",
              value: String(standings?.completedSprints || 0),
              sub: "Already counted",
              accent: "var(--text-ai)",
            },
          ].map((stat) => (
            <div key={stat.label} style={{ padding: "14px 16px", background: PANEL_BG }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: SUBTLE_TEXT,
                  marginBottom: 6,
                }}
              >
                {stat.label}
              </div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 900,
                  letterSpacing: -0.6,
                  color: stat.accent,
                  marginBottom: 3,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {stat.value}
              </div>
              <div style={{ fontSize: 11, color: MUTED_TEXT }}>{stat.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Tab selector ── */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        {[
          { key: "drivers", label: "Drivers Championship" },
          { key: "constructors", label: "Constructors Championship" },
        ].map((item) => {
          const active = tab === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className="stnt-tab"
              style={{
                border: active ? `1px solid ${hexToRgba(ACCENT, 0.30)}` : "1px solid rgba(148,163,184,0.14)",
                background: active ? hexToRgba(ACCENT, 0.13) : "var(--btn-secondary-bg)",
                color: active ? ACCENT : MUTED_TEXT,
                borderRadius: 999,
                padding: "10px 16px",
                fontSize: 13,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {/* ── Championship table ── */}
      <section
        style={{
          borderRadius: SECTION_RADIUS,
          border: PANEL_BORDER,
          background: PANEL_BG,
          boxShadow: SOFT_SHADOW,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: isMobile ? "16px 18px 14px" : "20px 24px 16px",
            borderBottom: `1px solid ${HAIRLINE}`,
            background: PANEL_BG_ALT,
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: SUBTLE_TEXT,
                marginBottom: 6,
              }}
            >
              {tab === "drivers" ? "Drivers championship" : "Constructors championship"}
            </div>
            <div style={{ fontSize: isMobile ? 20 : 28, fontWeight: 900, letterSpacing: -0.8 }}>
              {tab === "drivers" ? "Every driver ranked by season points" : "Every constructor ranked by season points"}
            </div>
          </div>
          {!loading && currentRows.length > 0 && (
            <div style={{ fontSize: 12, color: MUTED_TEXT, flexShrink: 0 }}>
              {currentRows.length} {tab === "drivers" ? "drivers" : "constructors"}
            </div>
          )}
        </div>

        {loading ? (
          <div style={{ padding: "26px 24px", color: MUTED_TEXT, fontSize: 14 }}>
            Loading championship table…
          </div>
        ) : tab === "drivers" ? (
          <div key="drivers" className="stnt-in">
            <DriversTable rows={currentRows} isMobile={isMobile} />
          </div>
        ) : (
          <div key="constructors" className="stnt-in">
            <ConstructorsTable rows={currentRows} isMobile={isMobile} />
          </div>
        )}
      </section>
    </div>
  );

  // When compact (rendered inside Community), skip PageShell — the parent
  // owns the page chrome. Standalone use (`/leaderboard`) wraps in PageShell.
  if (compact) return content;
  return (
    <PageShell tone="ambient" ambient="glow" density="dense">
      {content}
    </PageShell>
  );
}
