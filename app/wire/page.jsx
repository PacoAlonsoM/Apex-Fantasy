import LegacyAppEntry from "../../src/public/LegacyAppEntry";
import { PAGE_META } from "../../src/public/siteData";

export const metadata = PAGE_META.wire;

export default function WirePage() {
  return <LegacyAppEntry />;
}
