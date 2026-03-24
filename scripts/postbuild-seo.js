const fs = require("fs");
const path = require("path");
const vm = require("vm");

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

function loadSeasonCalendar() {
  const calendarPath = path.join(__dirname, "..", "src", "constants", "calendar.js");
  const source = fs.readFileSync(calendarPath, "utf8");
  const match = source.match(/export const CAL = (\[[\s\S]*?\n\]);/);

  if (!match) {
    throw new Error("Unable to load CAL from src/constants/calendar.js");
  }

  const context = { module: { exports: [] } };
  const script = new vm.Script(`module.exports = ${match[1]}`);
  script.runInNewContext(context);
  return context.module.exports;
}

const seasonCalendar = loadSeasonCalendar();

function parseRaceDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
}

function shiftDate(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function formatSessionLabel(date, timeText) {
  const weekday = date.toLocaleDateString("en-US", { weekday: "short" });
  const month = date.toLocaleDateString("en-US", { month: "short" });
  const day = date.getDate();
  return `${weekday}, ${month} ${day} at ${timeText}`;
}

function buildRaceSessions(race) {
  const raceDate = parseRaceDate(race.date);
  const layout = race.sprint
    ? [
        { label: "FP1", offset: -2, timeText: "8:30 PM" },
        { label: "Sprint Qualifying", offset: -2, timeText: "11:30 PM", accent: "var(--accent)" },
        { label: "Sprint", offset: -1, timeText: "9:00 PM" },
        { label: "Qualifying", offset: -1, timeText: "11:30 PM", accent: "var(--accent)" },
        { label: "Race", offset: 0, timeText: "11:00 PM", accent: "#ef4444" },
      ]
    : [
        { label: "FP1", offset: -2, timeText: "8:30 PM" },
        { label: "FP2", offset: -2, timeText: "11:30 PM" },
        { label: "FP3", offset: -1, timeText: "8:30 PM" },
        { label: "Qualifying", offset: -1, timeText: "11:30 PM", accent: "var(--accent)" },
        { label: "Race", offset: 0, timeText: "11:00 PM", accent: "#ef4444" },
      ];

  return layout.map((session) => ({
    label: session.label,
    time: formatSessionLabel(shiftDate(raceDate, session.offset), session.timeText),
    accent: session.accent,
  }));
}

function buildDateWindow(race) {
  const startDate = race.sprint ? shiftDate(parseRaceDate(race.date), -2) : shiftDate(parseRaceDate(race.date), -2);
  const endDate = parseRaceDate(race.date);
  const startMonth = startDate.toLocaleDateString("en-US", { month: "long" });
  const endMonth = endDate.toLocaleDateString("en-US", { month: "long" });
  const startDay = startDate.getDate();
  const endDay = endDate.getDate();

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay}-${endDay}`;
  }

  return `${startMonth} ${startDay}-${endMonth} ${endDay}`;
}

function getNextRaceData() {
  const now = new Date();
  const race = seasonCalendar.find((entry) => parseRaceDate(entry.date) >= now) || seasonCalendar[seasonCalendar.length - 1];
  const raceDate = parseRaceDate(race.date);
  const diff = Math.max(raceDate - now, 0);

  return {
    round: race.r,
    name: race.n,
    circuit: race.circuit,
    location: `${race.city}, ${race.cc}`,
    dateLabel: raceDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
    countdown: {
      days: String(Math.floor(diff / 86400000)).padStart(2, "0"),
      hours: String(Math.floor((diff % 86400000) / 3600000)).padStart(2, "0"),
      minutes: String(Math.floor((diff % 3600000) / 60000)).padStart(2, "0"),
    },
    timezone: "Mexico City",
    sessions: buildRaceSessions(race),
  };
}

const nextRace = getNextRaceData();

const calendarRows = seasonCalendar.map((race) => ({
  round: `R${race.r}`,
  name: race.n,
  location: `${race.city}, ${race.cc}`,
  date: buildDateWindow(race),
  sprint: race.sprint,
  active: race.r === nextRace.round,
}));

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

function renderSeoBrandMark() {
  return `
    <svg class="seo-brand-mark" viewBox="0 0 96 96" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="seoTrackCurbs" x1="18" y1="82" x2="80" y2="10" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#f97316" />
          <stop offset="100%" stop-color="#ef4444" />
        </linearGradient>
      </defs>
      <path d="M20 78C34 69 47 61 47 48C47 34 31 27 44 17C54 10 68 9 83 5" stroke="#f8fafc" stroke-width="11" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M38 86C53 76 68 64 68 48C68 36 58 28 66 20C73 13 83 10 91 7" stroke="#e2e8f0" stroke-width="11" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M18 75C25 70 32 65 39 59" stroke="url(#seoTrackCurbs)" stroke-width="6" stroke-linecap="butt" stroke-linejoin="round" stroke-dasharray="7 7" />
      <path d="M58 70C63 63 67 56 68 47C69 39 67 31 72 23" stroke="url(#seoTrackCurbs)" stroke-width="6" stroke-linecap="butt" stroke-linejoin="round" stroke-dasharray="7 7" />
    </svg>
  `;
}

function renderShell({ nav, heroKicker, heroTitle, heroBody, leftActions = "", rightRail = "", lowerBlock = "" }) {
  return `
    <div class="seo-page">
      <header class="seo-topbar">
        <a class="seo-brand" href="/">
          ${renderSeoBrandMark()}
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
      <footer class="seo-footer">
        <div class="seo-footer-inner">
          <div class="seo-footer-top">
            <div class="seo-footer-brand">
              <strong>${brand.name}</strong> · ${brand.descriptor}
            </div>
            <div class="seo-footer-links">
              <a href="/">Home</a>
              <a href="/calendar">Calendar</a>
              <a href="/picks">Picks</a>
              <a href="/wire">Wire</a>
              <a href="/leaderboard">Leaderboard</a>
            </div>
          </div>
          <div class="seo-footer-copy">Stint is an independent F1 fantasy product. Contact: ${brand.supportEmail}</div>
        </div>
      </footer>
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
    heroKicker: "Stint F1 Predictions",
    heroTitle: "Compete hard.<br>Predict sharp.<br>Win your league.",
    heroBody:
      "Use race-week schedules, clean news reads, and fantasy context in one place so you can make sharper decisions before lock.",
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
      "Open any Grand Prix to understand session order, timing in your local view, and the track context that matters before you move into Picks.",
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
      <p>Read how the board works, what locks first, and where sprint weekends add pressure before you open the full picks flow.</p>
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
    heroKicker: "How picks work",
    heroTitle: "Understand the board<br>before lock.",
    heroBody:
      "See the scoring categories, lock timing, and sprint rules first so the full board makes sense the moment you open it.",
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
    heroKicker: "Race-week coverage",
    heroTitle: "Read the stories that can<br>actually change your picks.",
    heroBody:
      "Use the wire to stay on top of race-week context, key headlines, and the stories that actually affect fantasy decisions.",
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
        <div class="seo-section-label">How the table moves</div>
        <h3>Standings reward consistency, not just one perfect round.</h3>
        <p>Big points still come from pole, winner, and podium calls, but the table usually swings when players stay accurate across the deeper categories over several weekends.</p>
        <p>The public standings give new users enough context to understand the competition before they step into the full app and league flow.</p>
      </article>
    </section>
  `;

  return renderShell({
    nav: "leaderboard",
    heroKicker: "Fantasy standings",
    heroTitle: "Track the table.<br>Understand the race.",
    heroBody:
      "See who is reading the season best, where the points are coming from, and how the fantasy table is taking shape.",
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
      .seo-brand-mark { width:42px; height:42px; display:block; flex:none; }
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
      .seo-footer { border-top:1px solid var(--line); margin-top:28px; background:linear-gradient(180deg, rgba(7,11,18,0.35), rgba(9,9,11,0.72)); }
      .seo-footer-inner { max-width:1280px; margin:0 auto; padding:18px 28px 20px; display:grid; gap:10px; }
      .seo-footer-top { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:12px; }
      .seo-footer-brand { font-size:12px; color:rgba(226,232,240,0.82); }
      .seo-footer-brand strong { color:#fafafa; font-weight:800; }
      .seo-footer-links { display:flex; gap:14px; flex-wrap:wrap; }
      .seo-footer-links a { color:#e2e8f0; text-decoration:none; font-size:11px; font-weight:700; }
      .seo-footer-copy { font-size:11px; color:rgba(148,163,184,0.8); line-height:1.6; }
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
    "<noscript>Interactive features load when JavaScript is available.</noscript>"
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
