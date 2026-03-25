import LegacyAppEntry from "../src/public/LegacyAppEntry";
import { PAGE_META } from "../src/public/siteData";

export const metadata = PAGE_META.home;

export default function HomePage() {
  return <LegacyAppEntry />;
}
