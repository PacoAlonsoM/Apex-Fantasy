import LegacyAppEntry from "@/src/shell/LegacyAppEntry";
import { PAGE_META } from "@/src/lib/siteData";

export const metadata = PAGE_META.leaderboard;

export default function LeaderboardPage() {
  return <LegacyAppEntry />;
}
