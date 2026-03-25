import LegacyAppEntry from "../../src/public/LegacyAppEntry";
import { PAGE_META } from "../../src/public/siteData";

export const metadata = PAGE_META.leaderboard;

export default function LeaderboardPage() {
  return <LegacyAppEntry />;
}
