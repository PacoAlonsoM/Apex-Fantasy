import LegacyAppEntry from "@/src/shell/LegacyAppEntry";

export const metadata = {
  title:       "Welcome to Stint Pro 🏁",
  description: "Your Pro subscription is active. Explore everything that's been unlocked.",
};

export default function ProSuccessRoute() {
  return <LegacyAppEntry initialPage="pro_success" />;
}
