const fs = require("fs");
const path = require("path");

const buildDir = path.join(__dirname, "..", "build");
const robotsPath = path.join(buildDir, "robots.txt");
const sitemapPath = path.join(buildDir, "sitemap.xml");
const llmsPath = path.join(buildDir, "llms.txt");
const baseHtmlPath = path.join(buildDir, "index.html");

const brand = {
  name: "Stint",
  wordmark: "STINT",
  descriptor: "F1 Predictions",
  supportEmail: "support@stint-web.com",
};

const publicRoutes = [
  { path: "/", output: "index.html", nav: "home", title: "Compete hard. Predict sharp. Win your league.", description: "Public homepage for Stint F1 Predictions.", render: renderHomePage },
  { path: "/calendar", output: "calendar/index.html", nav: "calendar", title: "2026 F1 Calendar", description: "Public F1 calendar with sessions and race-week timeline context.", render: renderCalendarPage },
  { path: "/picks", output: "picks/index.html", nav: "picks", title: "How Stint Picks Work", description: "Public teaser page for Stint Picks: categories, lock timing, sprint rules, and the next race context.", render: renderPicksPage },
  { path: "/wire", output: "wire/index.html", nav: "wire", title: "F1 Wire", description: "Public F1 news and race-week coverage feed.", render: renderWirePage },
  { path: "/leaderboard", output: "leaderboard/index.html", nav: "leaderboard", title: "F1 Leaderboard", description: "Public driver and fantasy leaderboard view.", render: renderLeaderboardPage },
];

const nextRace = {
  round: 3,
  name: "Japanese GP",
  circuit: "Suzuka International Course",
  location: "Suzuka, Japan",
  dateLabel: "29 March 2026",
  countdown: { days: "07", hours: "20", minutes: "58" },
  timezone: "America/Mexico_City",
  sessions: [
    { label: "FP1", time: "Fri, Mar 27, 12:00 PM" },
    { label: "FP2", time: "Fri, Mar 27, 12:00 PM" },
    { label: "FP3", time: "Sat, Mar 28, 12:00 PM" },
    { label: "Qualifying", time: "Sat, Mar 28, 12:00 PM", accent: "var(--accent)" },
    { label: "Race", time: "Sun, Mar 29, 12:00 PM", accent: "#ef4444" },
  ],
};

const calendarRows = [
  { round: "R1", name: "Australian GP", location: "Melbourne, Australia", date: "March 6-8" },
  { round: "R2", name: "Chinese GP", location: "Shanghai, China", date: "March 13-15", sprint: true },
  { round: "R3", name: "Japanese GP", location: "Suzuka, Japan", date: "March 26-28", active: true },
  { round: "R4", name: "Bahrain GP", location: "Sakhir, Bahrain", date: "April 10-12" },
  { round: "R5", name: "Saudi Arabian GP", location: "Jeddah, Saudi Arabia", date: "April 17-19" },
  { round: "R6", name: "Miami GP", location: "Miami, USA", date: "May 1-3", sprint: true },
  { round: "R7", name: "Canadian GP", location: "Montreal, Canada", date: "May 22-24", sprint: true },
  { round: "R8", name: "Monaco GP", location: "Monte Carlo, Monaco", date: "June 5-7" },
];

const wireStories = [
  {
    source: "Race Week",
    title: "Why Suzuka matters more than raw pace this week",
    summary:
      "Suzuka compresses mistakes. Sector-one commitment, tyre load through the esses, and qualifying rhythm all matter more here than one flattering headline lap in practice. This is the kind of weekend where clean reads beat hot takes.",
  },
  {
    source: "Fantasy Angle",
    title: "The picks that look safe and the ones that can swing a league",
    summary:
      "Race winner and pole still carry the biggest fantasy leverage, but Suzuka usually rewards drivers who stay tidy over a full sequence of corners. The public page keeps the strategic context on-site so users can read before they lock picks.",
  },
  {
    source: "Team Watch",
    title: "Mercedes, Ferrari, McLaren: who actually arrives in control?",
    summary:
      "The meaningful question is not who posts the flashiest session time, but who arrives with repeatable balance. Teams that can rotate cleanly and protect tyres through long loaded corners tend to look much stronger by qualifying and Sunday.",
  },
];

