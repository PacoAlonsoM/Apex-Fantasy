import { getPublicSiteUrl } from "../src/public/siteData";

export default function sitemap() {
  const siteUrl = getPublicSiteUrl();
  const now = new Date();
  const routes = ["", "/calendar", "/wire", "/leaderboard", "/picks", "/insight", "/leagues"];

  return routes.map((route) => ({
    url: `${siteUrl}${route || "/"}`,
    lastModified: now,
    changeFrequency: route === "" ? "daily" : "weekly",
    priority: route === "" ? 1 : 0.8,
  }));
}
