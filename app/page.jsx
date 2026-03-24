import Link from "next/link";
import PublicShell from "../src/public/PublicShell";
import { PAGE_META, getNextRaceSnapshot, leaderboardRows, wireStories } from "../src/public/siteData";

export const metadata = PAGE_META.home;

export default function HomePage() {
  const race = getNextRaceSnapshot();

  return (
    <PublicShell active="home">
      <section className="public-hero">
        <div className="public-hero-copy">
          <div className="public-kicker">Public home</div>
          <h1>
            Compete hard.
            <br />
            Predict sharp.
            <br />
            <span className="public-gradient-text">Win your league.</span>
          </h1>
          <p>
            STINT gives players one clean place to read the weekend, understand the board and move into picks with better
            timing. The public site explains the product clearly before the private app takes over.
          </p>
          <div className="public-actions">
            <Link className="public-button is-primary" href={race.appHref}>
              Make picks
            </Link>
            <Link className="public-button" href="/calendar">
              View calendar
            </Link>
          </div>
        </div>

        <aside className="public-card public-rail">
          <div className="public-eyebrow">Next race</div>
          <h2>{race.name}</h2>
          <div className="public-muted">
            {race.circuit} · {race.dateLabel}
          </div>
          <div className="public-countdown">
            <div>
              <strong>{race.countdown.days}</strong>
              <span>Days</span>
            </div>
            <div>
              <strong>{race.countdown.hours}</strong>
              <span>Hours</span>
            </div>
            <div>
              <strong>{race.countdown.minutes}</strong>
              <span>Minutes</span>
            </div>
          </div>
          <div className="public-muted">Picks close right before qualifying begins.</div>
          <div className="public-eyebrow">Weekend timeline</div>
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
          <Link className="public-button is-primary public-full" href={race.appHref}>
            Make picks for this race
          </Link>
        </aside>
      </section>

      <section className="public-feature-grid">
        <div className="public-feature-card">
          <div className="public-eyebrow">Calendar</div>
          <h3>Read the season as one system</h3>
          <p>Every round, every sprint weekend, every lock point and every session in one clear structure.</p>
        </div>
        <div className="public-feature-card">
          <div className="public-eyebrow">Wire</div>
          <h3>Stay on-page longer</h3>
          <p>Longer summaries and cleaner headlines help users read before they click away to the source story.</p>
        </div>
        <div className="public-feature-card">
          <div className="public-eyebrow">Leagues</div>
          <h3>Track the table every round</h3>
          <p>The public site sells the league format clearly, while the private workspace keeps the real competition protected.</p>
        </div>
      </section>

      <section className="public-grid-2">
        <div className="public-card">
          <div className="public-card-head">
            <div className="public-eyebrow">Wire snapshot</div>
            <h2>What the weekend is telling you</h2>
          </div>
          <div className="public-card-body public-stack">
            {wireStories.slice(0, 2).map((story) => (
              <div className="public-story-card" key={story.title}>
                <div className="public-story-meta">
                  <span>{story.source}</span>
                  <span>{story.tag}</span>
                </div>
                <h3>{story.title}</h3>
                <p>{story.summary}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="public-card">
          <div className="public-card-head">
            <div className="public-eyebrow">Leaderboard snapshot</div>
            <h2>Who is setting the pace</h2>
          </div>
          <div className="public-table">
            {leaderboardRows.slice(0, 5).map((row) => (
              <div className="public-table-row" key={row.rank}>
                <div className="public-rank">#{row.rank}</div>
                <div className="public-player">
                  <strong>{row.name}</strong>
                  <span>{row.note}</span>
                </div>
                <div className="public-points">{row.points}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