const topPlayers = [
  { rank: 1, name: "LucasDirtyAir", points: 173, note: "Current public league leader" },
  { rank: 2, name: "AlmaTyreDelta", points: 162, note: "Strong read on volatility picks" },
  { rank: 3, name: "NinaBoxBox", points: 152, note: "Consistent podium-level scoring" },
  { rank: 4, name: "MiaChicane", points: 138, note: "Aggressive but high-hit fantasy profile" },
  { rank: 5, name: "SofiaUndercut", points: 131, note: "Reliable category-level scorer" },
];

const pickCategories = [
  ["Pole Position", "10 pts", "Who is quickest over one lap."],
  ["Race Winner", "25 pts", "Pick the Sunday winner."],
  ["2nd Place", "18 pts", "Who crosses the line in second."],
  ["3rd Place", "15 pts", "Who completes the podium."],
  ["DNF Driver", "12 pts", "Driver most likely not to finish."],
  ["Fastest Lap", "7 pts", "Late-race pace or outright control."],
  ["Driver of the Day", "6 pts", "Fan-voted race standout."],
  ["Best Constructor", "8 pts", "Team likely to own the weekend."],
  ["Safety Car?", "5 pts", "Will the race be neutralised?"],
  ["Red Flag?", "8 pts", "Will the session be stopped?"],
];

const sprintExtras = [
  ["Sprint Pole", "5 pts"],
  ["Sprint Winner", "12 pts"],
  ["Sprint 2nd", "9 pts"],
  ["Sprint 3rd", "7 pts"],
];

function normalizeUrl(rawUrl) {
  if (!rawUrl) return "";
  const value = rawUrl.trim();
  if (!value) return "";
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return withProtocol.replace(/\/+$/, "");
}

