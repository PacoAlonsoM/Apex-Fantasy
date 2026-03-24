import PublicShell from "../../src/public/PublicShell";
import { PAGE_META, wireStories } from "../../src/public/siteData";

export const metadata = PAGE_META.wire;

export default function WirePage() {
  const [featured, ...rest] = wireStories;

  return (
    <PublicShell active="wire">
      <section className="public-card public-card-body public-story-layout">
        <article className="public-featured-story">
          <div className="public-story-card" style={{ background: "transparent", border: "none", padding: 0 }}>
            <div className="public-story-meta">
              <span>{featured.source}</span>
              <span>{featured.tag}</span>
            </div>
            <h1 style={{ margin: 0, fontSize: 56, lineHeight: 0.96, letterSpacing: "-0.05em" }}>{featured.title}</h1>
            <p style={{ marginTop: 20, fontSize: 18, lineHeight: 1.82 }}>{featured.summary}</p>
            <a href="#" className="public-button is-secondary" style={{ marginTop: 24, width: "fit-content" }}>
              Open full story
            </a>
          </div>
          <div className="public-story-cover" />
        </article>

        <aside className="public-story-list">
          {rest.map((story) => (
            <article className="public-story-card" key={story.title}>
              <div className="public-story-meta">
                <span>{story.source}</span>
                <span>{story.tag}</span>
              </div>
              <h3>{story.title}</h3>
              <p>{story.summary}</p>
            </article>
          ))}
        </aside>
      </section>
    </PublicShell>
  );
}
