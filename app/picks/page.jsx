import LegacyAppEntry from "@/src/shell/LegacyAppEntry";
import { PAGE_META } from "@/src/lib/siteData";

export const metadata = PAGE_META.picks;

export default function PicksPage() {
  return <LegacyAppEntry />;
}
