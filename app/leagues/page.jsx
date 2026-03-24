import Link from "next/link";
import PublicShell from "../../src/public/PublicShell";
import { PAGE_META, getLeagueTeaser, leaderboardRows } from "../../src/public/siteData";

export const metadata = PAGE_META.leagues;

export default function LeaguesPage() {
  const teaser = getLeagueTeaser();

  return (
    <PublicShell active="leagues">
      <section className="public-hero">
        <div className="public-hero-copy">
          <div className="public-kicker">Leagues</div>
          <h1>Build the room. Track the table. Own the weekend.</h1>
          <p>{teaser.intro}</p>
          <div className="public-actions">
            <Link className="public-button is-primary" href="/app?page=community">
              Open the leagues workspace
            </Link>
            <Link className="public-button" href="/leaderboard">
              View the public leaderboard
            </Link>
          </div>
        </div>
      </section>

      <section className="public-league-grid">
        <div className="public-card">
          <div className="public-card-head">
            <div className="public-eyebrow">Why leagues matter</div>
            <h2>The product becomes a room, not just a page</h2>
          </div>
          <div className="public-card-body public-stack">
            {teaser.features.map((feature) => (
              <article className="public-league-card" key={feature.title}>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="public-card">
          <div className="public-card-head">
            <div className="public-eyebrow">Public snapshot</div>
            <h2>What league competition feels like</h2>
          </div>
          <div className="public-card-body public-stack">
            {teaser.highlights.map((item) => (
              <div className="public-story-card" key={item}>
                <p>{item}</p>
              </div>
            ))}
            <div className="public-story-card">
              <h3>Players already in the mix</h3>
              <p>{leaderboardRows.slice(0, 4).map((player) => player.name).join(", ")} and more are already setting the pace in the public table.</p>
            </div>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
