import LegacyAppEntry from "@/src/shell/LegacyAppEntry";
import { PAGE_META } from "@/src/lib/siteData";

export const metadata = PAGE_META.wc_admin;

export default function WorldCupAdminPage() {
  return <LegacyAppEntry />;
}
