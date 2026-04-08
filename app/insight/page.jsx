import LegacyAppEntry from "@/src/shell/LegacyAppEntry";
import { PAGE_META } from "@/src/lib/siteData";

export const metadata = PAGE_META.insight;

export default function InsightPage() {
  return <LegacyAppEntry />;
}
