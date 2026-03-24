import LegacyAppEntry from "../../../src/public/LegacyAppEntry";

export const metadata = {
  title: "STINT App",
  description: "Private STINT application workspace for authenticated users.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function PrivateAppPage() {
  return <LegacyAppEntry />;
}