function getPublicSiteUrl() {
  return normalizeUrl(
    process.env.REACT_APP_PUBLIC_SITE_URL ||
      process.env.PUBLIC_SITE_URL ||
      process.env.VERCEL_PROJECT_PRODUCTION_URL ||
      process.env.VERCEL_URL ||
      "https://www.stint-web.com"
  );
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function navLink(label, href, active) {
  return `<a class="seo-nav-link${active ? " is-active" : ""}" href="${href}">${label}</a>`;
}

function renderShell({ nav, heroKicker, heroTitle, heroBody, leftActions = "", rightRail = "", lowerBlock = "" }) {
  return `
    <div class="seo-page">
      <header class="seo-topbar">
        <a class="seo-brand" href="/">
          <span class="seo-brand-mark">S</span>
          <span>
            <strong>${brand.wordmark}</strong>
            <small>${brand.descriptor}</small>
          </span>
        </a>
        <nav class="seo-nav">
          ${navLink("Home", "/", nav === "home")}
          ${navLink("Calendar", "/calendar", nav === "calendar")}
          ${navLink("Picks", "/picks", nav === "picks")}
          ${navLink("Wire", "/wire", nav === "wire")}
          ${navLink("Leaderboard", "/leaderboard", nav === "leaderboard")}
        </nav>
      </header>
      <main class="seo-main">
        <section class="seo-hero">
          <div class="seo-hero-copy">
            <div class="seo-kicker">${heroKicker}</div>
            <h1>${heroTitle}</h1>
            <p>${heroBody}</p>
            ${leftActions}
          </div>
          ${rightRail}
        </section>
        ${lowerBlock}
      </main>
    </div>
  `;
}

function renderHomePage() {
  const leftActions = `
    <div class="seo-actions">
      <a class="seo-button is-primary" href="/picks">Make picks</a>
      <a class="seo-button" href="/calendar">View calendar</a>
    </div>
  `;

  const rightRail = `
    <aside class="seo-card seo-next-race">
      <div class="seo-eyebrow">Next race</div>
      <h2>${nextRace.name}</h2>
      <div class="seo-muted">${nextRace.circuit} · ${nextRace.dateLabel}</div>
      <div class="seo-countdown">
        <div><strong>${nextRace.countdown.days}</strong><span>Days</span></div>
        <div><strong>${nextRace.countdown.hours}</strong><span>Hours</span></div>
        <div><strong>${nextRace.countdown.minutes}</strong><span>Minutes</span></div>
      </div>
      <div class="seo-section-label">Weekend timeline</div>
      <div class="seo-timeline">
        ${nextRace.sessions
          .map(
            (session) => `
              <div class="seo-timeline-row">
                <span class="seo-dot" style="${session.accent ? `background:${session.accent};border-color:${session.accent};` : ""}"></span>
                <div>
                  <strong>${session.label}</strong>
                  <div class="seo-muted">${session.time}</div>
                </div>
              </div>
            `
          )
          .join("")}
      </div>
      <a class="seo-button is-primary seo-full" href="/picks">Make picks for this race</a>
    </aside>
  `;

  const lowerBlock = `
    <section class="seo-grid seo-grid-3">
      <article class="seo-card">
        <div class="seo-section-label">Calendar</div>
        <h3>Session order, timing, and race-week context in one place.</h3>
        <p>Public users can read the upcoming weekend without logging in first, then jump straight into Picks when they are ready.</p>
      </article>
      <article class="seo-card">
        <div class="seo-section-label">Wire</div>
        <h3>News summaries that stay on the page longer.</h3>
        <p>Wire is designed to keep more race-week reading inside the product instead of sending users out immediately.</p>
      </article>
      <article class="seo-card">
        <div class="seo-section-label">Leaderboard</div>
        <h3>Public standings plus league competition.</h3>
        <p>The public side explains the scoring context, while private league spaces keep the more interactive fantasy workflow.</p>
      </article>
    </section>
  `;

  return renderShell({
    nav: "home",
    heroKicker: "Public homepage",
    heroTitle: "Compete hard.<br>Predict sharp.<br>Win your league.",
    heroBody:
      "Stint brings race-week schedules, F1 news, leaderboard context, and sharper fantasy decisions into one public product that assistants, crawlers, and readers can actually understand.",
    leftActions,
    rightRail,
    lowerBlock,
  });
}

function renderCalendarPage() {
  const timezoneCard = `
    <aside class="seo-card seo-timezone-card">
      <div class="seo-section-label">Timezone</div>
      <h2>Mexico City</h2>
      <p>All public session times are presented in one clean timezone context so users know exactly when lock and race-week sessions hit.</p>
    </aside>
  `;

  const lowerBlock = `
    <section class="seo-grid seo-grid-calendar">
      <div class="seo-card seo-race-list">
        <div class="seo-section-label">Upcoming rounds</div>
        ${calendarRows
          .map(
            (race) => `
              <a class="seo-race-row${race.active ? " is-active" : ""}" href="/calendar">
                <strong>${race.round}</strong>
                <div>
                  <h4>${race.name}</h4>
                  <div class="seo-muted">${race.location}</div>
                </div>
                <div class="seo-race-meta">
                  ${race.sprint ? '<span class="seo-chip">Sprint weekend</span>' : ""}
                  <span>${race.date}</span>
                </div>
              </a>
            `
          )
          .join("")}
      </div>
      <aside class="seo-card seo-weekend-panel">
        <div class="seo-section-label">Selected weekend</div>
        <h2>${nextRace.name}</h2>
        <div class="seo-muted">${nextRace.location}</div>
        <div class="seo-chip-row">
          <span class="seo-chip">${nextRace.dateLabel}</span>
          <span class="seo-chip">Timezone: ${nextRace.timezone}</span>
        </div>
        <div class="seo-section-label">Weekend timeline</div>
        <div class="seo-timeline">
          ${nextRace.sessions
            .map(
              (session) => `
                <div class="seo-timeline-row">
                  <span class="seo-dot" style="${session.accent ? `background:${session.accent};border-color:${session.accent};` : ""}"></span>
                  <div>
                    <strong>${session.label}</strong>
                    <div class="seo-muted">${session.time}</div>
                  </div>
                </div>
              `
            )
            .join("")}
        </div>
      </aside>
    </section>
  `;

  return renderShell({
    nav: "calendar",
    heroKicker: "2026 Calendar",
    heroTitle: "Read the season as one<br>race-week system.",
    heroBody:
      "Open any Grand Prix to understand session order, timezone-adjusted timing, and the track context users need before they move into Picks.",
    rightRail: timezoneCard,
    lowerBlock,
  });
}

function renderPicksPage() {
  const rightRail = `
    <aside class="seo-card seo-next-race">
      <div class="seo-eyebrow">Next lock</div>
      <h2>${nextRace.name}</h2>
      <div class="seo-muted">${nextRace.circuit} · ${nextRace.dateLabel}</div>
      <div class="seo-countdown">
        <div><strong>${nextRace.countdown.days}</strong><span>Days</span></div>
        <div><strong>${nextRace.countdown.hours}</strong><span>Hours</span></div>
        <div><strong>${nextRace.countdown.minutes}</strong><span>Minutes</span></div>
      </div>
      <p>Picks stay readable here for assistants and crawlers, but the personalised board remains inside the app. The real board locks right before qualifying begins.</p>
      <div class="seo-section-label" style="margin-top:18px;">Weekend timeline</div>
      <div class="seo-timeline">
        ${nextRace.sessions
          .map(
            (session) => `
              <div class="seo-timeline-row">
                <span class="seo-dot" style="${session.accent ? `background:${session.accent};border-color:${session.accent};` : ""}"></span>
                <div>
                  <strong>${session.label}</strong>
                  <div class="seo-muted">${session.time}</div>
                </div>
              </div>
            `
          )
          .join("")}
      </div>
      <a class="seo-button is-primary seo-full" href="/?page=predictions&race=${nextRace.round}">Open the app to make picks</a>
    </aside>
  `;

  const lowerBlock = `
    <section class="seo-grid seo-grid-2">
      <article class="seo-card">
        <div class="seo-section-label">Core race board</div>
        <div class="seo-picks-grid">
          ${pickCategories
            .map(
              ([label, pts, summary]) => `
                <div class="seo-pick-card">
                  <div class="seo-pick-top">
                    <strong>${label}</strong>
                    <span>${pts}</span>
                  </div>
                  <p>${summary}</p>
                </div>
              `
            )
            .join("")}
        </div>
      </article>
      <article class="seo-card">
        <div class="seo-section-label">Sprint weekends</div>
        <h3>Some rounds add a second scoring layer.</h3>
        <p>On sprint weekends, the live board grows with four extra calls. The public teaser explains the format, while the real board only unlocks the extra sprint picks when that weekend actually needs them.</p>
        <div class="seo-stack" style="margin-top:18px;">
          ${sprintExtras
            .map(
              ([label, pts]) => `
                <div class="seo-inline-row">
                  <strong>${label}</strong>
                  <span>${pts}</span>
                </div>
              `
            )
            .join("")}
        </div>
        <div class="seo-section-label" style="margin-top:26px;">Lock rules</div>
        <p>Users can read how the board works publicly, but personal picks, scoring review, and admin actions stay behind the real app and auth. Once qualifying starts, picks are locked. After results are scored, the board switches into review mode.</p>
      </article>
    </section>
  `;

  return renderShell({
    nav: "picks",
    heroKicker: "Public picks guide",
    heroTitle: "Understand the board<br>before lock.",
    heroBody:
      "This is the readable public layer for Picks. It explains categories, timing, sprint rules, and lock behavior without exposing private picks, admin actions, or personalised state.",
    leftActions: `
      <div class="seo-actions">
        <a class="seo-button is-primary" href="/">Open the app</a>
        <a class="seo-button" href="/calendar">Read calendar first</a>
      </div>
    `,
    rightRail,
    lowerBlock,
  });
}

function renderWirePage() {
  const lowerBlock = `
    <section class="seo-grid seo-grid-wire">
      <article class="seo-card seo-wire-lead">
        <div class="seo-section-label">Lead story</div>
        <h3>Suzuka is the kind of weekend where clean reads beat hot takes.</h3>
        <p>Fast fantasy decisions usually come from structure, not panic. The public wire is meant to keep more of that context on the page: what matters for lock, which teams actually look balanced, and where session noise can mislead users.</p>
        <p>The point is not to replace the original reporting. The point is to give users enough race-week context inside Stint that they do not need to leave the product immediately just to understand the shape of the weekend.</p>
      </article>
      <div class="seo-wire-stack">
        ${wireStories
          .map(
            (story) => `
              <article class="seo-card">
                <div class="seo-section-label">${story.source}</div>
                <h4>${story.title}</h4>
                <p>${story.summary}</p>
              </article>
            `
          )
          .join("")}
      </div>
    </section>
  `;

  return renderShell({
    nav: "wire",
    heroKicker: "Public wire",
    heroTitle: "Read the stories that can<br>actually change your picks.",
    heroBody:
      "Wire is the public race-week reading layer inside Stint. It is built to keep more useful F1 context on the page before users leave for a full article or move into the app.",
    lowerBlock,
  });
}

function renderLeaderboardPage() {
  const lowerBlock = `
    <section class="seo-grid seo-grid-2">
      <article class="seo-card">
        <div class="seo-section-label">Top players</div>
        <div class="seo-list">
          ${topPlayers
            .map(
              (row) => `
                <div class="seo-list-row">
                  <strong>${row.rank}</strong>
                  <div>
                    <h4>${row.name}</h4>
                    <div class="seo-muted">${row.note}</div>
                  </div>
                  <span>${row.points}</span>
                </div>
              `
            )
            .join("")}
        </div>
      </article>
      <article class="seo-card">
        <div class="seo-section-label">What this page is for</div>
        <h3>Public standings, private competition.</h3>
        <p>The public leaderboard gives search engines, assistants, and new users a readable explanation of the standings layer. Logged-in users still get the interactive league spaces, round reviews, and detailed fantasy flow inside the app.</p>
        <p>This separation is deliberate: the public side stays crawlable, while the private side keeps richer interactivity and account state.</p>
      </article>
    </section>
  `;

  return renderShell({
    nav: "leaderboard",
    heroKicker: "Public leaderboard",
    heroTitle: "Track the table.<br>Understand the race.",
    heroBody:
      "The public leaderboard is the readable surface for standings, scoring context, and fantasy competition. It explains what Stint is without forcing crawlers or assistants through a JavaScript shell first.",
    lowerBlock,
  });
}

function staticStyles() {
  return `
    <style id="seo-static">
      :root {
        --bg:#0b1120;
        --panel:#111b2e;
        --panel-alt:#162239;
        --text:#f1f5f9;
        --muted:rgba(241,245,249,0.66);
        --subtle:rgba(241,245,249,0.34);
        --line:rgba(255,255,255,0.08);
        --accent:#f97316;
      }
      body { margin:0; background: radial-gradient(circle at 12% 5%, rgba(249,115,22,.08), transparent 18%), linear-gradient(#0b1120 0, #0b1120 40%, #111b2e 100%); color:var(--text); font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      .seo-page { min-height:100vh; }
      .seo-topbar { max-width:1280px; margin:0 auto; padding:24px 28px 10px; display:flex; align-items:center; justify-content:space-between; gap:20px; }
      .seo-brand { display:flex; align-items:center; gap:14px; text-decoration:none; color:var(--text); }
      .seo-brand-mark { width:42px; height:42px; border-radius:10px; display:grid; place-items:center; background:linear-gradient(135deg,#f97316,#ea580c); font-weight:900; font-size:22px; }
      .seo-brand strong { display:block; font-size:28px; letter-spacing:-0.04em; line-height:0.95; }
      .seo-brand small { display:block; color:var(--subtle); text-transform:uppercase; letter-spacing:0.12em; font-size:12px; margin-top:3px; }
      .seo-nav { display:flex; align-items:center; gap:6px; padding:6px; border-radius:999px; background:#111b2e; }
      .seo-nav-link { color:var(--muted); text-decoration:none; padding:14px 18px; border-radius:999px; font-weight:600; font-size:14px; }
      .seo-nav-link.is-active { color:var(--text); position:relative; }
      .seo-nav-link.is-active::after { content:""; position:absolute; left:18px; right:18px; bottom:8px; height:2px; border-radius:999px; background:var(--accent); }
      .seo-main { max-width:1280px; margin:0 auto; padding:28px; display:grid; gap:26px; }
      .seo-hero { display:grid; grid-template-columns:minmax(0, 1.2fr) minmax(320px, 420px); gap:26px; align-items:start; }
      .seo-hero-copy { padding:26px 8px 0 8px; }
      .seo-kicker, .seo-section-label, .seo-eyebrow { font-size:12px; font-weight:800; letter-spacing:0.11em; text-transform:uppercase; color:var(--subtle); }
      .seo-hero-copy h1 { margin:10px 0 18px; font-size:72px; line-height:0.95; letter-spacing:-0.06em; }
      .seo-hero-copy p, .seo-card p { color:var(--muted); font-size:18px; line-height:1.7; margin:0; }
      .seo-actions { display:flex; gap:14px; flex-wrap:wrap; margin-top:24px; }
      .seo-button { display:inline-flex; align-items:center; justify-content:center; min-height:50px; padding:0 22px; border-radius:14px; text-decoration:none; color:var(--text); border:1px solid rgba(255,255,255,0.12); font-weight:700; }
      .seo-button.is-primary { background:linear-gradient(135deg,#f97316,#ea580c); border-color:transparent; }
      .seo-button.seo-full { width:100%; margin-top:18px; }
      .seo-card { background:var(--panel); border:1px solid var(--line); border-radius:22px; padding:24px; box-shadow:0 18px 40px rgba(2,6,23,0.22); }
      .seo-card h2, .seo-card h3, .seo-card h4 { margin:10px 0 8px; line-height:1.06; letter-spacing:-0.04em; }
      .seo-card h2 { font-size:48px; }
      .seo-card h3 { font-size:32px; }
      .seo-card h4 { font-size:24px; }
      .seo-muted { color:var(--muted); }
      .seo-next-race, .seo-weekend-panel { border-top:3px solid var(--accent); }
      .seo-countdown { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:10px; margin:18px 0; }
      .seo-countdown div { background:#0b1120; border-radius:14px; padding:14px 10px; text-align:center; }
      .seo-countdown strong { display:block; font-size:34px; letter-spacing:-0.05em; }
      .seo-countdown span { display:block; margin-top:6px; font-size:11px; color:var(--subtle); text-transform:uppercase; letter-spacing:0.1em; }
      .seo-timeline { display:grid; gap:14px; margin-top:12px; }
      .seo-timeline-row { display:grid; grid-template-columns:14px 1fr; gap:12px; align-items:start; }
      .seo-dot { width:8px; height:8px; border-radius:50%; margin-top:8px; background:#1a2740; border:1.5px solid rgba(255,255,255,0.18); }
      .seo-chip-row { display:flex; gap:10px; flex-wrap:wrap; margin:14px 0 18px; }
      .seo-chip { display:inline-flex; align-items:center; gap:6px; min-height:30px; padding:0 12px; border-radius:999px; background:rgba(59,130,246,0.12); color:#93c5fd; font-size:12px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; }
      .seo-grid { display:grid; gap:22px; }
      .seo-grid-2 { grid-template-columns:repeat(2, minmax(0,1fr)); }
      .seo-grid-3 { grid-template-columns:repeat(3, minmax(0,1fr)); }
      .seo-grid-calendar { grid-template-columns:minmax(0, 1.4fr) minmax(320px, 420px); align-items:start; }
      .seo-grid-wire { grid-template-columns:minmax(0, 1.1fr) minmax(320px, 0.9fr); align-items:start; }
      .seo-wire-stack { display:grid; gap:18px; }
      .seo-stack { display:grid; gap:12px; }
      .seo-picks-grid { display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:12px; margin-top:14px; }
      .seo-pick-card { border-radius:16px; background:var(--panel-alt); border:1px solid var(--line); padding:16px; }
      .seo-pick-card p { margin-top:8px; font-size:14px; line-height:1.6; }
      .seo-pick-top { display:flex; align-items:center; justify-content:space-between; gap:12px; }
      .seo-pick-top strong { font-size:18px; line-height:1.2; }
      .seo-pick-top span, .seo-inline-row span { font-size:12px; font-weight:800; letter-spacing:0.08em; text-transform:uppercase; color:var(--accent); }
      .seo-inline-row { display:flex; align-items:center; justify-content:space-between; gap:12px; border-radius:14px; padding:12px 14px; background:var(--panel-alt); border:1px solid var(--line); }
      .seo-race-list { display:grid; gap:12px; }
      .seo-race-row { display:grid; grid-template-columns:60px minmax(0,1fr) auto; gap:16px; align-items:center; padding:18px 20px; border-radius:18px; text-decoration:none; color:var(--text); background:rgba(255,255,255,0.01); border:1px solid var(--line); }
      .seo-race-row.is-active { box-shadow:inset 0 0 0 1px rgba(249,115,22,0.28); }
      .seo-race-row strong { font-size:36px; letter-spacing:-0.05em; color:rgba(241,245,249,0.45); }
      .seo-race-row h4 { margin:0 0 4px; font-size:28px; }
      .seo-race-meta { display:grid; justify-items:end; gap:8px; color:var(--muted); font-size:14px; }
      .seo-list { display:grid; gap:10px; }
      .seo-list-row { display:grid; grid-template-columns:44px minmax(0,1fr) auto; gap:14px; align-items:center; padding:14px 0; border-bottom:1px solid var(--line); }
      .seo-list-row:last-child { border-bottom:none; }
      .seo-list-row strong:first-child { font-size:28px; color:rgba(241,245,249,0.55); }
      .seo-list-row span { font-size:28px; font-weight:900; letter-spacing:-0.04em; }
      .seo-timezone-card { max-width:420px; margin-left:auto; }
      @media (max-width: 980px) {
        .seo-topbar, .seo-main { padding-left:18px; padding-right:18px; }
        .seo-topbar { flex-direction:column; align-items:flex-start; }
        .seo-hero, .seo-grid-2, .seo-grid-3, .seo-grid-calendar, .seo-grid-wire { grid-template-columns:1fr; }
        .seo-picks-grid { grid-template-columns:1fr; }
        .seo-hero-copy h1 { font-size:54px; }
      }
    </style>
  `;
}

function updateTag(html, match, replacement, fallback) {
  if (match.test(html)) {
    return html.replace(match, replacement);
  }
  return html.replace("</head>", `${fallback}</head>`);
}

function injectHtml({ template, title, description, path: routePath, bodyHtml, siteUrl }) {
  let html = template;
  const fullTitle = `${title} | ${brand.name}`;

  html = html.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(fullTitle)}</title>`);
  html = updateTag(
    html,
    /<meta[^>]+name="description"[^>]*>/i,
    `<meta name="description" content="${escapeHtml(description)}">`,
    `<meta name="description" content="${escapeHtml(description)}">`
  );
  html = updateTag(
    html,
    /<meta[^>]+property="og:title"[^>]*>/i,
    `<meta property="og:title" content="${escapeHtml(fullTitle)}">`,
    `<meta property="og:title" content="${escapeHtml(fullTitle)}">`
  );
  html = updateTag(
    html,
    /<meta[^>]+property="og:description"[^>]*>/i,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`
  );
  html = updateTag(
    html,
    /<meta[^>]+name="twitter:title"[^>]*>/i,
    `<meta name="twitter:title" content="${escapeHtml(fullTitle)}">`,
    `<meta name="twitter:title" content="${escapeHtml(fullTitle)}">`
  );
  html = updateTag(
    html,
    /<meta[^>]+name="twitter:description"[^>]*>/i,
    `<meta name="twitter:description" content="${escapeHtml(description)}">`,
    `<meta name="twitter:description" content="${escapeHtml(description)}">`
  );

  if (siteUrl) {
    const pageUrl = `${siteUrl}${routePath}`;
    html = updateTag(
      html,
      /<meta[^>]+property="og:url"[^>]*>/i,
      `<meta property="og:url" content="${pageUrl}">`,
      `<meta property="og:url" content="${pageUrl}">`
    );
    html = updateTag(
      html,
      /<link[^>]+rel="canonical"[^>]*>/i,
      `<link rel="canonical" href="${pageUrl}">`,
      `<link rel="canonical" href="${pageUrl}">`
    );
  }

  html = html.replace("</head>", `${staticStyles()}</head>`);
  html = html.replace(/<div id="root"><\/div>/i, `<div id="root" data-seo-static="1">${bodyHtml}</div>`);
  html = html.replace(
    /<noscript>.*?<\/noscript>/i,
    "<noscript>This page includes a readable public fallback. Interactive features load when JavaScript is available.</noscript>"
  );

  return html;
}

