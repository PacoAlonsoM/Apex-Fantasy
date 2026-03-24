import { countdown, fmtFull, nextRace, raceSessions } from "../constants/calendar";
import {
  ACCENT,
  BG_BASE,
  CONTENT_MAX,
  HAIRLINE,
  LIFTED_SHADOW,
  MUTED_TEXT,
  PANEL_BG,
  PANEL_BG_ALT,
  RADIUS_MD,
  SECTION_RADIUS,
  SUBTLE_TEXT,
  TEXT_PRIMARY,
} from "../constants/design";
import { pageToHref } from "../routing";
import usePageMetadata from "../usePageMetadata";
import useViewport from "../useViewport";

const PICK_CATEGORIES = [
  ["Pole Position", "10 pts", "Who is quickest over one lap."],
  ["Race Winner", "25 pts", "Pick the Sunday winner."],
  ["2nd Place", "18 pts", "Who crosses the line in second."],
  ["3rd Place", "15 pts", "Who completes the podium."],
  ["DNF Driver", "12 pts", "Driver most likely not to finish."],
  ["Fastest Lap", "7 pts", "Late-race pace or outright control."],
  ["Driver of the Day", "6 pts", "Fan-voted race standout."],
  ["Best Constructor", "8 pts", "Team likely to own the weekend."],
  ["Safety Car?", "5 pts", "Call whether the race gets neutralised."],
  ["Red Flag?", "8 pts", "Read how chaotic the weekend could get."],
];

const SPRINT_EXTRAS = [
  ["Sprint Pole", "5 pts"],
  ["Sprint Winner", "12 pts"],
  ["Sprint 2nd", "9 pts"],
  ["Sprint 3rd", "7 pts"],
];

