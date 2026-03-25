import LegacyAppEntry from "../../src/public/LegacyAppEntry";
import { PAGE_META } from "../../src/public/siteData";

export const metadata = PAGE_META.calendar;

export default function CalendarPage() {
  return <LegacyAppEntry />;
}
