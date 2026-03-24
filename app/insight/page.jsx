import Link from "next/link";
import PublicShell from "../../src/public/PublicShell";
import { PAGE_META, getInsightBrief } from "../../src/public/siteData";

export const metadata = PAGE_META.insight;

export default function InsightPage() {
  const brief = getInsightBrief();

  return (
    <PublicShell active="insight">
      <section className="public-hero">
        <div className="public-hero-copy">
          <div className="public-kicker">AI Insight</div>
          <h1>{brief.title}</h1>
          <p>{brief.intro}</p>
          <div className="public-actions">
            <Link className="public-button is-primary" href={brief.ctaHref}>
              Open the board
            </Link>
            <Link className="public-button" href="/wire">
              Read the wire
            </Link>
          </div>
        </div>
      </section>

      <section className="public-grid-3">
        {brief.sections.map((section) => (
          <article className="public-brief-card" key={section.title}>
            <div className="public-eyebrow">Brief layer</div>
            <h3>{section.title}</h3>
            <p>{section.body}</p>
          </article>
        ))}
      </section>
    </PublicShell>
  );
}
