import { ACTIVE_CAL, countdown, fmtFull, nextRace, parseDate } from "@/src/constants/calendar";
import { BRAND_DESCRIPTOR, BRAND_NAME, BRAND_TAGLINE, LEGAL_DISCLAIMER, SUPPORT_EMAIL } from "@/src/constants/design";
import { getViewerTimeZoneLabel } from "@/src/lib/timezone";
export const PUBLIC_NAV = [
  { href: "/", key: "home", label: "Home" },
  { href: "/calendar", key: "calendar", label: "Calendar" },
  { href: "/picks", key: "picks", label: "Picks" },
  { href: "/insight", key: "insight", label: "AI Insight" },
  { href: "/wire", key: "wire", label: "Wire" },
  { href: "/leaderboard", key: "leaderboard", label: "Leaderboard" },
  { href: "/leagues", key: "leagues", label: "Leagues" },
  { href: "/grid", key: "grid", label: "The Grid" },
  { href: "/pro", key: "pro", label: "Pro" },
];

export const FOOTER_LINKS = [
  { href: "/", label: "Home" },
  { href: "/calendar", label: "Calendar" },
  { href: "/picks", label: "Picks" },
  { href: "/insight", label: "AI Insight" },
  { href: "/wire", label: "Wire" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/leagues", label: "Leagues" },
  { href: "/grid", label: "The Grid" },
  { href: "/pro", label: "Stint Pro" },
  { href: "/app?page=support", label: "Support" },
  { href: "/app?page=terms", label: "Terms" },
  { href: "/app?page=privacy", label: "Privacy" },
];

export const PAGE_META = {
  home: {
    title: "Compete hard. Predict sharp. Win your league.",
    description: "STINT is the public F1 predictions front door: next-race context, sharper reads, wire coverage and clean paths into picks and leagues.",
  },
  calendar: {
    title: "F1 Calendar and Weekend Timeline",
    description: "Read the season as one race-week system with round dates, session order, timezone-adjusted timing and next-race context.",
  },
  wire: {
    title: "F1 Wire and Race-Week Coverage",
    description: "Read the key F1 storylines, wire coverage and longer summaries without leaving the STINT product.",
  },
  leaderboard: {
    title: "Public Leaderboard",
    description: "See the public STINT leaderboard and the players setting the pace right now.",
  },
  picks: {
    title: "How STINT Picks Work",
    description: "See how the STINT board works: categories, lock timing, sprint weekends and how one race can swing a league.",
  },
  insight: {
    title: "AI Insight",
    description: "Read the public STINT AI race brief: what matters this week, where the weekend can turn and which categories carry leverage.",
  },
  leagues: {
    title: "Leagues",
    description: "See how STINT leagues work, why they matter race to race, and how the product turns a season into a table everyone can track.",
  },
  grid: {
    title: "The Grid — Community Forum",
    description: "Race discussion, feature requests and general talk from the STINT community. Vote on ideas, join the conversation.",
  },
  pro: {
    title: "Stint Pro — Unlock the Full Game",
    description: "Pro game modes, AI race insights, unlimited leagues and full stats. Upgrade to Stint Pro for the complete race-week experience.",
  },
  pro_success: {
    title: "Welcome to Stint Pro",
    description: "Your Pro subscription is active. All Pro features are now unlocked.",
  },
};

function normalizeUrl(rawUrl) {
  if (!rawUrl) return "";
  const value = rawUrl.trim();
  if (!value) return "";
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return withProtocol.replace(/\/+$/, "");
}

export function getPublicSiteUrl() {
  return normalizeUrl(process.env.NEXT_PUBLIC_SITE_URL || "https://www.stint-web.com");
}

function buildDateWindow(race) {
  const endDate = parseDate(race.date);
  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - 2);
  const startMonth = startDate.toLocaleDateString("en-US", { month: "long" });
  const endMonth = endDate.toLocaleDateString("en-US", { month: "long" });
  const startDay = startDate.getDate();
  const endDay = endDate.getDate();

  if (startMonth === endMonth) return `${startMonth} ${startDay}-${endDay}`;
  return `${startMonth} ${startDay}-${endMonth} ${endDay}`;
}

