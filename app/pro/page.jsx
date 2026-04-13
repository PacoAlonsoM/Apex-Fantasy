import LegacyAppEntry from "@/src/shell/LegacyAppEntry";

export const metadata = {
  title:       "Stint Pro — Unlock the Full Game",
  description: "Pro game modes, AI race insights, unlimited leagues and full stats. Upgrade to Stint Pro today.",
};

export default function ProRoute() {
  return <LegacyAppEntry initialPage="pro" />;
}
