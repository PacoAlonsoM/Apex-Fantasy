import { redirect } from "next/navigation";
import { isKnownPage, legacySlugToPage, pageToHref } from "../../../src/routing";

export const metadata = {
  title: "STINT App",
  description: "Private STINT application workspace for authenticated users.",
  robots: {
    index: false,
    follow: false,
  },
};

function toURLSearchParams(searchParams) {
  const params = new URLSearchParams();

  Object.entries(searchParams || {}).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item != null) params.append(key, item);
      });
      return;
    }

    if (value != null) {
      params.set(key, value);
    }
  });

  return params;
}

export default async function PrivateAppPage({ params, searchParams }) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const query = toURLSearchParams(resolvedSearchParams);
  const legacySegment = Array.isArray(resolvedParams?.slug) ? resolvedParams.slug[0] : resolvedParams?.slug;
  const queryPage = query.get("page");
  const requestedPage = isKnownPage(queryPage) ? queryPage : null;
  const page = legacySlugToPage(legacySegment) || requestedPage || "home";

  redirect(pageToHref(page, {
    demoMode: query.get("demo") === "1",
    raceRound: query.get("race"),
  }));
}
