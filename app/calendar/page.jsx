import LegacyAppEntry from "@/src/shell/LegacyAppEntry";
import { PAGE_META } from "@/src/lib/siteData";

export const metadata = PAGE_META.calendar;

export default function CalendarPage() {
  return <LegacyAppEntry />;
}
