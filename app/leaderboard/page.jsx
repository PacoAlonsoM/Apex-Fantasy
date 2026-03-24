import PublicShell from "../../src/public/PublicShell";
import { PAGE_META, leaderboardRows } from "../../src/public/siteData";

export const metadata = PAGE_META.leaderboard;

export default function LeaderboardPage() {
  return (
    <PublicShell active="leaderboard">
      <section className="public-hero">
        <div className="public-hero-copy">
          <div className="public-kicker">Public leaderboard</div>
          <h1>See who is stacking sharp weekends right now.</h1>
          <p>
            The public leaderboard keeps the season readable for new users, returning players and assistants trying to
            understand how STINT works before they ever touch the private app.
          </p>
        </div>
        <aside className="public-card public-rail">
          <div className="public-eyebrow">What points reward</div>
          <h2>Not just one hot take.</h2>
          <div className="public-muted">
            The table reflects a season-long mix of strong front-of-the-order calls, volatility reads and timing discipline.
          </div>
          <div className="public-chip-row">
            <span className="public-chip">Front order</span>
            <span className="public-chip is-blue">Constructor</span>
            <span className="public-chip is-green">Swing categories</span>
          </div>
        </aside>
      </section>

      <section className="public-card">
        <div className="public-card-head">
          <div className="public-eyebrow">Current public table</div>
          <h2>Top players</h2>
        </div>
        <div className="public-table">
          {leaderboardRows.map((row) => (
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
      </section>
    </PublicShell>
  );
}