function CountdownUnit({ label, value }) {
  return (
    <div
      style={{
        borderRadius: RADIUS_MD,
        background: BG_BASE,
        padding: "14px 12px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1 }}>
        {String(value ?? 0).padStart(2, "0")}
      </div>
      <div
        style={{
          marginTop: 6,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: SUBTLE_TEXT,
        }}
      >
        {label}
      </div>
    </div>
  );
}

export default function PublicPicksPage({ user, demoMode = false, openAuth, openPredictionsForRace, setPage }) {
  const { isMobile, isTablet } = useViewport();
  const next = nextRace();
  const cd = next ? countdown(next.date) : null;
  const schedule = next ? raceSessions(next) : [];

  usePageMetadata({
    title: "How Stint Picks work",
    description:
      "Read how Stint Picks works before lock: categories, timing, sprint rules, and the next race context, all on a public page assistants can actually read.",
    path: "/picks",
  });

  const handleOpenRealPicks = () => {
    if (user || demoMode) {
      openPredictionsForRace?.(next?.r);
      return;
    }
    openAuth?.("login");
  };

  return (
    <div
      style={{
        maxWidth: CONTENT_MAX,
        margin: "0 auto",
        padding: isMobile ? "28px 20px 72px" : isTablet ? "34px 32px 88px" : "34px 48px 88px",
        position: "relative",
        zIndex: 1,
      }}
    >
      <section
        style={{
          display: "grid",
          gridTemplateColumns: isTablet ? "1fr" : "minmax(0,1.18fr) minmax(340px,420px)",
          gap: 24,
          alignItems: "start",
          marginBottom: 28,
        }}
      >
        <div style={{ display: "grid", gap: 20, paddingTop: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT }}>
            Public picks guide
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: isMobile ? 44 : isTablet ? 54 : 62,
              lineHeight: 0.96,
              letterSpacing: "-0.05em",
              fontWeight: 800,
            }}
          >
            Understand the board
            <br />
            before lock.
          </h1>
          <div style={{ maxWidth: 680, fontSize: 16, lineHeight: 1.7, color: MUTED_TEXT }}>
            This is the public, readable version of Picks. It explains how the board works, what users predict every weekend,
            when the board locks, and what changes on sprint weekends. The real personalised board stays inside the app.
          </div>

          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <a
              href={pageToHref(user || demoMode ? "predictions" : "public-picks", { demoMode, raceRound: next?.r })}
              onClick={(event) => {
                event.preventDefault();
                handleOpenRealPicks();
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 50,
                padding: "0 24px",
                borderRadius: RADIUS_MD,
                border: "none",
                background: "linear-gradient(135deg,#F97316,#EA580C)",
                color: TEXT_PRIMARY,
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 4px 16px rgba(249,115,22,0.25)",
                textDecoration: "none",
              }}
            >
              {user || demoMode ? "Open real picks" : "Log in to make picks"}
            </a>
            <a
              href={pageToHref("calendar", { demoMode })}
              onClick={(event) => {
                event.preventDefault();
                setPage?.("calendar");
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 50,
                padding: "0 24px",
                borderRadius: RADIUS_MD,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "transparent",
                color: TEXT_PRIMARY,
                fontSize: 15,
                fontWeight: 500,
                cursor: "pointer",
                textDecoration: "none",
              }}
            >
              View calendar first
            </a>
          </div>
        </div>

        {next && (
          <section
            style={{
              borderRadius: SECTION_RADIUS,
              background: PANEL_BG,
              boxShadow: LIFTED_SHADOW,
              overflow: "hidden",
            }}
          >
            <div style={{ height: 3, background: `linear-gradient(90deg, ${ACCENT}, rgba(249,115,22,0.08))` }} />
            <div style={{ padding: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 14 }}>
                Next lock
              </div>
              <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.04, marginBottom: 8 }}>
                {next.n}
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.55, color: MUTED_TEXT, marginBottom: 18 }}>
                {next.circuit} · {fmtFull(next.date)}
              </div>

              {cd && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 10, marginBottom: 16 }}>
                  <CountdownUnit label="Days" value={cd.d} />
                  <CountdownUnit label="Hours" value={cd.h} />
                  <CountdownUnit label="Minutes" value={cd.m} />
                </div>
              )}

              <div style={{ fontSize: 13, lineHeight: 1.6, color: MUTED_TEXT, marginBottom: 16 }}>
                The real board locks right before qualifying. Once the weekend passes, users can review scoring but they can no longer edit picks.
              </div>

              <div style={{ paddingTop: 14, borderTop: `1px solid ${HAIRLINE}` }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 10 }}>
                  What happens next
                </div>
                <div style={{ display: "grid", gap: 10 }}>
                  {schedule.slice(0, 3).map((session) => (
                    <div key={session.key} style={{ display: "grid", gridTemplateColumns: "86px 1fr", gap: 10 }}>
                      <strong style={{ fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", color: session.tone === "qualifying" ? ACCENT : SUBTLE_TEXT }}>
                        {session.label}
                      </strong>
                      <span style={{ fontSize: 13, color: TEXT_PRIMARY }}>{fmtFull(session.date)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}
      </section>

      <section style={{ display: "grid", gap: 22 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "minmax(0,1.1fr) minmax(260px,0.9fr)",
            gap: 22,
            alignItems: "start",
          }}
        >
          <article
            style={{
              borderRadius: SECTION_RADIUS,
              background: PANEL_BG,
              boxShadow: LIFTED_SHADOW,
              padding: isMobile ? 20 : 24,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 16 }}>
              Core race board
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "repeat(2,minmax(0,1fr))",
                gap: 12,
              }}
            >
              {PICK_CATEGORIES.map(([label, pts, hint]) => (
                <div
                  key={label}
                  style={{
                    borderRadius: 16,
                    background: PANEL_BG_ALT,
                    padding: "16px 16px 14px",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
                    <strong style={{ fontSize: 16, lineHeight: 1.15 }}>{label}</strong>
                    <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: ACCENT }}>
                      {pts}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.6, color: MUTED_TEXT }}>{hint}</div>
                </div>
              ))}
            </div>
          </article>

          <article
            style={{
              borderRadius: SECTION_RADIUS,
              background: PANEL_BG,
              boxShadow: LIFTED_SHADOW,
              padding: isMobile ? 20 : 24,
              display: "grid",
              gap: 18,
            }}
          >
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 12 }}>
                Sprint weekends
              </div>
              <div style={{ fontSize: 15, lineHeight: 1.65, color: MUTED_TEXT }}>
                Some rounds add a sprint layer. The public teaser explains it clearly, while the real board only shows those extra picks when the weekend format actually needs them.
              </div>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {SPRINT_EXTRAS.map(([label, pts]) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 14,
                    padding: "12px 14px",
                    borderRadius: 14,
                    background: PANEL_BG_ALT,
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <strong style={{ fontSize: 14 }}>{label}</strong>
                  <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: ACCENT }}>
                    {pts}
                  </span>
                </div>
              ))}
            </div>

            <div style={{ paddingTop: 16, borderTop: `1px solid ${HAIRLINE}`, display: "grid", gap: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT }}>
                Lock rules
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.65, color: MUTED_TEXT }}>
                Users can read the board publicly, but the real board stays private and personalised. Once qualifying begins, picks are locked. After the race is scored, the experience shifts from editing into review mode.
              </div>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
