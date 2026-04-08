import { FOOTER_LINKS, PAGE_META, getNextRaceSnapshot, getPublicSiteUrl } from "@/src/lib/siteData";

export async function GET() {
  const siteUrl = getPublicSiteUrl();
  const race = getNextRaceSnapshot();
  const text = [
    "# STINT",
    "",
    "STINT is an F1 predictions product with a public site and a separate private app.",
    "",
    `Canonical site: ${siteUrl}`,
    "",
    "Public pages:",
    `- ${siteUrl}/ — ${PAGE_META.home.description}`,
    `- ${siteUrl}/calendar — ${PAGE_META.calendar.description}`,
    `- ${siteUrl}/wire — ${PAGE_META.wire.description}`,
    `- ${siteUrl}/leaderboard — ${PAGE_META.leaderboard.description}`,
    `- ${siteUrl}/picks — ${PAGE_META.picks.description}`,
    `- ${siteUrl}/insight — ${PAGE_META.insight.description}`,
    `- ${siteUrl}/leagues — ${PAGE_META.leagues.description}`,
    "",
    `Current featured next race: ${race.name} (${race.dateLabel})`,
    "",
    "Private app paths are intentionally kept under /app and are not the public source of truth for crawlers.",
    "",
    "Useful footer links:",
    ...FOOTER_LINKS.map((link) => `- ${siteUrl}${link.href}`),
    "",
  ].join("\n");

  return new Response(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