function buildSessionTimeline(race) {
  const raceDate = parseDate(race.date);
  const layouts = race.sprint
    ? [
        { label: "FP1", offset: -2 },
        { label: "Sprint Qualifying", offset: -2, accent: "#f97316" },
        { label: "Sprint", offset: -1, accent: "#a855f7" },
        { label: "Qualifying", offset: -1, accent: "#f97316" },
        { label: "Race", offset: 0, accent: "#ef4444" },
      ]
    : [
        { label: "FP1", offset: -2 },
        { label: "FP2", offset: -2 },
        { label: "FP3", offset: -1 },
        { label: "Qualifying", offset: -1, accent: "#f97316" },
        { label: "Race", offset: 0, accent: "#ef4444" },
      ];

  return layouts.map((session) => {
    const sessionDate = new Date(raceDate);
    sessionDate.setDate(raceDate.getDate() + session.offset);
    const weekday = sessionDate.toLocaleDateString("en-US", { weekday: "short" });
    const month = sessionDate.toLocaleDateString("en-US", { month: "short" });
    const day = sessionDate.getDate();
    return {
      ...session,
      detail: `${weekday}, ${month} ${day} · local time adapts to your browser`,
    };
  });
}

export function getNextRaceSnapshot() {
  const race = nextRace();
  const count = countdown(race.date) || { d: 0, h: 0, m: 0 };

  return {
    round: race.displayRound || race.r,
    internalRound: race.r,
    name: race.n,
    circuit: race.circuit,
    location: `${race.city}, ${race.cc}`,
    dateLabel: fmtFull(race.date),
    dateWindow: buildDateWindow(race),
    sprint: race.sprint,
    countdown: {
      days: String(count.d).padStart(2, "0"),
      hours: String(count.h).padStart(2, "0"),
      minutes: String(count.m).padStart(2, "0"),
    },
    timezone: getViewerTimeZoneLabel(),
    timeline: buildSessionTimeline(race),
    appHref: `/app?page=predictions&race=${race.r}`,
  };
}

export function getCalendarGroups() {
  const groups = new Map();

  for (const race of ACTIVE_CAL) {
    const label = parseDate(race.date).toLocaleDateString("en-GB", { month: "long", year: "numeric" }).toUpperCase();
    const rows = groups.get(label) || [];
    rows.push({
      round: `R${race.displayRound || race.r}`,
      name: race.n,
      location: `${race.city}, ${race.cc}`,
      dateWindow: buildDateWindow(race),
      sprint: race.sprint,
      active: race.r === getNextRaceSnapshot().internalRound,
    });
    groups.set(label, rows);
  }

  return Array.from(groups.entries()).map(([label, races]) => ({ label, races }));
}

export const wireStories = [
  {
    source: "Race Week",
    tag: "Featured",
    title: "Suzuka is where rhythm matters more than noise",
    summary:
      "The Japanese Grand Prix rewards drivers and teams that can repeat a stable balance through long, loaded corners. That usually makes it a weekend where the fastest headline lap matters less than the ability to carry confidence through sector one, protect tyres across a full stint and stay clean when the track starts moving underneath the car. For fantasy players, that changes how you read the board: it becomes less about chasing chaos and more about spotting who can string sessions together without a wobble.",
  },
  {
    source: "Wire",
    tag: "Race Week",
    title: "Why Suzuka can flip the shape of a fantasy league",
    summary:
      "On a track this technical, pole and race winner often stay tightly connected, but the more interesting swing points usually live in the supporting categories. A clean qualifying read can unlock both front-of-the-order picks and the constructor call, while one late incident can swing Safety Car, Driver of the Day and the race narrative all at once. That is why this is one of the better weekends to read broadly before locking anything in.",
  },
  {
    source: "Motorsport Week",
    tag: "Team Watch",
    title: "Who actually arrives in control: Mercedes, Ferrari or McLaren?",
    summary:
      "The real question this week is not who can spike one lap in clean air, but which team turns up with a repeatable car from Friday to Sunday. Suzuka usually punishes imbalance, and the teams that look calm through the esses, Degners and Spoon tend to keep that advantage when qualifying pressure hits. If a team is still solving the car on Saturday morning, fantasy players normally feel that uncertainty immediately in the board.",
  },
  {
    source: "Grid Notes",
    tag: "Driver Read",
    title: "The difference between a safe pick and a smart pick",
    summary:
      "The safest pick is not always the most useful pick. Some weekends the right edge comes from understanding which category is likely to stay chalk and which one carries real separation. The public wire keeps that context on-page so you can read the race, read the field and only leave when you are actually ready to lock something in.",
  },
];