function writeFileIfNeeded(relativePath, content) {
  const targetPath = path.join(buildDir, relativePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, content, "utf8");
}

function writeSitemap(siteUrl) {
  if (!siteUrl) return;

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...publicRoutes.map((route) => `  <url><loc>${siteUrl}${route.path}</loc></url>`),
    "</urlset>",
    "",
  ].join("\n");

  fs.writeFileSync(sitemapPath, xml, "utf8");
}

function writeRobots(siteUrl) {
  const lines = ["User-agent: *", "Allow: /"];
  if (siteUrl) {
    lines.push(`Sitemap: ${siteUrl}/sitemap.xml`);
  }
  fs.writeFileSync(robotsPath, `${lines.join("\n")}\n`, "utf8");
}

function writeLlms(siteUrl) {
  const lines = [
    "# Stint F1 Predictions",
    "",
    "Public pages that AI assistants and crawlers can read directly:",
    "",
    ...publicRoutes.map((route) => {
      const href = siteUrl ? `${siteUrl}${route.path}` : route.path;
      return `- ${route.title}: ${href} — ${route.description}`;
    }),
    "",
    "The public /picks page is a teaser that explains how the board works. Personal picks, profile, and admin remain private and may depend on authentication.",
    "",
  ];
  fs.writeFileSync(llmsPath, lines.join("\n"), "utf8");
}

function main() {
  if (!fs.existsSync(baseHtmlPath)) {
    throw new Error("build/index.html not found");
  }

  const siteUrl = getPublicSiteUrl();
  const template = fs.readFileSync(baseHtmlPath, "utf8");

  publicRoutes.forEach((route) => {
    const html = injectHtml({
      template,
      title: route.title,
      description: route.description,
      path: route.path,
      bodyHtml: route.render(),
      siteUrl,
    });
    writeFileIfNeeded(route.output, html);
  });

  writeRobots(siteUrl);
  writeLlms(siteUrl);
  writeSitemap(siteUrl);
}

main();
