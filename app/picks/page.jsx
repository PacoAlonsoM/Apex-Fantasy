import Link from "next/link";
import PublicShell from "../../src/public/PublicShell";
import { PAGE_META, getNextRaceSnapshot, pickCategories, sprintExtras } from "../../src/public/siteData";

export const metadata = PAGE_META.picks;

export default function PicksPage() {
  const race = getNextRaceSnapshot();

  return (
    <PublicShell active="picks">
      <section className="public-hero">
        <div className="public-hero-copy">
          <div className="public-kicker">Picks overview</div>
          <h1>Read the board before you lock the board.</h1>
          <p>
            STINT turns a race weekend into a set of decisions users can actually reason about: front-of-the-order calls,
            volatility categories and timing rules that stay consistent across the season.
          </p>
          <div className="public-actions">
            <Link className="public-button is-primary" href={race.appHref}>
              Open picks for {race.name}
            </Link>
            <Link className="public-button" href="/calendar">
              See the weekend timeline
            </Link>
          </div>
        </div>
        <aside className="public-card public-rail">
          <div className="public-eyebrow">Next board</div>
          <h2>{race.name}</h2>
          <div className="public-muted">
            Lock closes right before qualifying. Players who read the week early usually make cleaner, calmer calls.
          </div>
          <div className="public-pill-row">
            <span className="public-pill">{race.dateWindow}</span>
            <span className="public-pill">{race.timezone}</span>
            {race.sprint ? <span className="public-pill">Sprint weekend</span> : null}
          </div>
        </aside>
      </section>

      <section className="public-card">
        <div className="public-card-head">
          <div className="public-eyebrow">Standard categories</div>
          <h2>The ten calls that shape a regular weekend</h2>
        </div>
        <div className="public-card-body public-category-grid">
          {pickCategories.map((category) => (
            <article className="public-category-card" key={category.name}>
              <div className="public-category-points">{category.points}</div>
              <h3>{category.name}</h3>
              <p>{category.summary}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="public-grid-2">
        <div className="public-card">
          <div className="public-card-head">
            <div className="public-eyebrow">Sprint rule</div>
            <h2>Some weekends carry extra leverage</h2>
          </div>
          <div className="public-card-body public-stack">
            {sprintExtras.map((item) => (
              <div className="public-story-card" key={item.name}>
                <div className="public-category-points">{item.points}</div>
                <h3>{item.name}</h3>
                <p>Sprint weekends add more surface area for sharp players to create separation before Sunday.</p>
              </div>
            ))}
          </div>
        </div>

        <div className="public-card">
          <div className="public-card-head">
            <div className="public-eyebrow">Lock timing</div>
            <h2>Why timing matters as much as the picks</h2>
          </div>
          <div className="public-card-body public-stack">
            <div className="public-brief-card">
              <h3>Read before qualifying</h3>
              <p>Locks close right before the qualifying session for the main race weekend, so users need the right context before the board freezes.</p>
            </div>
            <div className="public-brief-card">
              <h3>Use the full product loop</h3>
              <p>The calendar gives timing, the wire gives narrative, AI Insight gives structure and the board turns all of that into decisions.</p>
            </div>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
