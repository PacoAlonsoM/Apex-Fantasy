import LegacyAppEntry from "@/src/shell/LegacyAppEntry";
import { PAGE_META } from "@/src/lib/siteData";

export const metadata = PAGE_META.home;

export default function HomePage() {
  return <LegacyAppEntry />;
}
