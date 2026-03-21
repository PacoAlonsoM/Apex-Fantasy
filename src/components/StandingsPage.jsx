import { useEffect, useMemo, useState } from "react";
import { CAL } from "../constants/calendar";
import { TEAMS } from "../constants/teams";
import {
  CARD_RADIUS,
  CONTENT_MAX,
  HAIRLINE,
  LIFTED_SHADOW,
  MUTED_TEXT,
  PANEL_BG,
  PANEL_BG_ALT,
  PANEL_BG_STRONG,
  PANEL_BORDER,
  SECTION_RADIUS,
  SOFT_SHADOW,
  SUBTLE_TEXT,
} from "../constants/design";
import { fetchSeasonStandings } from "../openf1";
import { IS_SNAPSHOT } from "../runtimeFlags";
import usePageMetadata from "../usePageMetadata";
import useViewport from "../useViewport";

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

function StatCard({ label, value, detail, accent = "#f8fafc" }) {
  return (
    <div
      style={{
        borderRadius: CARD_RADIUS,
        border: PANEL_BORDER,
        background: PANEL_BG_ALT,
        padding: "18px 18px 16px",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: SUBTLE_TEXT,
          marginBottom: 10,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: -0.8, color: accent, marginBottom: 8 }}>
        {value}
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.6, color: MUTED_TEXT }}>{detail}</div>
    </div>
  );
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
    <div>
      {rows.map((row, index) => {
        const accent = teamAccent(row.team);
        const soft = teamSoft(row.team);

        return (
          <div
            key={`${row.driverNumber || row.name}-${row.rank}`}
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "56px 1fr 90px" : "64px minmax(220px,1.2fr) minmax(180px,1fr) 120px 110px",
              gap: 14,
              alignItems: "center",
              padding: isMobile ? "14px 16px" : "16px 20px",
              borderBottom: index < rows.length - 1 ? `1px solid ${HAIRLINE}` : "none",
            }}
          >
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 14,
                display: "grid",
                placeItems: "center",
                fontWeight: 900,
                fontSize: 20,
                background: soft,
                color: accent,
                border: `1px solid ${accent}33`,
              }}
            >
              {row.rank}
            </div>

            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 900, letterSpacing: -0.5, marginBottom: 4 }}>
                {row.name}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", color: MUTED_TEXT, fontSize: 13 }}>
                <span>{row.team}</span>
                {row.driverNumber ? (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      minWidth: 34,
                      height: 24,
                      padding: "0 8px",
                      borderRadius: 999,
                      background: "rgba(148,163,184,0.12)",
                      border: "1px solid rgba(148,163,184,0.14)",
                      fontWeight: 800,
                      color: "#dbe4f0",
                    }}
                  >
                    #{row.driverNumber}
                  </span>
                ) : null}
              </div>
            </div>

            {!isMobile ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8, fontSize: 13, color: MUTED_TEXT }}>
                <div>Wins: <span style={{ color: "#fff", fontWeight: 800 }}>{row.wins}</span></div>
                <div>Podiums: <span style={{ color: "#fff", fontWeight: 800 }}>{row.podiums}</span></div>
                <div>Sprint wins: <span style={{ color: "#fff", fontWeight: 800 }}>{row.sprintWins}</span></div>
                <div>Best finish: <span style={{ color: "#fff", fontWeight: 800 }}>{row.bestFinish ? `P${row.bestFinish}` : "—"}</span></div>
              </div>
            ) : null}

            <div style={{ textAlign: isMobile ? "right" : "center" }}>
              <div style={{ fontSize: 13, color: SUBTLE_TEXT, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
                Gap
              </div>
              <div style={{ fontSize: 18, fontWeight: 900 }}>
                {row.rank === 1 ? "Leader" : `+${row.gapToLeader}`}
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: -1.2 }}>{row.points}</div>
              <div style={{ fontSize: 12, color: SUBTLE_TEXT, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Points
              </div>
            </div>

            {isMobile ? (
              <div style={{ gridColumn: "2 / -1", display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8, fontSize: 12, color: MUTED_TEXT }}>
                <div>Wins: <span style={{ color: "#fff", fontWeight: 800 }}>{row.wins}</span></div>
                <div>Podiums: <span style={{ color: "#fff", fontWeight: 800 }}>{row.podiums}</span></div>
                <div>Sprint wins: <span style={{ color: "#fff", fontWeight: 800 }}>{row.sprintWins}</span></div>
                <div>Best finish: <span style={{ color: "#fff", fontWeight: 800 }}>{row.bestFinish ? `P${row.bestFinish}` : "—"}</span></div>
              </div>
            ) : null}
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
    <div>
      {rows.map((row, index) => {
        const accent = teamAccent(row.team);
        const soft = teamSoft(row.team);

        return (
          <div
            key={`${row.team}-${row.rank}`}
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "56px minmax(0,1fr) 90px" : "64px minmax(220px,1.2fr) minmax(200px,1fr) 120px 110px",
              gap: 14,
              alignItems: "center",
              padding: isMobile ? "14px 16px" : "16px 20px",
              borderBottom: index < rows.length - 1 ? `1px solid ${HAIRLINE}` : "none",
            }}
          >
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 14,
                display: "grid",
                placeItems: "center",
                fontWeight: 900,
                fontSize: 20,
                background: soft,
                color: accent,
                border: `1px solid ${accent}33`,
              }}
            >
              {row.rank}
            </div>

            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 900, letterSpacing: -0.5, marginBottom: 4 }}>
                {row.team}
              </div>
              <div style={{ color: MUTED_TEXT, fontSize: 13 }}>
                {row.wins} wins · {row.podiums} podiums · {row.sprintWins} sprint wins
              </div>
            </div>

            {!isMobile ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8, fontSize: 13, color: MUTED_TEXT }}>
                <div>Wins: <span style={{ color: "#fff", fontWeight: 800 }}>{row.wins}</span></div>
                <div>Podiums: <span style={{ color: "#fff", fontWeight: 800 }}>{row.podiums}</span></div>
                <div>Sprint wins: <span style={{ color: "#fff", fontWeight: 800 }}>{row.sprintWins}</span></div>
                <div>Gap: <span style={{ color: "#fff", fontWeight: 800 }}>{row.rank === 1 ? "Leader" : `+${row.gapToLeader}`}</span></div>
              </div>
            ) : null}

            <div style={{ textAlign: isMobile ? "right" : "center" }}>
              <div style={{ fontSize: 13, color: SUBTLE_TEXT, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
                Gap
              </div>
              <div style={{ fontSize: 18, fontWeight: 900 }}>
                {row.rank === 1 ? "Leader" : `+${row.gapToLeader}`}
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: -1.2 }}>{row.points}</div>
              <div style={{ fontSize: 12, color: SUBTLE_TEXT, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Points
              </div>
            </div>

            {isMobile ? (
              <div style={{ gridColumn: "2 / -1", display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8, fontSize: 12, color: MUTED_TEXT }}>
                <div>Wins: <span style={{ color: "#fff", fontWeight: 800 }}>{row.wins}</span></div>
                <div>Podiums: <span style={{ color: "#fff", fontWeight: 800 }}>{row.podiums}</span></div>
                <div>Sprint wins: <span style={{ color: "#fff", fontWeight: 800 }}>{row.sprintWins}</span></div>
                <div>Gap: <span style={{ color: "#fff", fontWeight: 800 }}>{row.rank === 1 ? "Leader" : `+${row.gapToLeader}`}</span></div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default function StandingsPage() {
  const { isMobile, isTablet } = useViewport();
  const [tab, setTab] = useState("drivers");
  const [standings, setStandings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  usePageMetadata({
    title: "F1 Leaderboard",
    description: "Track the live Formula 1 drivers and constructors standings in one clean public leaderboard built around completed race-week results.",
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

  return (
    <div
      style={{
        maxWidth: CONTENT_MAX,
        margin: "0 auto",
        padding: isMobile ? "28px 18px 72px" : isTablet ? "34px 22px 80px" : "38px 28px 84px",
        position: "relative",
        zIndex: 1,
      }}
    >
      <section
        style={{
          borderRadius: SECTION_RADIUS,
          border: PANEL_BORDER,
          background: `linear-gradient(180deg,rgba(10,18,32,0.98),${PANEL_BG_STRONG})`,
          boxShadow: LIFTED_SHADOW,
          overflow: "hidden",
          marginBottom: 18,
        }}
      >
        <div style={{ padding: isMobile ? "22px 20px" : "28px 30px", borderBottom: `1px solid ${HAIRLINE}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ maxWidth: 760 }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "7px 12px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(148,163,184,0.12)",
                  marginBottom: 18,
                }}
              >
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: loading ? "#facc15" : "#34d399" }} />
                <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#dbe4f0" }}>
                  {loading ? "Loading standings" : `${seasonYear} season standings`}
                </span>
              </div>

              <h1 style={{ fontSize: isMobile ? 38 : 54, lineHeight: 0.98, margin: "0 0 12px", letterSpacing: isMobile ? -1.4 : -2.4 }}>
                Real championship leaderboard.
                <br />
                Drivers and constructors.
              </h1>
              <div style={{ maxWidth: 720, fontSize: 14, lineHeight: 1.82, color: MUTED_TEXT }}>
                This page now pulls the actual F1 season standings from completed OpenF1 race and sprint sessions. Fantasy user scoring still lives in your picks history, profile, and leagues.
              </div>
            </div>

            <div
              style={{
                minWidth: isMobile ? "100%" : 280,
                borderRadius: CARD_RADIUS,
                border: "1px solid rgba(249,115,22,0.18)",
                background: "linear-gradient(180deg,rgba(249,115,22,0.08),rgba(26,39,64,0.9))",
                padding: "16px 18px",
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 8 }}>
                Last completed round
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: -1.1, marginBottom: 4 }}>{lastRaceName}</div>
              <div style={{ fontSize: 13, color: MUTED_TEXT, marginBottom: 10 }}>{lastRaceDate}</div>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#7dd3fc" }}>
                Live OpenF1 standings
              </div>
            </div>
          </div>
        </div>

        {error ? (
          <div
            style={{
              margin: 18,
              borderRadius: CARD_RADIUS,
              border: "1px solid rgba(245,158,11,0.22)",
              background: "rgba(245,158,11,0.08)",
              padding: "12px 14px",
              color: "#fde68a",
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            {error}
          </div>
        ) : null}

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,minmax(0,1fr))" : "repeat(4,minmax(0,1fr))", gap: 12, padding: 18 }}>
          <StatCard
            label="Drivers leader"
            value={driverLeader?.name || "—"}
            detail={driverLeader ? `${driverLeader.points} pts · ${driverLeader.team}` : "No completed rounds yet"}
            accent={teamAccent(driverLeader?.team)}
          />
          <StatCard
            label="Constructors leader"
            value={constructorLeader?.team || "—"}
            detail={constructorLeader ? `${constructorLeader.points} pts` : "No completed rounds yet"}
            accent={teamAccent(constructorLeader?.team)}
          />
          <StatCard
            label="Completed rounds"
            value={String(standings?.completedRounds || 0)}
            detail="Grand Prix races already finished"
            accent="#fde68a"
          />
          <StatCard
            label="Sprint rounds"
            value={String(standings?.completedSprints || 0)}
            detail="Sprint sessions already counted"
            accent="#93c5fd"
          />
        </div>
      </section>

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          { key: "drivers", label: "Drivers Championship" },
          { key: "constructors", label: "Constructors Championship" },
        ].map((item) => {
          const active = tab === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              style={{
                border: active ? "1px solid rgba(249,115,22,0.28)" : "1px solid rgba(148,163,184,0.14)",
                background: active ? "rgba(249,115,22,0.10)" : "rgba(255,255,255,0.03)",
                color: active ? "#fff" : MUTED_TEXT,
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

      <section
        style={{
          borderRadius: SECTION_RADIUS,
          border: PANEL_BORDER,
          background: PANEL_BG,
          boxShadow: SOFT_SHADOW,
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "22px 24px 18px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 10 }}>
            {tab === "drivers" ? "Drivers championship" : "Constructors championship"}
          </div>
          <div style={{ fontSize: isMobile ? 24 : 34, fontWeight: 900, letterSpacing: -1.1, marginBottom: 8 }}>
            {tab === "drivers" ? "Every driver ranked by season points" : "Every constructor ranked by season points"}
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.75, color: MUTED_TEXT }}>
            {tab === "drivers"
              ? "Live cumulative standings from completed race and sprint sessions, including gap to the leader."
              : "Constructor totals built from the same completed sessions and points flow."}
          </div>
        </div>

        {loading ? (
          <div style={{ padding: "26px 24px", color: MUTED_TEXT, fontSize: 14 }}>
            Loading the real championship table...
          </div>
        ) : tab === "drivers" ? (
          <DriversTable rows={currentRows} isMobile={isMobile} />
        ) : (
          <ConstructorsTable rows={currentRows} isMobile={isMobile} />
        )}
      </section>
    </div>
  );
}
