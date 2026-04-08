import LegacyAppEntry from "@/src/shell/LegacyAppEntry";
import { PAGE_META } from "@/src/lib/siteData";

export const metadata = PAGE_META.wire;

export default function WirePage() {
  return <LegacyAppEntry />;
}
