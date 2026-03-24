import PublicShell from "../../src/public/PublicShell";
import { PAGE_META, TIMEZONE_LABEL, getCalendarGroups, getNextRaceSnapshot } from "../../src/public/siteData";

export const metadata = PAGE_META.calendar;

export default function CalendarPage() {
  const groups = getCalendarGroups();
  const race = getNextRaceSnapshot();

  return (
    <PublicShell active="calendar">
      <section className="public-hero">
        <div className="public-hero-copy">
          <div className="public-kicker">2026 calendar</div>
          <h1>Read the season as one race-week system.</h1>
          <p>
            Open any Grand Prix to see the exact session order, timezone-adjusted timing and the track context that matters
            before users move into picks.
          </p>
        </div>
        <aside className="public-card public-rail">
          <div className="public-eyebrow">Timezone</div>
          <h2>{TIMEZONE_LABEL}</h2>
          <div className="public-muted">All session times below follow the same timezone-adjusted view used across the public site.</div>
          <div className="public-eyebrow">Weekend timeline</div>
          <div className="public-pill-row">
            <span className="public-pill">{race.dateWindow}</span>
          </div>
          <h2 style={{ fontSize: 42 }}>{race.name}</h2>
          <div className="public-muted">{race.location}</div>
          <div className="public-timeline">
            {race.timeline.map((session) => (
              <div className="public-timeline-item" key={session.label}>
                <span className="public-dot" style={session.accent ? { background: session.accent, borderColor: session.accent } : undefined} />
                <div>
                  <strong>{session.label}</strong>
                  <div className="public-muted">{session.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className="public-stack">
        {groups.map((group) => (
          <div className="public-month-group" key={group.label}>
            <div className="public-month-label">{group.label}</div>
            {group.races.map((item) => (
              <article className={`public-race-row${item.active ? " is-active" : ""}`} key={item.round}>
                <div className="public-race-round">{item.round}</div>
                <div className="public-race-name">
                  <strong>{item.name}</strong>
                  <span>{item.location}</span>
                </div>
                {item.sprint ? <span className="public-pill">Sprint weekend</span> : <span />}
                <div className="public-race-date">{item.dateWindow}</div>
              </article>
            ))}
          </div>
        ))}
      </section>
    </PublicShell>
  );
}
