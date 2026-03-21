const fs = require("fs");
const path = require("path");

const buildDir = path.join(__dirname, "..", "build");
const robotsPath = path.join(buildDir, "robots.txt");
const sitemapPath = path.join(buildDir, "sitemap.xml");
const llmsPath = path.join(buildDir, "llms.txt");

const routes = [
  {
    path: "/",
    output: "index.html",
    title: "Home",
    description: "Public homepage for Stint F1 Predictions.",
  },
  {
    path: "/calendar",
    output: "calendar/index.html",
    title: "Calendar",
    description: "Public F1 calendar with sessions and race-week timeline context.",
  },
  {
    path: "/wire",
    output: "wire/index.html",
    title: "Wire",
    description: "Public F1 news and race-week coverage feed.",
  },
  {
    path: "/leaderboard",
    output: "leaderboard/index.html",
    title: "Leaderboard",
    description: "Public driver and fantasy leaderboard view.",
  },
];

function normalizeUrl(rawUrl) {
  if (!rawUrl) {
    return "";
  }

  const value = rawUrl.trim();
  if (!value) {
    return "";
  }

  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return withProtocol.replace(/\/+$/, "");
}

function getPublicSiteUrl() {
  return normalizeUrl(
    process.env.REACT_APP_PUBLIC_SITE_URL ||
      process.env.PUBLIC_SITE_URL ||
      process.env.VERCEL_PROJECT_PRODUCTION_URL ||
      process.env.VERCEL_URL
  );
}

function writeSitemap(siteUrl) {
  if (!siteUrl) {
    return;
  }

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...routes.map(
      ({ path: routePath }) =>
        `  <url><loc>${siteUrl}${routePath}</loc></url>`
    ),
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
    ...routes.map(({ path: routePath, title, description }) => {
      const href = siteUrl ? `${siteUrl}${routePath}` : routePath;
      return `- ${title}: ${href} — ${description}`;
    }),
    "",
    "Private app areas such as picks, profile, and admin require the interactive app shell and may depend on authentication.",
    "",
  ];

  fs.writeFileSync(llmsPath, lines.join("\n"), "utf8");
}

function upsertHeadTag(html, { match, replacement, fallback }) {
  if (match.test(html)) {
    return html.replace(match, replacement);
  }

  return html.replace("</head>", `${fallback}</head>`);
}

function writeCanonicalTags(siteUrl) {
  if (!siteUrl) {
    return;
  }

  routes.forEach(({ path: routePath, output }) => {
    const filePath = path.join(buildDir, output);
    if (!fs.existsSync(filePath)) {
      return;
    }

    const pageUrl = `${siteUrl}${routePath}`;
    let html = fs.readFileSync(filePath, "utf8");

    html = upsertHeadTag(html, {
      match: /<meta[^>]+property="og:url"[^>]*>/i,
      replacement: `<meta property="og:url" content="${pageUrl}">`,
      fallback: `<meta property="og:url" content="${pageUrl}">`,
    });

    html = upsertHeadTag(html, {
      match: /<link[^>]+rel="canonical"[^>]*>/i,
      replacement: `<link rel="canonical" href="${pageUrl}">`,
      fallback: `<link rel="canonical" href="${pageUrl}">`,
    });

    fs.writeFileSync(filePath, html, "utf8");
  });
}

function main() {
  if (!fs.existsSync(buildDir)) {
    throw new Error("build directory not found");
  }

  const siteUrl = getPublicSiteUrl();
  writeSitemap(siteUrl);
  writeRobots(siteUrl);
  writeLlms(siteUrl);
  writeCanonicalTags(siteUrl);
}

main();
