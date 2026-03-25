import "../src/index.css";

const siteUrl = process.env.REACT_APP_PUBLIC_SITE_URL || "https://www.stint-web.com";

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
  },
  twitter: {
    card: "summary_large_image",
    title: "STINT · F1 Predictions",
    description: "Race-week context, picks, AI insight, wire coverage and leaderboard reads in one clean F1 product.",
  },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: ["/favicon.svg"],
    apple: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
