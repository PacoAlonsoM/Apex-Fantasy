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
import PageHeader from "./PageHeader";

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
    title: "STINT Picks",
    description:
      "See the STINT board, the lock timing, and the categories that matter before the weekend closes.",
    path: "/picks",
  });

  const handleOpenRealPicks = () => {
    if (user || demoMode) {
      openPredictionsForRace?.(next?.r);
      return;
    }
    openAuth?.("register", { page: "predictions", raceRound: next?.r });
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
      <PageHeader
        eyebrow="Picks"
        title="See the board before lock."
        description="The real board closes right before qualifying. These are the categories players submit each weekend."
        actions={(
          <>
            <a
              href={pageToHref(user || demoMode ? "predictions" : "public-picks", { demoMode, raceRound: next?.r })}
              onClick={(event) => {
                event.preventDefault();
                handleOpenRealPicks();
              }}
              className="stint-button"
            >
              {user || demoMode ? "Open picks" : "Create account to make picks"}
            </a>
          </>
        )}
        aside={next ? (
          <section
            style={{
              display: "grid",
              gap: 10,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: SUBTLE_TEXT }}>
              Next lock
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.05em", lineHeight: 1 }}>{next.n}</div>
            <div style={{ fontSize: 13, lineHeight: 1.7, color: MUTED_TEXT }}>{next.circuit} · {fmtFull(next.date)}</div>
            {cd && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 8 }}>
                <CountdownUnit label="Days" value={cd.d} />
                <CountdownUnit label="Hours" value={cd.h} />
                <CountdownUnit label="Minutes" value={cd.m} />
              </div>
            )}
            <div style={{ fontSize: 12, lineHeight: 1.7, color: MUTED_TEXT }}>
              The real board locks right before qualifying, then shifts from editing into review mode after scoring.
            </div>
          </section>
        ) : null}
        marginBottom={26}
      />

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
              border: "1px solid rgba(214,223,239,0.08)",
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
              border: "1px solid rgba(214,223,239,0.08)",
            }}
          >
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 12 }}>
                Sprint weekends
              </div>
              <div style={{ fontSize: 15, lineHeight: 1.65, color: MUTED_TEXT }}>
                Sprint rounds add four extra categories. They only appear when the selected weekend actually uses the sprint format.
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
                Once qualifying begins, picks are locked. After the race is scored, the board shifts from editing into review mode.
              </div>
            </div>
          </article>
        </div>
      </section>

      {isMobile && (
        <div style={{ position: "sticky", bottom: 14, marginTop: 18, zIndex: 5 }}>
          <a
            href={pageToHref(user || demoMode ? "predictions" : "public-picks", { demoMode, raceRound: next?.r })}
            onClick={(event) => {
              event.preventDefault();
              handleOpenRealPicks();
            }}
            className="stint-button"
            style={{ width: "100%" }}
          >
            {user || demoMode ? "Open picks" : "Create account to make picks"}
          </a>
        </div>
      )}
    </div>
  );
}
