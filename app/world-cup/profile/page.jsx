import LegacyAppEntry from "@/src/shell/LegacyAppEntry";
import { PAGE_META } from "@/src/lib/siteData";

export const metadata = PAGE_META.wc_profile;

export default function WorldCupProfilePage() {
  return <LegacyAppEntry />;
}
