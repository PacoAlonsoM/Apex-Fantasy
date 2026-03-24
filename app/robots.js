import { getPublicSiteUrl } from "../src/public/siteData";

export default function robots() {
  const siteUrl = getPublicSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/calendar", "/wire", "/leaderboard", "/picks", "/insight", "/leagues", "/llms.txt"],
        disallow: ["/app"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
