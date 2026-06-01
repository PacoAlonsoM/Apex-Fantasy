import "../src/index.css";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.stint-web.com";

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "STINT · F1 Predictions",
    template: "%s · STINT",
  },
  description: "Stint is the F1 predictions product for sharper picks, cleaner reads, and race-week timing that stays in sync.",
  openGraph: {
    title: "STINT · F1 Predictions",
    description: "Race-week context, picks, AI insight, wire coverage and leaderboard reads in one clean F1 product.",
    url: siteUrl,
    siteName: "STINT",
    type: "website",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "STINT · F1 Predictions" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "STINT · F1 Predictions",
    description: "Race-week context, picks, AI insight, wire coverage and leaderboard reads in one clean F1 product.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: ["/favicon.svg"],
    apple: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
};

// Restore the user's saved theme + density preferences before hydration so
// `data-theme` and `data-density` are set on <html> before any paint.
const themeBootstrap = `
  try {
    var saved = localStorage.getItem('stint-theme') || 'auto';
    var resolved = saved === 'auto'
      ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
      : saved;
    document.documentElement.dataset.theme = resolved;
    document.documentElement.dataset.themePreference = saved;
    var density = localStorage.getItem('stint-density');
    document.documentElement.dataset.density = (density === 'compact' || density === 'comfortable') ? density : 'comfortable';
  } catch (e) {}
`;

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      data-theme="dark"
      data-theme-preference="auto"
      data-density="comfortable"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