export const leaderboardRows = [
  { rank: 1, name: "LucasDirtyAir", points: 173, note: "Current global leader" },
  { rank: 2, name: "AlmaTyreDelta", points: 162, note: "Strong at swing categories" },
  { rank: 3, name: "NinaBoxBox", points: 152, note: "Quietly consistent scorer" },
  { rank: 4, name: "MiaChicane", points: 138, note: "Aggressive fantasy profile" },
  { rank: 5, name: "SofiaUndercut", points: 131, note: "Rarely misses the basics" },
  { rank: 6, name: "SantiSector1", points: 116, note: "Good qualifier reads" },
  { rank: 7, name: "Pacoalonso", points: 32, note: "Inside the main room" },
];

export const pickCategories = [
  { name: "Pole Position", points: "10 pts", summary: "The one-lap anchor of the board." },
  { name: "Race Winner", points: "25 pts", summary: "The biggest single call on a standard weekend." },
  { name: "2nd Place", points: "18 pts", summary: "Where strong pace and race management meet." },
  { name: "3rd Place", points: "15 pts", summary: "A podium call that often separates close rooms." },
  { name: "DNF Driver", points: "12 pts", summary: "Volatility without needing to overcomplicate the board." },
  { name: "Fastest Lap", points: "7 pts", summary: "Late-race control or a strategic free stop can swing it." },
  { name: "Driver of the Day", points: "6 pts", summary: "Narrative and execution both matter here." },
  { name: "Best Constructor", points: "8 pts", summary: "The broadest read on who owns the weekend." },
  { name: "Safety Car", points: "5 pts", summary: "Context call tied to race tempo and incident risk." },
  { name: "Red Flag", points: "8 pts", summary: "Rare, but league-shifting when it lands." },
];

export const sprintExtras = [
  { name: "Sprint Pole", points: "5 pts" },
  { name: "Sprint Winner", points: "12 pts" },
  { name: "Sprint 2nd", points: "9 pts" },
  { name: "Sprint 3rd", points: "7 pts" },
];

export function getInsightBrief() {
  const race = getNextRaceSnapshot();
  return {
    title: `${race.name}: the weekend is about rhythm, not noise`,
    intro:
      "The public AI Insight page is where STINT turns a race week into something readable. Instead of forcing users straight into picks, it gives them one clean brief on what matters before they lock anything in.",
    sections: [
      {
        title: "Qualifying will shape the entire board",
        body:
          "Suzuka compresses the gap between outright pace and driver confidence. When a team arrives with a stable front end, that usually carries straight from practice into qualifying, and qualifying here still dictates more of Sunday than on most tracks. That makes pole, race winner and constructor reads feel more connected than they do on a stop-start circuit.",
      },
      {
        title: "The leverage is in the support categories",
        body:
          "The obvious calls get most of the attention, but league gaps are often built underneath them. A Safety Car, a late fastest lap, or the wrong constructor read can undo an otherwise solid board. This is the kind of round where reading the whole weekend matters more than chasing a single hot take.",
      },
      {
        title: "What STINT is trying to tell the player",
        body:
          "The product should help users decide with more confidence, not just make them click around. So the public AI layer stays useful on its own: context first, picks second, with a direct path into the app only when the player is actually ready to lock the board.",
      },
    ],
    ctaHref: race.appHref,
  };
}

export function getLeagueTeaser() {
  return {
    intro:
      "Leagues are where STINT stops feeling like a dashboard and starts feeling like a room. The public page explains the format and shows what the competition feels like without exposing private league workflows.",
    features: [
      {
        title: "Race-by-race tension",
        body:
          "Every round can change the table. The point is not just to be right once, but to stack reads across the whole season and stay close enough that one sharp weekend changes the room.",
      },
      {
        title: "Shared context, private competition",
        body:
          "Everyone can read the same calendar, wire coverage and AI brief. What separates players is how they convert that context into a board before lock.",
      },
      {
        title: "Built for repeat visits",
        body:
          "The league layer gives users a reason to come back before practice, before qualifying and after the race. That repeat rhythm is part of the product, not just decoration.",
      },
    ],
    highlights: [
      "Leaderboard gaps feel meaningful from race to race",
      "Picks, reads and timing all feed the same competition loop",
      "The private workspace can stay protected while the public page sells the format clearly",
    ],
  };
}

export function getSiteChrome() {
  return {
    brandName: BRAND_NAME,
    descriptor: BRAND_DESCRIPTOR,
    tagline: BRAND_TAGLINE,
    disclaimer: LEGAL_DISCLAIMER,
    supportEmail: SUPPORT_EMAIL,
  };
}
