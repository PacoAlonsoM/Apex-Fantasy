import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import StandingsPage from "@/src/features/standings/StandingsPage";
import { CAL, nextRace } from "@/src/constants/calendar";
import { PTS } from "@/src/constants/scoring";
import {
  ACCENT,
  BRAND_GRADIENT,
  CARD_RADIUS,
  CONTENT_MAX,
  DEFAULT_AVATAR_COLOR,
  EDGE_RING,
  HAIRLINE,
  MUTED_TEXT,
  PANEL_BG,
  PANEL_BG_ALT,
  PANEL_BORDER,
  SECTION_RADIUS,
  SOFT_SHADOW,
  SUBTLE_TEXT,
  avatarTheme,
  teamSupportKey,
} from "@/src/constants/design";
import { requireActiveSession } from "@/src/shell/authProfile";
import { formatDnfDrivers, matchesDnfPick } from "@/src/lib/resultHelpers";
import useViewport from "@/src/lib/useViewport";
import PageHeader from "@/src/ui/PageHeader";
import ProPip from "@/src/ui/ProPip";

const avatarPalette = [
  ["#94a3b8", "#e2e8f0"],
  ["#64748b", "#dbe4f0"],
  ["#0f766e", "#ccfbf1"],
  ["#1d4ed8", "#dbeafe"],
  ["#475569", "#f8fafc"],
];

function avatarTone(name = "") {
  const total = name.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return avatarPalette[total % avatarPalette.length];
}

function formatStamp(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function AvatarChip({ name, colorKey, size = 32, radius = 10, fontSize = 11, pro = false }) {
  const theme = colorKey ? avatarTheme(colorKey) : null;
  const [bg, color] = theme ? [theme.fill, theme.text] : avatarTone(name);
  const border = theme ? theme.border : `${bg}44`;
  const badgeSize = Math.max(12, Math.round(size * 0.42));
  return (
    <div style={{ width: size, height: size, position: "relative", flexShrink: 0 }}>
      <div style={{ width: "100%", height: "100%", borderRadius: radius, background: theme ? bg : `${bg}22`, border: `1px solid ${border}`, boxShadow: theme ? "inset 0 0 0 1px rgba(255,255,255,0.08)" : "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize, fontWeight: 900, color }}>
        {(name || "?").slice(0, 2).toUpperCase()}
      </div>
      {pro && (
        <ProPip size={badgeSize} style={{ position: "absolute", right: -2, bottom: -2 }} />
      )}
    </div>
  );
}

function StatCard({ label, value, accent = "#e2e8f0" }) {
  return (
    <div style={{ borderRadius: 16, border: "1px solid rgba(148,163,184,0.12)", background: PANEL_BG_ALT, padding: "14px 14px 12px" }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.8, color: accent }}>{value}</div>
    </div>
  );
}

function normalizeProfileIdentity(profile, currentUser = null) {
  if (!profile) return profile;

  const favoriteTeam = (currentUser?.id === profile.id ? currentUser.favorite_team : null) || profile.favorite_team || null;
  const avatarColor = (currentUser?.id === profile.id ? currentUser.avatar_color : null)
    || profile.avatar_color
    || (favoriteTeam ? teamSupportKey(favoriteTeam) : DEFAULT_AVATAR_COLOR);

  return {
    ...profile,
    favorite_team: favoriteTeam,
    avatar_color: avatarColor,
  };
}

const LEAGUE_RACE_REVIEW_PROMPTS = [
  { key: "pole", label: "Pole Position", pts: PTS.pole },
  { key: "winner", label: "Race Winner", pts: PTS.winner },
  { key: "p2", label: "2nd Place", pts: PTS.p2 },
  { key: "p3", label: "3rd Place", pts: PTS.p3 },
  { key: "dnf", label: "DNF Driver", pts: PTS.dnf },
  { key: "fl", label: "Fastest Lap", pts: PTS.fl },
  { key: "dotd", label: "Driver of the Day", pts: PTS.dotd },
  { key: "ctor", label: "Constructor with Most Points", pts: PTS.ctor },
  { key: "sc", label: "Safety Car?", pts: PTS.sc },
  { key: "rf", label: "Red Flag?", pts: PTS.rf },
];

const LEAGUE_SPRINT_REVIEW_PROMPTS = [
  { key: "sp_pole", label: "Sprint Pole", pts: PTS.sp_pole },
  { key: "sp_winner", label: "Sprint Winner", pts: PTS.sp_winner },
  { key: "sp_p2", label: "Sprint 2nd", pts: PTS.sp_p2 },
  { key: "sp_p3", label: "Sprint 3rd", pts: PTS.sp_p3 },
];

const PRO_LEAGUE_PRIZES = [
  { label: "Champion", value: "$250 cash", accent: "#f59e0b" },
  { label: "Podium bonus", value: "$500 total pool", accent: "#fde68a" },
  { label: "Season perk", value: "Wire feature + founder badge", accent: "#bfdbfe" },
];

const DEFAULT_LEAGUE_SETTINGS = {
  scoring_weights: { pole: 10, winner: 25, p2: 18, p3: 15, fl: 7, dotd: 6, dnf: 12, ctor: 8 },
  sprint_multiplier: 0.5,
  tiebreaker_order: ["most_correct", "best_single_race", "head_to_head", "earliest_joined"],
  double_points_races: [],
  extra_categories: [],
};

const LEAGUE_VIEW_LABELS = {
  standings: "Standings",
  review: "Round Review",
  chat: "Chat",
  setup: "Rules",
};

const LEAGUE_MODE_LABELS = {
  standard: "Standard",
  survival: "Survival",
  draft: "Draft",
  double_down: "Double Down",
  head_to_head: "Head-to-Head",
  budget_picks: "Budget Picks",
};

const LEAGUE_VISIBILITY_LABELS = {
  private: "Private",
  public: "Public",
};

const LEAGUE_TIEBREAKER_LABELS = {
  most_correct: "Most correct picks",
  best_single_race: "Best single race",
  head_to_head: "Head-to-head record",
  earliest_joined: "Earliest to join",
};

const LEAGUE_SCORING_FIELDS = [
  { key: "pole", label: "Pole" },
  { key: "winner", label: "Winner" },
  { key: "p2", label: "P2" },
  { key: "p3", label: "P3" },
  { key: "fl", label: "Fastest Lap" },
  { key: "dotd", label: "DOTD" },
  { key: "dnf", label: "DNF" },
  { key: "ctor", label: "Constructor" },
];

const LEAGUE_EXTRA_CATEGORY_LABELS = {
  p4: "4th Place",
  p10: "10th Place",
  vsc: "Virtual Safety Car",
  lap1_incident: "Lap 1 Incident",
  rain_race: "Rain During Race",
  fastest_ctor: "Fastest Pit Stop",
};

const FALLBACK_PRO_LEAGUE = {
  id: "mock-pro-community",
  name: "Pro Community League",
  type: "pro_community",
  visibility: "public",
  is_public: true,
  game_mode: "standard",
  owner_id: null,
  code: "PRO",
  settings: {
    scoring_weights: { ...DEFAULT_LEAGUE_SETTINGS.scoring_weights },
    sprint_multiplier: 1,
    tiebreaker_order: [...DEFAULT_LEAGUE_SETTINGS.tiebreaker_order],
    double_points_races: [],
    extra_categories: [],
  },
};

const MOCK_PRO_USERS = [
  { id: "mock-pro-grid-racer-hk", username: "grid_racer_hk", avatar_color: "gold", points: 2420, subscription_status: "pro" },
  { id: "mock-pro-pitwall-pro", username: "pitwall_pro", avatar_color: "ocean", points: 2195, subscription_status: "pro" },
  { id: "mock-pro-apexhunter-v", username: "apexhunter_v", avatar_color: "ember", points: 1988, subscription_status: "pro" },
  { id: "mock-pro-tyre-whisperer", username: "tyre_whisperer", avatar_color: "steel", points: 1876, subscription_status: "pro" },
  { id: "mock-pro-overcut-king", username: "overcut_king", avatar_color: "teal", points: 1754, subscription_status: "pro" },
  { id: "mock-pro-drs-zone-r", username: "drs_zone_r", avatar_color: "violet", points: 1612, subscription_status: "pro" },
  { id: "mock-pro-stint-veteran", username: "stint_veteran", avatar_color: "gold", points: 1540, subscription_status: "pro" },
  { id: "mock-pro-paddock-analyst", username: "paddock_analyst", avatar_color: "ocean", points: 1433, subscription_status: "pro" },
  { id: "mock-pro-lauda-line", username: "lauda_line", avatar_color: "ember", points: 1381, subscription_status: "pro" },
  { id: "mock-pro-box-box-bella", username: "box_box_bella", avatar_color: "steel", points: 1290, subscription_status: "pro" },
];

const MOCK_PRO_USERNAMES = new Set(MOCK_PRO_USERS.map((profile) => profile.username));

const MOCK_PRO_POST_BLUEPRINTS = [
  { username: "pitwall_pro", hoursAgo: 3, body: "Locked Norris for pole already. If McLaren keeps this long-run pace, the Pro board is going to move fast this weekend." },
  { username: "paddock_analyst", hoursAgo: 5, body: "Reminder for everyone browsing the room: this board is public to follow, but only Pro members score and chat live here." },
  { username: "grid_racer_hk", hoursAgo: 9, body: "Season prize pool looks serious now. Going aggressive on podium picks early before the midfield gets tidy." },
  { username: "tyre_whisperer", hoursAgo: 12, body: "Race sims say tyre degradation is the real swing factor. I am fading the obvious winner pick for once." },
  { username: "lauda_line", hoursAgo: 19, body: "The best part of this league is the field size. No soft weekends, no hiding, just one big season table." },
  { username: "box_box_bella", hoursAgo: 27, body: "Forum check-in from the back of the top 10: I am one clean sprint weekend away from making this ugly for everyone ahead." },
];

function identityKey(profile) {
  return String(profile?.username || profile?.id || "").trim().toLowerCase();
}

function isUuidLike(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || "").trim());
}

function isProProfile(profile, fallbackName = "") {
  const username = String(profile?.username || fallbackName || "").trim().toLowerCase();
  return profile?.subscription_status === "pro" || MOCK_PRO_USERNAMES.has(username);
}

function mergeProfilesByIdentity(profiles, currentUser = null) {
  const merged = new Map();

  (profiles || []).forEach((profile) => {
    const normalized = normalizeProfileIdentity(profile, currentUser);
    const key = identityKey(normalized);
    if (!key) return;

    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, normalized);
      return;
    }

    const normalizedPoints = Number(normalized.points || 0);
    const existingPoints = Number(existing.points || 0);
    if (normalizedPoints >= existingPoints) {
      merged.set(key, { ...existing, ...normalized });
    }
  });

  return [...merged.values()];
}

function buildMockProStandings(currentUser = null) {
  const currentUserEntry = currentUser?.subscription_status === "pro" && currentUser?.username
    ? [{ ...currentUser, subscription_status: "pro" }]
    : [];

  return mergeProfilesByIdentity([...MOCK_PRO_USERS, ...currentUserEntry], currentUser)
    .sort((left, right) => (
      Number(right.points || 0) - Number(left.points || 0)
      || left.username.localeCompare(right.username)
    ));
}

function buildMockProPosts(leagueId, currentUser = null) {
  const mockProfiles = new Map(buildMockProStandings(currentUser).map((profile) => [profile.username, profile]));

  return MOCK_PRO_POST_BLUEPRINTS.map((entry, index) => {
    const author = mockProfiles.get(entry.username) || MOCK_PRO_USERS.find((profile) => profile.username === entry.username) || {};
    return {
      id: `mock-pro-post-${index + 1}`,
      league_id: leagueId || "mock-pro-community",
      author_id: author.id || `mock-pro-author-${index + 1}`,
      author_name: author.username || entry.username,
      title: entry.body.slice(0, 72),
      body: entry.body,
      created_at: new Date(Date.now() - (entry.hoursAgo * 60 * 60 * 1000)).toISOString(),
    };
  }).sort((left, right) => new Date(right.created_at) - new Date(left.created_at));
}

function mergePostsByIdentity(posts) {
  const merged = new Map();

  (posts || []).forEach((post) => {
    const key = post?.id || `${post?.author_id || "anon"}:${post?.title || post?.body || ""}`;
    if (!merged.has(key)) merged.set(key, post);
  });

  return [...merged.values()].sort((left, right) => new Date(right.created_at) - new Date(left.created_at));
}

function resultValueForKey(results, key) {
  if (!results) return null;

  switch (key) {
    case "pole":
      return results.pole || null;
    case "winner":
      return results.winner || null;
    case "p2":
      return results.p2 || null;
    case "p3":
      return results.p3 || null;
    case "dnf":
      return formatDnfDrivers(results);
    case "fl":
      return results.fastest_lap || null;
    case "dotd":
      return results.dotd || null;
    case "ctor":
      return results.best_constructor || null;
    case "sc":
      return typeof results.safety_car === "boolean" ? (results.safety_car ? "Yes" : "No") : null;
    case "rf":
      return typeof results.red_flag === "boolean" ? (results.red_flag ? "Yes" : "No") : null;
    case "sp_pole":
      return results.sp_pole || null;
    case "sp_winner":
      return results.sp_winner || null;
    case "sp_p2":
      return results.sp_p2 || null;
    case "sp_p3":
      return results.sp_p3 || null;
    default:
      return null;
  }
}

function buildLeagueReviewRows(prompts, picks, results, breakdown) {
  return prompts.map((prompt) => {
    const pick = picks?.[prompt.key] || null;
    const actual = resultValueForKey(results, prompt.key);
    const hit = prompt.key === "dnf"
      ? matchesDnfPick(pick, results)
      : (!!pick && actual !== null && pick === actual);
    const breakdownItem = Array.isArray(breakdown)
      ? breakdown.find((item) => item.label === prompt.label)
      : null;

    return {
      key: prompt.key,
      label: prompt.label,
      pick,
      actual,
      hit,
      points: hit ? Number(breakdownItem?.pts || prompt.pts || 0) : 0,
    };
  }).filter((row) => row.pick || row.actual);
}

function totalRowPoints(rows) {
  return (rows || []).reduce((sum, row) => sum + Number(row.points || 0), 0);
}

function bonusPointsFromBreakdown(breakdown) {
  if (!Array.isArray(breakdown)) return 0;
  return breakdown.reduce(
    (sum, item) => (item.label === "Perfect Podium Bonus" ? sum + Number(item.pts || 0) : sum),
    0
  );
}

function roundMeta(roundNumber) {
  return CAL.find((item) => Number(item.r) === Number(roundNumber)) || null;
}

export default function CommunityPage({ user, openAuth, demoMode = false, setPage }) {
  const { isMobile, isTablet } = useViewport();
  const isProUser = user?.subscription_status === "pro";
  const [tab, setTab] = useState("leagues");
  const [leagueView, setLeagueView] = useState("standings");
  const [authorProfiles, setAuthorProfiles] = useState({});
  const [leaderboard, setLeaderboard] = useState([]);
  const [leagues, setLeagues] = useState([]);
  const [leagueStandings, setLeagueStandings] = useState({});
  const [leaguePosts, setLeaguePosts] = useState({});
  const [leagueForumReady, setLeagueForumReady] = useState({});
  const [scoredRounds, setScoredRounds] = useState([]);
  const [leagueReviewRound, setLeagueReviewRound] = useState(null);
  const [leagueRoundReviews, setLeagueRoundReviews] = useState({});
  const [selectedLeagueId, setSelectedLeagueId] = useState(null);
  const [loadingLB, setLoadingLB] = useState(true);
  const [leagueMessage, setLeagueMessage] = useState("");
  const [leagueName, setLeagueName] = useState("");
  const [leagueGameMode, setLeagueGameMode] = useState("standard");
  const [leagueVisibility, setLeagueVisibility] = useState("private");
  const [joinCode, setJoinCode] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createStep, setCreateStep] = useState(0);
  const [sprintMultiplier, setSprintMultiplier] = useState(0.5);
  const [scoringWeights, setScoringWeights] = useState({ pole: 10, winner: 25, p2: 18, p3: 15, fl: 7, dotd: 6, dnf: 12, ctor: 8 });
  const [tiebreakerOrder, setTiebreakerOrder] = useState(["most_correct", "best_single_race", "head_to_head", "earliest_joined"]);
  const [extraCategories, setExtraCategories] = useState([]);
  const [proLeague, setProLeague] = useState(null);
  const demoPreview = demoMode && !user;
  const visibleProLeague = proLeague || FALLBACK_PRO_LEAGUE;
  const visibleProLeagueId = visibleProLeague.id;
  const mockProStandings = useMemo(() => buildMockProStandings(user), [user]);
  const mockProPosts = useMemo(() => buildMockProPosts(visibleProLeagueId, user), [visibleProLeagueId, user]);

  const currentLeague = useMemo(
    () => leagues.find((league) => league.id === selectedLeagueId) || (visibleProLeagueId === selectedLeagueId ? visibleProLeague : null) || visibleProLeague || leagues[0] || null,
    [leagues, selectedLeagueId, visibleProLeague, visibleProLeagueId]
  );
  const currentStandings = useMemo(
    () => (currentLeague ? (leagueStandings[currentLeague.id] || []) : []),
    [currentLeague, leagueStandings]
  );
  const currentLeaguePosts = useMemo(
    () => (currentLeague ? (leaguePosts[currentLeague.id] || []) : []),
    [currentLeague, leaguePosts]
  );
  const currentLeagueSettings = currentLeague?.settings || {};
  const currentLeagueScoring = {
    ...DEFAULT_LEAGUE_SETTINGS.scoring_weights,
    ...(currentLeagueSettings.scoring_weights || {}),
  };
  const currentLeagueTiebreakers = currentLeagueSettings.tiebreaker_order?.length
    ? currentLeagueSettings.tiebreaker_order
    : DEFAULT_LEAGUE_SETTINGS.tiebreaker_order;
  const currentLeagueSprintMultiplier = Number(
    currentLeagueSettings.sprint_multiplier
      ?? (currentLeague?.type === "pro_community" ? 1 : DEFAULT_LEAGUE_SETTINGS.sprint_multiplier)
  );
  const currentLeagueDoublePointsRaces = currentLeagueSettings.double_points_races?.length || 0;
  const currentLeagueMemberIds = useMemo(
    () => currentStandings.map((member) => member.id).filter(Boolean).join("|"),
    [currentStandings]
  );
  const next = nextRace();

  useEffect(() => {
    fetchPublicCommunity();
    fetchScoredRounds();
    fetchProLeague();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (user) fetchLeagues();
    else setLeagues([]);
  }, [user]); // eslint-disable-line

  useEffect(() => {
    if (!selectedLeagueId) return;
    fetchLeagueStandings(selectedLeagueId);
    fetchLeaguePosts(selectedLeagueId);
  }, [selectedLeagueId, user, proLeague?.id, visibleProLeagueId]); // eslint-disable-line

  useEffect(() => {
    const validIds = [...leagues.map((l) => l.id), visibleProLeagueId];
    if (!validIds.length) {
      setSelectedLeagueId(null);
      return;
    }
    if (!selectedLeagueId || !validIds.includes(selectedLeagueId)) {
      setSelectedLeagueId(visibleProLeagueId || leagues[0]?.id || null);
    }
  }, [leagues, selectedLeagueId, visibleProLeagueId]);

  useEffect(() => {
    if (!scoredRounds.length) {
      setLeagueReviewRound(null);
      return;
    }

    setLeagueReviewRound((current) => (
      current && scoredRounds.some((row) => Number(row.race_round) === Number(current))
        ? current
        : scoredRounds[0].race_round
    ));
  }, [scoredRounds]);

  useEffect(() => {
    if (!currentLeague?.id || !leagueReviewRound || !currentStandings.length) return;
    fetchLeagueRoundReview(currentLeague.id, leagueReviewRound, currentStandings);
  }, [currentLeague?.id, currentLeagueMemberIds, leagueReviewRound]); // eslint-disable-line

  useEffect(() => {
    if (!user?.id) return;

    setAuthorProfiles((current) => ({
      ...current,
      [user.id]: normalizeProfileIdentity({
        ...(current[user.id] || {}),
        id: user.id,
        username: user.username,
        avatar_color: user.avatar_color,
        favorite_team: user.favorite_team,
      }, user),
    }));
    setLeaderboard((current) => mergeProfilesByIdentity([...current, ...mockProStandings], user)
      .sort((left, right) => (Number(right.points || 0) - Number(left.points || 0)) || left.username.localeCompare(right.username)));
    setLeagueStandings((current) => Object.fromEntries(
      Object.entries(current).map(([leagueId, standings]) => [leagueId, standings.map((profile) => normalizeProfileIdentity(profile, user))])
    ));
  }, [user, mockProStandings]);

  useEffect(() => {
    setAuthorProfiles((current) => ({
      ...Object.fromEntries(mockProStandings.map((profile) => [profile.id, profile])),
      ...current,
    }));
  }, [mockProStandings]);

  useEffect(() => {
    if (!user?.id || user?.subscription_status !== "pro" || !proLeague?.id) return;

    let cancelled = false;

    async function ensureProLeagueMembership() {
      const { error } = await supabase
        .from("league_members")
        .upsert({ league_id: proLeague.id, user_id: user.id }, { onConflict: "league_id,user_id" });

      const message = String(error?.message || "").toLowerCase();
      const recoverable = !error || message.includes("duplicate") || message.includes("row-level security") || message.includes("violates");

      if (!cancelled && recoverable) {
        fetchLeagues();
        fetchLeagueStandings(proLeague.id);
      }
    }

    ensureProLeagueMembership();

    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.subscription_status, proLeague?.id]); // eslint-disable-line

  const leagueSummary = useMemo(() => {
    if (!currentStandings.length) {
      return { leader: null, average: 0, gap: 0 };
    }

    const total = currentStandings.reduce((sum, member) => sum + (member.points || 0), 0);
    return {
      leader: currentStandings[0],
      average: Math.round(total / currentStandings.length),
      gap: currentStandings.length > 1 ? (currentStandings[0].points || 0) - (currentStandings[1].points || 0) : currentStandings[0].points || 0,
    };
  }, [currentStandings]);
  const selectedLeagueRoundMeta = useMemo(() => roundMeta(leagueReviewRound), [leagueReviewRound]);
  const currentLeagueReviewKey = currentLeague?.id && leagueReviewRound ? `${currentLeague.id}:${leagueReviewRound}` : null;
  const currentLeagueReview = currentLeagueReviewKey ? leagueRoundReviews[currentLeagueReviewKey] : null;
  const currentLeagueRoundResult = currentLeagueReview?.resultRow
    || scoredRounds.find((row) => Number(row.race_round) === Number(leagueReviewRound))
    || null;
  const isViewingProLeague = currentLeague?.type === "pro_community";
  const canPostInCurrentLeague = Boolean(user && (!isViewingProLeague || (isProUser && !!proLeague?.id)));
  const privateLeagueCount = leagues.length;
  const inputStyle = {
    background: PANEL_BG_ALT,
    border: "1px solid rgba(148,163,184,0.12)",
    borderRadius: 12,
    color: "#fff",
    padding: "11px 13px",
    fontSize: 13,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
    fontFamily: "inherit",
  };

  async function hydrateAuthorProfiles(items) {
    const ids = [...new Set((items || []).map((item) => item.author_id).filter((id) => id && !String(id).startsWith("mock-")))];
    if (!ids.length) return;

    const missing = ids.filter((id) => !authorProfiles[id]);
    if (!missing.length) return;

    const { data } = await supabase.from("profiles").select("id,avatar_color,username,favorite_team,subscription_status").in("id", missing);
    if (!data?.length) return;

    setAuthorProfiles((current) => ({
      ...current,
      ...Object.fromEntries(data.map((profile) => [profile.id, normalizeProfileIdentity(profile, user)])),
    }));
  }

  async function fetchPublicCommunity() {
    setLoadingLB(true);
    const { data, error } = await supabase.functions.invoke("community-public-feed", {
      body: {},
    });

    if (error) {
      setLeaderboard(mockProStandings);
      setLoadingLB(false);
      return;
    }

    const leaderboardRows = mergeProfilesByIdentity([
      ...((data?.leaderboard || []).map((profile) => normalizeProfileIdentity(profile, user))),
      ...mockProStandings,
    ], user)
      .sort((left, right) => (Number(right.points || 0) - Number(left.points || 0)) || left.username.localeCompare(right.username));

    setLeaderboard(leaderboardRows);
    setLoadingLB(false);
  }

  async function fetchLeagues() {
    const { data } = await supabase.from("league_members").select("league_id,leagues(*)").eq("user_id", user.id);
    if (!data) return;
    const nextLeagues = data
      .map((entry) => entry.leagues)
      .filter((league) => league && league.type !== "pro_community");
    setLeagues(nextLeagues);
    if (!nextLeagues.find((league) => league.id === selectedLeagueId) && selectedLeagueId !== visibleProLeagueId) {
      setSelectedLeagueId(visibleProLeagueId || nextLeagues[0]?.id || null);
    }
  }

  async function fetchProLeague() {
    const { data } = await supabase.from("leagues").select("*").eq("type", "pro_community").single();
    if (data) setProLeague(data);
  }

  async function fetchLeagueStandings(leagueId) {
    const isProBoard = leagueId === visibleProLeagueId;
    const fallbackStandings = mockProStandings;

    if (isProBoard && !proLeague?.id) {
      setLeagueStandings((current) => ({ ...current, [leagueId]: fallbackStandings }));
      return;
    }

    const { data: members, error: membersError } = await supabase.from("league_members").select("user_id").eq("league_id", leagueId);

    if (membersError && isProBoard) {
      setLeagueStandings((current) => ({ ...current, [leagueId]: fallbackStandings }));
      return;
    }

    const ids = (members || []).map((member) => member.user_id).filter(Boolean);

    if (!ids.length) {
      setLeagueStandings((current) => ({ ...current, [leagueId]: isProBoard ? fallbackStandings : [] }));
      return;
    }

    const { data: profiles, error: profilesError } = await supabase.from("profiles").select("*").in("id", ids);

    if (profilesError && isProBoard) {
      setLeagueStandings((current) => ({ ...current, [leagueId]: fallbackStandings }));
      return;
    }

    const sorted = mergeProfilesByIdentity([
      ...((profiles || []).map((profile) => normalizeProfileIdentity(profile, user))),
      ...(isProBoard ? fallbackStandings : []),
    ], user)
      .sort((a, b) => (Number(b.points || 0) - Number(a.points || 0)) || a.username.localeCompare(b.username));

    setLeagueStandings((current) => ({ ...current, [leagueId]: sorted }));
  }

  async function fetchScoredRounds() {
    const { data } = await supabase
      .from("race_results")
      .select("*")
      .eq("results_entered", true)
      .order("race_round", { ascending: false });

    setScoredRounds(data || []);
  }

  async function fetchLeagueRoundReview(leagueId, raceRound, standings = []) {
    const key = `${leagueId}:${raceRound}`;
    const members = standings.length ? standings : (leagueStandings[leagueId] || []);
    const memberIds = members.map((member) => member.id).filter(isUuidLike);
    const resultRow = scoredRounds.find((row) => Number(row.race_round) === Number(raceRound)) || null;

    if (!memberIds.length) {
      setLeagueRoundReviews((current) => ({
        ...current,
        [key]: { loading: false, error: null, resultRow, members: [] },
      }));
      return;
    }

    setLeagueRoundReviews((current) => ({
      ...current,
      [key]: {
        loading: true,
        error: null,
        resultRow,
        members: current[key]?.members || [],
      },
    }));

    const { data, error } = await supabase
      .from("predictions")
      .select("user_id,race_round,picks,score,score_breakdown,updated_at")
      .eq("race_round", raceRound)
      .in("user_id", memberIds);

    if (error) {
      setLeagueRoundReviews((current) => ({
        ...current,
        [key]: { loading: false, error: error.message, resultRow, members: [] },
      }));
      return;
    }

    const predictionMap = new Map((data || []).map((item) => [item.user_id, item]));
    const meta = roundMeta(raceRound);
    const ranked = members
      .map((member) => {
        const prediction = predictionMap.get(member.id) || null;
        const breakdown = Array.isArray(prediction?.score_breakdown) ? prediction.score_breakdown : [];
        const raceRows = buildLeagueReviewRows(LEAGUE_RACE_REVIEW_PROMPTS, prediction?.picks || {}, resultRow, breakdown);
        const sprintRows = meta?.sprint
          ? buildLeagueReviewRows(LEAGUE_SPRINT_REVIEW_PROMPTS, prediction?.picks || {}, resultRow, breakdown)
          : [];
        const correctCalls = [...raceRows, ...sprintRows].filter((row) => row.hit).length;
        const roundScore = prediction
          ? totalRowPoints(raceRows) + totalRowPoints(sprintRows) + bonusPointsFromBreakdown(breakdown)
          : 0;

        return {
          member,
          prediction,
          roundScore,
          correctCalls,
          breakdown,
          raceRows,
          sprintRows,
        };
      })
      .sort((left, right) => (
        (right.roundScore - left.roundScore)
        || ((right.member.points || 0) - (left.member.points || 0))
        || left.member.username.localeCompare(right.member.username)
      ));

    setLeagueRoundReviews((current) => ({
      ...current,
      [key]: { loading: false, error: null, resultRow, members: ranked },
    }));
  }

  async function fetchLeaguePosts(leagueId) {
    const isProBoard = leagueId === visibleProLeagueId;
    const fallbackPosts = isProBoard ? mockProPosts : [];

    if (isProBoard && !proLeague?.id) {
      setLeagueForumReady((current) => ({ ...current, [leagueId]: true }));
      setLeaguePosts((current) => ({ ...current, [leagueId]: fallbackPosts }));
      setAuthorProfiles((current) => ({
        ...Object.fromEntries(mockProStandings.map((profile) => [profile.id, profile])),
        ...current,
      }));
      return;
    }

    const { data, error } = await supabase.from("posts").select("*").eq("league_id", leagueId).order("created_at", { ascending: false });
    if (error) {
      if (isProBoard) {
        setLeagueForumReady((current) => ({ ...current, [leagueId]: true }));
        setLeaguePosts((current) => ({ ...current, [leagueId]: fallbackPosts }));
        setAuthorProfiles((current) => ({
          ...Object.fromEntries(mockProStandings.map((profile) => [profile.id, profile])),
          ...current,
        }));
        return;
      }

      setLeagueForumReady((current) => ({ ...current, [leagueId]: false }));
      setLeaguePosts((current) => ({ ...current, [leagueId]: [] }));
      return;
    }

    const mergedPosts = mergePostsByIdentity([...(data || []), ...fallbackPosts]);
    setLeagueForumReady((current) => ({ ...current, [leagueId]: true }));
    setLeaguePosts((current) => ({ ...current, [leagueId]: mergedPosts }));
    if (isProBoard) {
      setAuthorProfiles((current) => ({
        ...Object.fromEntries(mockProStandings.map((profile) => [profile.id, profile])),
        ...current,
      }));
    }
    hydrateAuthorProfiles(mergedPosts || []);
  }

  async function createLeague() {
    if (demoPreview) return;
    if (!leagueName.trim() || !user) return;
    setCreateError("");

    const session = await requireActiveSession();
    if (!session) return openAuth("login");

    // Free users limited to 1 created league
    const isPro = user?.subscription_status === "pro";
    if (!isPro) {
      const ownedCount = leagues.filter((l) => l.owner_id === user.id).length;
      if (ownedCount >= 1) {
        setCreateError("Free accounts can create 1 league. Upgrade to Pro for unlimited leagues.");
        return;
      }
    }

    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    const settings = {
      scoring_weights:    scoringWeights,
      sprint_multiplier:  sprintMultiplier,
      tiebreaker_order:   tiebreakerOrder,
      double_points_races: [],
      extra_categories:   extraCategories,
    };
    const { data, error } = await supabase.from("leagues").insert({
      name:       leagueName,
      code,
      owner_id:   user.id,
      is_public:  leagueVisibility === "public",
      game_mode:  leagueGameMode,
      visibility: leagueVisibility,
      settings,
    }).select().single();
    if (error) {
      alert(error.message);
      return;
    }

    const { error: memberError } = await supabase.from("league_members").insert({ league_id: data.id, user_id: user.id });
    if (memberError) {
      alert(memberError.message);
      return;
    }
    setLeagueName("");
    setLeagueGameMode("standard");
    setLeagueVisibility("private");
    setShowCreateModal(false);
    setCreateStep(0);
    setScoringWeights({ pole: 10, winner: 25, p2: 18, p3: 15, fl: 7, dotd: 6, dnf: 12, ctor: 8 });
    setSprintMultiplier(0.5);
    setTiebreakerOrder(["most_correct", "best_single_race", "head_to_head", "earliest_joined"]);
    setExtraCategories([]);
    setCreateError("");
    await fetchLeagues();
    setSelectedLeagueId(data.id);
  }

  async function joinLeague() {
    if (demoPreview) return;
    if (!joinCode.trim() || !user) return;
    const session = await requireActiveSession();
    if (!session) return openAuth("login");

    const { data, error } = await supabase.from("leagues").select("*").eq("code", joinCode.toUpperCase()).single();
    if (error || !data) {
      alert("League not found.");
      return;
    }

    const { error: joinError } = await supabase.from("league_members").insert({ league_id: data.id, user_id: user.id });
    if (joinError) {
      alert("Already in this league or there was an error joining.");
      return;
    }

    setJoinCode("");
    await fetchLeagues();
    setSelectedLeagueId(data.id);
  }

  async function leaveLeague(leagueId) {
    if (demoPreview) return;
    if (!window.confirm("Leave this league?")) return;
    const session = await requireActiveSession();
    if (!session) return openAuth("login");

    const { error } = await supabase.from("league_members").delete().eq("league_id", leagueId).eq("user_id", user.id);
    if (error) {
      alert(error.message);
      return;
    }
    await fetchLeagues();
    setLeagueMessage("");
  }

  async function deleteLeague(leagueId) {
    if (demoPreview) return;
    if (!window.confirm("Delete this league permanently?")) return;
    const session = await requireActiveSession();
    if (!session) return openAuth("login");

    const { error } = await supabase.from("leagues").delete().eq("id", leagueId);
    if (error) {
      alert(error.message);
      return;
    }
    await fetchLeagues();
    setLeagueMessage("");
  }

  async function submitLeaguePost() {
    if (demoPreview) return;
    if (!leagueMessage.trim() || !user || !currentLeague) return;
    if (currentLeague.type === "pro_community" && user?.subscription_status !== "pro") {
      setPage?.("pro");
      return;
    }
    const session = await requireActiveSession();
    if (!session) return openAuth("login");

    const message = leagueMessage.trim();
    const { error } = await supabase.from("posts").insert({
      author_id: user.id,
      author_name: user.username,
      title: message.slice(0, 72),
      body: message,
      league_id: currentLeague.id,
    });

    if (error) {
      setLeagueForumReady((current) => ({ ...current, [currentLeague.id]: false }));
      alert("League forum needs the `league_id` column on posts before it can be used.");
      return;
    }

    setLeagueMessage("");
    fetchLeaguePosts(currentLeague.id);
  }

  function renderLeagueChat(items) {
    if (!items.length) {
      return (
        <div style={{ borderRadius: 18, border: PANEL_BORDER, background: PANEL_BG, padding: 28, textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 8 }}>No messages yet</div>
          <div style={{ fontSize: 13, color: MUTED_TEXT }}>Use the league chat to coordinate picks, share race takes and keep the group active through the weekend.</div>
        </div>
      );
    }

    return (
      <div style={{ display: "grid", gap: 10 }}>
        {[...items].reverse().map((post) => {
          const mine = post.author_id === user?.id;
          const authorProfile = authorProfiles[post.author_id];
          const themeKey = authorProfile?.avatar_color;
          const authorIsPro = isProProfile(authorProfile, post.author_name);
          const bubbleBg = mine ? "linear-gradient(180deg,rgba(255,255,255,0.03),#111c30)" : PANEL_BG_ALT;
          const bubbleBorder = mine ? "1px solid rgba(248,250,252,0.14)" : "1px solid rgba(148,163,184,0.12)";

          return (
            <div key={post.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
              <div
                style={{
                  width: isMobile ? "100%" : mine ? "min(100%, 88%)" : "100%",
                  borderRadius: 18,
                  border: bubbleBorder,
                  background: bubbleBg,
                  padding: "12px 13px 11px",
                }}
              >
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  {!mine && <AvatarChip name={post.author_name} colorKey={themeKey} size={30} radius={9} fontSize={10} pro={authorIsPro} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 5 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: mine ? "#fde68a" : "#fff" }}>{mine ? "You" : post.author_name}</div>
                      <div style={{ fontSize: 10, color: SUBTLE_TEXT }}>{formatStamp(post.created_at)}</div>
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.6, color: mine ? "#fff7ed" : MUTED_TEXT, whiteSpace: "pre-wrap" }}>{post.body}</div>
                  </div>
                  {mine && <AvatarChip name={post.author_name} colorKey={themeKey} size={30} radius={9} fontSize={10} pro={authorIsPro} />}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  const communityHero = tab === "leaderboard"
    ? {
        eyebrow: "Global leaderboard",
        titleLines: ["Every player.", "One table.", "Race by race."],
        description: "",
        stats: [
          [String(leaderboard.length || 0), "players"],
          [leaderboard[0]?.username || "none", "leader"],
          [loadingLB ? "loading" : "live", "status"],
        ],
      }
    : {
          eyebrow: "Leagues",
          titleLines: ["Build the room.", "Track the table.", "Own the weekend."],
          description: "",
          stats: [
            [String(privateLeagueCount + 1), "leagues"],
            [String(currentStandings.length || 0), "members"],
          [user ? "active" : demoPreview ? "preview" : "login", "status"],
        ],
      };
  const communityTabs = [["leagues", "Leagues"], ["leaderboard", "Global Leaderboard"], ["standings", "F1 Standings"]];
  const communityHeaderAside = (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 10 }}>
      {communityHero.stats.map(([value, label]) => (
        <div key={label} style={{ borderRadius: 18, border: label === "status" ? `1px solid ${ACCENT}33` : "1px solid rgba(148,163,184,0.14)", background: "rgba(255,255,255,0.02)", boxShadow: EDGE_RING, padding: "14px 15px 13px" }}>
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.8 }}>{value}</div>
          <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginTop: 4 }}>{label}</div>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ maxWidth: CONTENT_MAX, margin: "0 auto", padding: isMobile ? "28px 18px 72px" : isTablet ? "34px 22px 80px" : "38px 28px 84px", position: "relative", zIndex: 1 }}>
      <section style={{ marginBottom: 24 }}>
        <PageHeader
          eyebrow={communityHero.eyebrow}
          title={communityHero.titleLines.map((line, index) => (
            <span key={line}>
              {line}
              {index < communityHero.titleLines.length - 1 && <br />}
            </span>
          ))}
          description={communityHero.description || null}
          aside={communityHeaderAside}
          asideWidth={360}
          marginBottom={18}
          bgImage="/images/Grid lights.png"
        />

        <section style={{ borderRadius: 28, border: PANEL_BORDER, background: PANEL_BG, overflow: "hidden", boxShadow: SOFT_SHADOW }}>
          <div style={{ padding: "12px 24px", background: PANEL_BG, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {communityTabs.map(([value, label]) => (
              <button
                key={value}
                onClick={() => setTab(value)}
                style={{
                  background: tab === value ? "linear-gradient(180deg,rgba(255,255,255,0.1),#111c30)" : PANEL_BG_ALT,
                  border: tab === value ? "1px solid rgba(248,250,252,0.16)" : "1px solid rgba(148,163,184,0.12)",
                  borderRadius: 12,
                  color: tab === value ? "#fff" : MUTED_TEXT,
                  cursor: "pointer",
                  fontWeight: 800,
                  fontSize: 12,
                  padding: "9px 12px",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </section>
      </section>

      {tab === "leagues" && (
        user ? (
          <section style={{ display: "grid", gridTemplateColumns: isTablet ? "1fr" : "300px minmax(0,1fr)", gap: 18 }}>
            <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
              <div style={{ borderRadius: CARD_RADIUS, border: PANEL_BORDER, background: PANEL_BG, padding: 18, boxShadow: SOFT_SHADOW }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 12 }}>
                  Control rail
                </div>
                <div style={{ marginBottom: 14 }}>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    style={{ background: BRAND_GRADIENT, border: "none", borderRadius: 12, color: "#fff", cursor: "pointer", fontWeight: 800, width: "100%", padding: 12, fontSize: 13, marginBottom: 8 }}
                  >
                    + Create League
                  </button>
                </div>

                <div style={{ paddingTop: 14, borderTop: `1px solid ${HAIRLINE}` }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#fff", marginBottom: 8 }}>Join with code</div>
                  <input
                    style={{ ...inputStyle, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.22em", textAlign: "center", fontFamily: "monospace" }}
                    placeholder="XXXXXX"
                    value={joinCode}
                    onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                    onKeyDown={(event) => event.key === "Enter" && joinLeague()}
                    maxLength={6}
                  />
                  <button style={{ background: "#132038", border: "1px solid rgba(148,163,184,0.18)", borderRadius: 12, color: "#fff", cursor: "pointer", fontWeight: 800, width: "100%", padding: 12, fontSize: 13 }} onClick={joinLeague}>
                    Join league
                  </button>
                </div>
              </div>

              <div style={{ borderRadius: CARD_RADIUS, border: PANEL_BORDER, background: PANEL_BG, overflow: "hidden", boxShadow: SOFT_SHADOW }}>
                <div style={{ padding: "16px 18px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT }}>League rooms</div>
                  <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: -0.5, marginTop: 4 }}>{privateLeagueCount + 1}</div>
                </div>
                <div style={{ display: "grid", gap: 1, background: HAIRLINE }}>
                  {/* ── Pro Community League (pinned first) ── */}
                  {visibleProLeague && (() => {
                    const active = selectedLeagueId === visibleProLeague.id;
                    return (
                      <button
                        key="pro-community"
                        onClick={() => setSelectedLeagueId(visibleProLeague.id)}
                        style={{ textAlign: "left", border: "none", borderLeft: "3px solid rgba(245,158,11,0.65)", background: active ? "linear-gradient(180deg,rgba(245,158,11,0.16),#111c30)" : "linear-gradient(135deg,rgba(245,158,11,0.08),rgba(217,119,6,0.04),#0f1828)", padding: "13px 16px 13px 13px", cursor: "pointer" }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
                          <div style={{ fontSize: 13, fontWeight: 900, color: "#fef3c7", letterSpacing: -0.2 }}>{visibleProLeague.name || "Stint Pro Community"}</div>
                        </div>
                        <div style={{ marginTop: 8, fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#fbbf24" }}>
                          $500 season pool
                        </div>
                      </button>
                    );
                  })()}
                  {/* ── Private leagues ── */}
                  {leagues.length === 0 ? (
                    <div style={{ padding: "16px 18px", fontSize: 12, color: MUTED_TEXT, lineHeight: 1.6 }}>
                      Create or join a private league above to track standings with your group.
                    </div>
                  ) : (
                    leagues.map((league) => {
                      const active = league.id === selectedLeagueId;
                      return (
                        <button
                          key={league.id}
                          onClick={() => setSelectedLeagueId(league.id)}
                          style={{ textAlign: "left", border: "none", background: active ? "linear-gradient(180deg,var(--team-accent-ghost),#111c30)" : PANEL_BG, padding: "14px 16px", cursor: "pointer" }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 4 }}>
                            <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>{league.name}</div>
                            <div style={{ fontSize: 11, fontWeight: 900, color: "#cbd5e1", letterSpacing: "0.16em", fontFamily: "monospace" }}>{league.code}</div>
                          </div>
                          <div style={{ fontSize: 11, color: active ? "rgba(226,232,240,0.74)" : SUBTLE_TEXT }}>
                            {league.owner_id === user.id ? "League owner" : "Member"}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div>
              {currentLeague && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  {isMobile ? (
                    <button
                      onClick={() => setSelectedLeagueId(null)}
                      style={{ background: "none", border: "none", color: SUBTLE_TEXT, cursor: "pointer", fontWeight: 800, fontSize: 11, letterSpacing: "0.08em", padding: 0, display: "flex", alignItems: "center", gap: 5 }}
                    >
                      ← Back
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => setSelectedLeagueId(null)}
                        style={{ background: "none", border: "none", color: SUBTLE_TEXT, cursor: "pointer", fontWeight: 800, fontSize: 11, letterSpacing: "0.08em", padding: 0 }}
                      >
                        Leagues
                      </button>
                      <span style={{ color: ACCENT }}>›</span>
                      <button
                        onClick={() => setLeagueView("standings")}
                        style={{ background: "none", border: "none", color: leagueView === "standings" ? "rgba(214,223,239,0.62)" : SUBTLE_TEXT, cursor: leagueView === "standings" ? "default" : "pointer", fontWeight: 800, fontSize: 11, letterSpacing: "0.08em", padding: 0 }}
                        disabled={leagueView === "standings"}
                      >
                        {currentLeague.name}
                      </button>
                      <span style={{ color: ACCENT }}>›</span>
                      <span style={{ color: "rgba(214,223,239,0.62)" }}>
                        {LEAGUE_VIEW_LABELS[leagueView] || leagueView}
                      </span>
                    </>
                  )}
                </div>
              )}
              {currentLeague ? (
                <>
                  <div style={{ borderRadius: SECTION_RADIUS, border: currentLeague.type === "pro_community" ? "1px solid rgba(245,158,11,0.22)" : PANEL_BORDER, background: PANEL_BG, overflow: "hidden", marginBottom: 16, boxShadow: SOFT_SHADOW }}>
                    <div style={{ height: 3, background: currentLeague.type === "pro_community" ? "linear-gradient(90deg,#f59e0b,#d97706,#92400e)" : BRAND_GRADIENT }} />
                    <div style={{ padding: "20px 22px 18px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 6 }}>
                            Selected league
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                            <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: -1 }}>{currentLeague.name}</div>
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {currentLeague.type !== "pro_community" && (
                            <>
                            <button onClick={() => navigator.clipboard?.writeText(currentLeague.code)} style={{ background: PANEL_BG_ALT, border: "1px solid rgba(148,163,184,0.14)", borderRadius: 12, color: "#dbe4f0", cursor: "pointer", fontWeight: 700, padding: "10px 12px", fontSize: 12 }}>
                              Code {currentLeague.code}
                            </button>
                            {currentLeague.owner_id === user.id ? (
                              <button onClick={() => deleteLeague(currentLeague.id)} style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.26)", borderRadius: 12, color: "#fca5a5", cursor: "pointer", fontWeight: 700, padding: "10px 12px", fontSize: 12 }}>
                                Delete league
                              </button>
                            ) : (
                              <button onClick={() => leaveLeague(currentLeague.id)} style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.26)", borderRadius: 12, color: "#fca5a5", cursor: "pointer", fontWeight: 700, padding: "10px 12px", fontSize: 12 }}>
                                Leave league
                              </button>
                            )}
                            </>
                          )}
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,minmax(0,1fr))" : "repeat(4,minmax(0,1fr))", gap: 10 }}>
                        {currentLeague.type === "pro_community" ? (
                          <>
                            <StatCard label="Competitors" value={String(currentStandings.length || 0)} accent="#fef3c7" />
                            <StatCard label="Leader" value={leagueSummary.leader?.username || "No one"} accent="#fde68a" />
                            <StatCard label="Prize pool" value="$500" accent="#f59e0b" />
                            <StatCard label="Access" value={isProUser ? "Competing" : "Viewing"} accent={isProUser ? "#86efac" : "#bfdbfe"} />
                          </>
                        ) : (
                          <>
                            <StatCard label="Members" value={String(currentStandings.length || 0)} accent="#dbe4f0" />
                            <StatCard label="Leader" value={leagueSummary.leader?.username || "No one"} accent="#cbd5e1" />
                            <StatCard label="Average" value={`${leagueSummary.average} pts`} accent="#bfdbfe" />
                            <StatCard label="Next race" value={next?.n || "TBA"} accent="#cbd5e1" />
                          </>
                        )}
                      </div>

                      {currentLeague.type === "pro_community" && (
                        <div style={{ marginTop: 14, borderRadius: 18, border: "1px solid rgba(245,158,11,0.18)", background: "linear-gradient(135deg,rgba(245,158,11,0.08),rgba(15,24,44,0.95))", padding: "14px 15px 13px" }}>
                          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fbbf24", marginBottom: 10 }}>Season prizes</div>
                          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,minmax(0,1fr))", gap: 10 }}>
                            {PRO_LEAGUE_PRIZES.map((prize) => (
                              <div key={prize.label} style={{ borderRadius: 14, border: "1px solid rgba(245,158,11,0.16)", background: "rgba(10,16,30,0.52)", padding: "12px 13px 11px" }}>
                                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 6 }}>{prize.label}</div>
                                <div style={{ fontSize: 15, fontWeight: 900, lineHeight: 1.4, color: prize.accent }}>{prize.value}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
                        {[["standings", "Standings"], ["review", "Round Review"], ["chat", "Chat"], ["setup", "Rules"]].map(([value, label]) => (
                          <button
                            key={value}
                            onClick={() => setLeagueView(value)}
                            style={{
                              background: leagueView === value ? "linear-gradient(180deg,rgba(255,255,255,0.06),rgba(15,24,44,0.96))" : PANEL_BG_ALT,
                              border: leagueView === value ? "1px solid rgba(248,250,252,0.14)" : "1px solid rgba(148,163,184,0.14)",
                              borderRadius: 999,
                              color: leagueView === value ? "#fff" : MUTED_TEXT,
                              cursor: "pointer",
                              padding: "8px 12px",
                              fontSize: 11,
                              fontWeight: 800,
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {leagueView === "standings" && (
                    <div style={{ display: "grid", gap: 16 }}>
                      <div style={{ borderRadius: CARD_RADIUS, border: PANEL_BORDER, background: PANEL_BG, overflow: "hidden", boxShadow: SOFT_SHADOW }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "16px 18px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT, flexWrap: "wrap", minHeight: 80, boxSizing: "border-box" }}>
                          <div>
                            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT }}>League standings</div>
                            <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: -0.5, marginTop: 4 }}>Race for the top spot</div>
                          </div>
                          <div style={{ fontSize: 12, color: MUTED_TEXT }}>
                            Leader gap: <span style={{ color: "#fff", fontWeight: 800 }}>{leagueSummary.gap} pts</span>
                          </div>
                        </div>

                        {leagueStandings[currentLeague.id] === undefined ? (
                          <div style={{ padding: 28, color: MUTED_TEXT }}>Loading league standings...</div>
                        ) : currentStandings.length === 0 ? (
                          <div style={{ padding: 28, color: MUTED_TEXT }}>No members found in this league yet.</div>
                        ) : (
                          <div style={{ display: "grid", gap: 1, background: HAIRLINE, maxHeight: isTablet ? 640 : 720, overflowY: "auto" }}>
                            {currentStandings.map((member, index) => (
                              <div key={member.id} style={{ display: "grid", gridTemplateColumns: "56px minmax(0,1fr) 96px", gap: 0, background: PANEL_BG }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900, color: index === 0 ? "#e2e8f0" : index === 1 ? "#cbd5e1" : index === 2 ? "#94a3b8" : SUBTLE_TEXT }}>
                                  {index + 1}
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 12px" }}>
                                  <AvatarChip name={member.username} colorKey={member.avatar_color} pro={isProProfile(member)} />
                                    <div>
                                      <div style={{ fontSize: 13, fontWeight: 800 }}>{member.username}</div>
                                      <div style={{ fontSize: 11, color: MUTED_TEXT }}>
                                        {currentLeague.type === "pro_community"
                                          ? index === 0
                                            ? "Current leader · championship pace"
                                            : index === 1
                                              ? "Podium position"
                                              : index === 2
                                                ? "Prize bracket"
                                                : "Pro league driver"
                                          : index === 0
                                            ? "Current league leader"
                                            : "League member"}
                                      </div>
                                    </div>
                                  </div>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 900, color: "#fff" }}>
                                  {member.points || 0}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {leagueView === "review" && (
                    <div style={{ display: "grid", gap: 16 }}>
                      <div style={{ borderRadius: CARD_RADIUS, border: PANEL_BORDER, background: PANEL_BG, overflow: "hidden", boxShadow: SOFT_SHADOW }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "16px 18px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT, flexWrap: "wrap", minHeight: 80, boxSizing: "border-box" }}>
                          <div>
                            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT }}>League round review</div>
                            <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: -0.5, marginTop: 4 }}>
                              {selectedLeagueRoundMeta?.n || (leagueReviewRound ? `Round ${leagueReviewRound}` : "Scored rounds")}
                            </div>
                            <div style={{ fontSize: 12, color: MUTED_TEXT, marginTop: 6 }}>
                              Compare how everyone in the league scored once a Grand Prix has been processed.
                            </div>
                          </div>

                          <div style={{ minWidth: isMobile ? "100%" : 240 }}>
                            <select
                              value={leagueReviewRound || ""}
                              onChange={(event) => setLeagueReviewRound(Number(event.target.value))}
                              style={inputStyle}
                            >
                              {scoredRounds.length === 0 ? (
                                <option value="">No scored rounds yet</option>
                              ) : (
                                scoredRounds.map((round) => {
                                  const meta = roundMeta(round.race_round);
                                  return (
                                    <option key={round.race_round} value={round.race_round}>
                                      {meta?.n || `Round ${round.race_round}`}
                                    </option>
                                  );
                                })
                              )}
                            </select>
                          </div>
                        </div>

                        {currentLeagueRoundResult && (
                          <div style={{ padding: 16, display: "grid", gridTemplateColumns: isTablet ? "repeat(2,minmax(0,1fr))" : "repeat(4,minmax(0,1fr))", gap: 10 }}>
                            {[
                              ["Winner", currentLeagueRoundResult.winner || "Pending"],
                              ["Pole", currentLeagueRoundResult.pole || "Pending"],
                              ["Driver of the Day", currentLeagueRoundResult.dotd || "Pending"],
                              ["Best Constructor", currentLeagueRoundResult.best_constructor || "Pending"],
                            ].map(([label, value]) => (
                              <div key={label} style={{ borderRadius: 16, border: "1px solid rgba(148,163,184,0.12)", background: PANEL_BG_ALT, padding: "14px 15px 13px" }}>
                                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 7 }}>{label}</div>
                                <div style={{ fontSize: 15, fontWeight: 900, lineHeight: 1.35 }}>{value}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {scoredRounds.length === 0 ? (
                        <div style={{ borderRadius: CARD_RADIUS, border: PANEL_BORDER, background: PANEL_BG, padding: 26, color: MUTED_TEXT, boxShadow: SOFT_SHADOW }}>
                          Once a round has official results and scoring is complete, the full league recap will appear here.
                        </div>
                      ) : currentLeagueReview?.loading ? (
                        <div style={{ borderRadius: CARD_RADIUS, border: PANEL_BORDER, background: PANEL_BG, padding: 26, color: MUTED_TEXT, boxShadow: SOFT_SHADOW }}>
                          Loading league round review...
                        </div>
                      ) : currentLeagueReview?.error ? (
                        <div style={{ borderRadius: CARD_RADIUS, border: "1px solid rgba(239,68,68,0.18)", background: PANEL_BG, padding: 26, color: MUTED_TEXT, boxShadow: SOFT_SHADOW }}>
                          <div style={{ fontSize: 16, fontWeight: 900, color: "#fca5a5", marginBottom: 6 }}>League review could not load</div>
                          <div style={{ fontSize: 13, lineHeight: 1.7 }}>
                            {currentLeagueReview.error}. If this is a permissions error, the `predictions` table still needs a league review select policy.
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: "grid", gridTemplateColumns: isTablet ? "1fr" : "repeat(2,minmax(0,1fr))", gap: 16 }}>
                          {(currentLeagueReview?.members || []).map((entry, index) => {
                            const scoredItems = [...entry.raceRows, ...entry.sprintRows].filter((row) => row.hit && row.points > 0);
                            const bonusPoints = bonusPointsFromBreakdown(entry.breakdown);
                            const bonusItem = bonusPoints ? { label: "Perfect Podium Bonus", pts: bonusPoints } : null;
                            const updatedLabel = entry.prediction?.updated_at ? formatStamp(entry.prediction.updated_at) : "";

                            return (
                              <div key={entry.member.id} style={{ borderRadius: CARD_RADIUS, border: PANEL_BORDER, background: PANEL_BG, overflow: "hidden", boxShadow: SOFT_SHADOW }}>
                                <div style={{ padding: "16px 18px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                                    <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
                                      <AvatarChip name={entry.member.username} colorKey={entry.member.avatar_color} size={36} radius={11} fontSize={12} pro={isProProfile(entry.member)} />
                                      <div style={{ minWidth: 0 }}>
                                        <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 4 }}>{entry.member.username}</div>
                                        <div style={{ fontSize: 11, color: MUTED_TEXT }}>
                                          #{index + 1} this round · {entry.member.points || 0} season pts
                                        </div>
                                      </div>
                                    </div>

                                    <div style={{ textAlign: "right" }}>
                                      <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: -0.8 }}>{entry.roundScore} pts</div>
                                      <div style={{ fontSize: 11, color: MUTED_TEXT }}>{entry.correctCalls} correct calls</div>
                                    </div>
                                  </div>
                                </div>

                                <div style={{ padding: 16, display: "grid", gap: 14 }}>
                                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 10 }}>
                                    <StatCard label="Round score" value={`${entry.roundScore}`} accent="#facc15" />
                                    <StatCard label="Hits" value={String(entry.correctCalls)} accent="#86efac" />
                                    <StatCard label="Saved" value={entry.prediction ? "Yes" : "No"} accent="#cbd5e1" />
                                  </div>

                                  {entry.prediction ? (
                                    <>
                                      <div>
                                        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 8 }}>Scored hits</div>
                                        {scoredItems.length || bonusItem ? (
                                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                            {scoredItems.map((item) => (
                                              <span key={`${entry.member.id}-${item.label}`} style={{ borderRadius: 999, padding: "6px 10px", fontSize: 11, fontWeight: 800, background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.22)", color: "#bbf7d0" }}>
                                                {item.label} +{item.pts}
                                              </span>
                                            ))}
                                            {bonusItem && (
                                              <span style={{ borderRadius: 999, padding: "6px 10px", fontSize: 11, fontWeight: 800, background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.22)", color: "#bfdbfe" }}>
                                                {bonusItem.label} +{bonusItem.pts}
                                              </span>
                                            )}
                                          </div>
                                        ) : (
                                          <div style={{ fontSize: 12, color: MUTED_TEXT }}>No categories landed this round.</div>
                                        )}
                                      </div>

                                      <div style={{ borderRadius: 16, border: "1px solid rgba(148,163,184,0.12)", overflow: "hidden" }}>
                                        <div style={{ padding: "12px 14px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT }}>
                                          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT }}>Race board</div>
                                        </div>
                                        {(entry.raceRows.length ? entry.raceRows : LEAGUE_RACE_REVIEW_PROMPTS.map((prompt) => ({ key: prompt.key, label: prompt.label, pick: null, actual: resultValueForKey(currentLeagueRoundResult, prompt.key), hit: false, points: 0 })) ).map((row, rowIndex, source) => (
                                          <div key={`${entry.member.id}-${row.key}`} style={{ display: "grid", gridTemplateColumns: isMobile ? "minmax(0,1fr) 74px" : "minmax(140px,1fr) minmax(0,1fr) minmax(0,1fr) 74px", gap: 10, alignItems: "center", padding: "11px 14px", borderBottom: rowIndex < source.length - 1 ? `1px solid ${HAIRLINE}` : "none", background: rowIndex % 2 === 0 ? PANEL_BG : PANEL_BG_ALT }}>
                                            <div>
                                              <div style={{ fontSize: 12, fontWeight: 800 }}>{row.label}</div>
                                              {isMobile ? (
                                                <div style={{ marginTop: 4, display: "grid", gap: 2, fontSize: 11, color: MUTED_TEXT }}>
                                                  <div>Pick: <span style={{ color: "#fff" }}>{row.pick || "No pick"}</span></div>
                                                  <div>Result: <span style={{ color: "#fff" }}>{row.actual || "Pending"}</span></div>
                                                </div>
                                              ) : null}
                                            </div>
                                            {!isMobile ? <div style={{ fontSize: 12, color: row.pick ? "#fff" : MUTED_TEXT }}>{row.pick || "No pick"}</div> : null}
                                            {!isMobile ? <div style={{ fontSize: 12, color: row.actual ? "#fff" : MUTED_TEXT }}>{row.actual || "Pending"}</div> : null}
                                            <div style={{ textAlign: "right", fontSize: 14, fontWeight: 900, color: row.hit ? "#facc15" : SUBTLE_TEXT }}>
                                              {row.hit ? `+${row.points}` : "0"}
                                            </div>
                                          </div>
                                        ))}
                                      </div>

                                      {entry.sprintRows.length > 0 && (
                                        <div style={{ borderRadius: 16, border: "1px solid rgba(148,163,184,0.12)", overflow: "hidden" }}>
                                          <div style={{ padding: "12px 14px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT }}>
                                            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT }}>Sprint board</div>
                                          </div>
                                          {entry.sprintRows.map((row, rowIndex) => (
                                            <div key={`${entry.member.id}-${row.key}`} style={{ display: "grid", gridTemplateColumns: isMobile ? "minmax(0,1fr) 74px" : "minmax(140px,1fr) minmax(0,1fr) minmax(0,1fr) 74px", gap: 10, alignItems: "center", padding: "11px 14px", borderBottom: rowIndex < entry.sprintRows.length - 1 ? `1px solid ${HAIRLINE}` : "none", background: rowIndex % 2 === 0 ? PANEL_BG : PANEL_BG_ALT }}>
                                              <div>
                                                <div style={{ fontSize: 12, fontWeight: 800 }}>{row.label}</div>
                                                {isMobile ? (
                                                  <div style={{ marginTop: 4, display: "grid", gap: 2, fontSize: 11, color: MUTED_TEXT }}>
                                                    <div>Pick: <span style={{ color: "#fff" }}>{row.pick || "No pick"}</span></div>
                                                    <div>Result: <span style={{ color: "#fff" }}>{row.actual || "Pending"}</span></div>
                                                  </div>
                                                ) : null}
                                              </div>
                                              {!isMobile ? <div style={{ fontSize: 12, color: row.pick ? "#fff" : MUTED_TEXT }}>{row.pick || "No pick"}</div> : null}
                                              {!isMobile ? <div style={{ fontSize: 12, color: row.actual ? "#fff" : MUTED_TEXT }}>{row.actual || "Pending"}</div> : null}
                                              <div style={{ textAlign: "right", fontSize: 14, fontWeight: 900, color: row.hit ? "#facc15" : SUBTLE_TEXT }}>
                                                {row.hit ? `+${row.points}` : "0"}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}

                                      <div style={{ fontSize: 11, color: MUTED_TEXT }}>
                                        {updatedLabel ? `Saved ${updatedLabel}` : "Saved board"}
                                      </div>
                                    </>
                                  ) : (
                                    <div style={{ borderRadius: 16, border: "1px solid rgba(148,163,184,0.12)", background: PANEL_BG_ALT, padding: 16, fontSize: 12, lineHeight: 1.7, color: MUTED_TEXT }}>
                                      No saved board for this round.
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {leagueView === "chat" && (
                    <div style={{ borderRadius: CARD_RADIUS, border: PANEL_BORDER, background: PANEL_BG, overflow: "hidden", boxShadow: SOFT_SHADOW }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "16px 18px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT, flexWrap: "wrap", minHeight: 80, boxSizing: "border-box" }}>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT }}>
                            {currentLeague.type === "pro_community" ? "League forum" : "League chat"}
                          </div>
                          <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: -0.5, marginTop: 4 }}>
                            {currentLeague.type === "pro_community" ? "Pro race room" : "Private race room"}
                          </div>
                        </div>
                      </div>

                      <div style={{ padding: 16 }}>
                        {leagueForumReady[currentLeague.id] === false ? (
                          <div style={{ borderRadius: 16, border: "1px solid rgba(148,163,184,0.12)", background: PANEL_BG_ALT, padding: 16 }}>
                            <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 6 }}>League chat backend missing</div>
                            <div style={{ fontSize: 12, lineHeight: 1.65, color: MUTED_TEXT }}>
                              This layout is ready for private league discussions, but the database still needs a `league_id` column on `posts` so each league can have its own forum feed.
                            </div>
                          </div>
                        ) : (
                          <>
                            {canPostInCurrentLeague ? (
                              <div style={{ borderRadius: 16, border: "1px solid rgba(148,163,184,0.14)", background: PANEL_BG_ALT, padding: 14, marginBottom: 14, boxShadow: EDGE_RING }}>
                                <textarea
                                  style={{ ...inputStyle, minHeight: 84, resize: "vertical", marginBottom: 10 }}
                                  placeholder={currentLeague.type === "pro_community" ? "Drop a note into the Pro room..." : "Drop a message for your league..."}
                                  value={leagueMessage}
                                  onChange={(event) => setLeagueMessage(event.target.value)}
                                />
                                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                                  <button onClick={submitLeaguePost} style={{ background: BRAND_GRADIENT, border: "none", borderRadius: 12, color: "#fff", cursor: "pointer", fontWeight: 800, padding: "10px 14px", fontSize: 12 }}>
                                    Send
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div style={{ borderRadius: 16, border: "1px solid rgba(245,158,11,0.18)", background: "linear-gradient(135deg,rgba(245,158,11,0.08),rgba(15,24,44,0.96))", padding: 14, marginBottom: 14 }}>
                                <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 12, color: "#fef3c7" }}>Viewer mode</div>
                                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                                  <button
                                    onClick={() => setPage?.("pro")}
                                    style={{ background: BRAND_GRADIENT, border: "none", borderRadius: 12, color: "#fff", cursor: "pointer", fontWeight: 800, padding: "10px 14px", fontSize: 12 }}
                                  >
                                    Join Pro
                                  </button>
                                  {!user && (
                                    <button
                                      onClick={() => openAuth("login", { page: "community" })}
                                      style={{ background: PANEL_BG_ALT, border: "1px solid rgba(148,163,184,0.18)", borderRadius: 12, color: "#fff", cursor: "pointer", fontWeight: 800, padding: "10px 14px", fontSize: 12 }}
                                    >
                                      Login
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                            <div
                              style={{
                                maxHeight: isMobile ? 360 : 520,
                                overflowY: "auto",
                                paddingRight: 4,
                              }}
                            >
                              {renderLeagueChat(currentLeaguePosts)}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {leagueView === "setup" && (() => {
                    const setupCards = [
                      {
                        label: "Format",
                        value: LEAGUE_MODE_LABELS[currentLeague.game_mode] || "Custom",
                        accent: "#fbbf24",
                      },
                      {
                        label: "Access",
                        value: currentLeague.type === "pro_community"
                          ? "Public board"
                          : LEAGUE_VISIBILITY_LABELS[currentLeague.visibility || (currentLeague.is_public ? "public" : "private")] || "Private",
                        accent: "#93c5fd",
                      },
                      {
                        label: "Sprint",
                        value: `${currentLeagueSprintMultiplier}×`,
                        accent: "#f97316",
                      },
                    ];

                    const scoringTones = [
                      {
                        accent: "#fdba74",
                        background: "linear-gradient(135deg,rgba(255,106,26,0.12),rgba(255,194,71,0.04),rgba(21,35,56,0.95))",
                        border: "1px solid rgba(255,171,93,0.18)",
                      },
                      {
                        accent: "#93c5fd",
                        background: "linear-gradient(135deg,rgba(59,130,246,0.12),rgba(56,189,248,0.04),rgba(21,35,56,0.95))",
                        border: "1px solid rgba(147,197,253,0.18)",
                      },
                    ];

                    return (
                      <div style={{ display: "grid", gap: 16 }}>
                        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,minmax(0,1fr))", gap: 12 }}>
                          {setupCards.map((card) => (
                            <div key={card.label} style={{ borderRadius: 16, border: "1px solid rgba(148,163,184,0.14)", background: PANEL_BG, padding: "14px 15px 13px", boxShadow: SOFT_SHADOW }}>
                              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: card.accent, marginBottom: 6 }}>{card.label}</div>
                              <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: -0.4 }}>{card.value}</div>
                            </div>
                          ))}
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: isTablet ? "1fr" : "minmax(0,1.18fr) minmax(280px,0.82fr)", gap: 16 }}>
                          <div style={{ borderRadius: CARD_RADIUS, border: "1px solid rgba(255,106,26,0.14)", background: "linear-gradient(160deg,rgba(255,106,26,0.06),rgba(59,130,246,0.04),rgba(15,24,44,0.96) 72%)", overflow: "hidden", boxShadow: SOFT_SHADOW }}>
                            <div style={{ padding: "16px 18px", borderBottom: `1px solid ${HAIRLINE}`, background: "rgba(15,24,44,0.4)", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap", minHeight: 80, boxSizing: "border-box" }}>
                              <div>
                                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: ACCENT, marginBottom: 4 }}>Scoring board</div>
                                <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: -0.5 }}>Points by category</div>
                              </div>
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                <span style={{ fontSize: 10, fontWeight: 800, color: "#fbbf24", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.18)", borderRadius: 999, padding: "5px 9px" }}>
                                  Sprint {currentLeagueSprintMultiplier}×
                                </span>
                                <span style={{ fontSize: 10, fontWeight: 800, color: currentLeagueDoublePointsRaces ? "#fde68a" : MUTED_TEXT, background: currentLeagueDoublePointsRaces ? "rgba(245,158,11,0.12)" : "rgba(148,163,184,0.08)", border: currentLeagueDoublePointsRaces ? "1px solid rgba(245,158,11,0.22)" : "1px solid rgba(148,163,184,0.14)", borderRadius: 999, padding: "5px 9px" }}>
                                  {currentLeagueDoublePointsRaces ? `${currentLeagueDoublePointsRaces} double-point rounds` : "No double-point rounds"}
                                </span>
                              </div>
                            </div>
                            <div style={{ padding: 16, display: "grid", gridTemplateColumns: isMobile ? "repeat(2,minmax(0,1fr))" : "repeat(4,minmax(0,1fr))", gap: 9 }}>
                              {LEAGUE_SCORING_FIELDS.map(({ key, label }, index) => {
                                const tone = scoringTones[index % scoringTones.length];
                                return (
                                  <div key={key} style={{ borderRadius: 16, border: tone.border, background: tone.background, padding: "12px 12px 11px" }}>
                                    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: tone.accent, marginBottom: 6 }}>{label}</div>
                                    <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: -0.6, color: "#fff" }}>{Number(currentLeagueScoring[key] || 0)}</div>
                                    <div style={{ fontSize: 11, color: "rgba(214,223,239,0.66)", marginTop: 4 }}>points</div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
                            <div style={{ borderRadius: CARD_RADIUS, border: "1px solid rgba(96,165,250,0.14)", background: "linear-gradient(160deg,rgba(59,130,246,0.05),rgba(255,106,26,0.04),rgba(15,24,44,0.96) 72%)", overflow: "hidden", boxShadow: SOFT_SHADOW }}>
                              <div style={{ padding: "16px 18px", borderBottom: `1px solid ${HAIRLINE}`, background: "rgba(15,24,44,0.38)" }}>
                                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#93c5fd", marginBottom: 4 }}>Tie-break ladder</div>
                                <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: -0.5 }}>If scores end level</div>
                              </div>
                              <div style={{ padding: 14, display: "grid", gap: 8 }}>
                                {currentLeagueTiebreakers.map((key, index) => (
                                  <div key={key} style={{ display: "grid", gridTemplateColumns: "28px minmax(0,1fr)", gap: 10, alignItems: "center", borderRadius: 14, border: "1px solid rgba(96,165,250,0.16)", background: "rgba(8,20,32,0.48)", padding: "10px 12px" }}>
                                    <div style={{ width: 28, height: 28, borderRadius: 999, background: "linear-gradient(180deg,rgba(59,130,246,0.22),rgba(255,106,26,0.16))", border: "1px solid rgba(96,165,250,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900, color: "#fff" }}>
                                      {index + 1}
                                    </div>
                                    <div style={{ fontSize: 12, fontWeight: 800 }}>{LEAGUE_TIEBREAKER_LABELS[key] || key}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </>
              ) : (
                <div style={{ borderRadius: SECTION_RADIUS, border: PANEL_BORDER, background: PANEL_BG, padding: 28, boxShadow: SOFT_SHADOW }}>
                  <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.8, marginBottom: 8 }}>No league selected</div>
                  <div style={{ fontSize: 13, lineHeight: 1.65, color: MUTED_TEXT }}>
                    Create a new league or join with a code to open a dedicated standings and discussion space.
                  </div>
                </div>
              )}
            </div>
          </section>
        ) : (
          <div style={{ borderRadius: SECTION_RADIUS, border: "1px solid rgba(245,158,11,0.18)", background: "linear-gradient(160deg,rgba(245,158,11,0.06),#0f1828 52%)", padding: 28, boxShadow: SOFT_SHADOW }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 18, flexWrap: "wrap", marginBottom: 18 }}>
              <div style={{ maxWidth: 640 }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 999, background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.2)", marginBottom: 12 }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#f59e0b" }} />
                  <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", color: "#fbbf24" }}>Pro League Preview</span>
                </div>
                <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: -0.8, marginBottom: 8 }}>{visibleProLeague?.name || "Stint Pro Community"}</div>
                <div style={{ fontSize: 13, lineHeight: 1.72, color: MUTED_TEXT, marginBottom: 12 }}>
                  Everyone can browse the flagship season board from the Leagues tab. Pro members are entered automatically, compete for prizes, and unlock the live forum.
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    onClick={() => {
                      if (demoPreview) {
                        const url = new URL(window.location.href);
                        url.searchParams.delete("demo");
                        url.searchParams.set("page", "community");
                        window.location.href = url.toString();
                        return;
                      }
                      openAuth("login", { page: "community" });
                    }}
                    style={{ background: BRAND_GRADIENT, border: "none", borderRadius: 12, color: "#fff", cursor: "pointer", fontWeight: 800, padding: "12px 14px", fontSize: 13 }}
                  >
                    {demoPreview ? "Login to explore" : "Login"}
                  </button>
                  <button onClick={() => setPage?.("pro")} style={{ background: PANEL_BG_ALT, border: "1px solid rgba(148,163,184,0.18)", borderRadius: 12, color: "#fff", cursor: "pointer", fontWeight: 800, padding: "12px 14px", fontSize: 13 }}>
                    Join Pro
                  </button>
                  <button onClick={() => setTab("leaderboard")} style={{ background: "transparent", border: "1px solid rgba(148,163,184,0.18)", borderRadius: 12, color: MUTED_TEXT, cursor: "pointer", fontWeight: 800, padding: "12px 14px", fontSize: 13 }}>
                    Open Global Leaderboard
                  </button>
                </div>
              </div>

              <div style={{ minWidth: isMobile ? "100%" : 320, flex: "1 1 320px", borderRadius: 18, border: "1px solid rgba(245,158,11,0.16)", background: "rgba(10,16,30,0.56)", overflow: "hidden" }}>
                <div style={{ padding: "14px 16px", borderBottom: `1px solid ${HAIRLINE}`, background: "rgba(255,255,255,0.02)" }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT }}>Top drivers</div>
                  <div style={{ fontSize: 18, fontWeight: 900, marginTop: 4 }}>Live season preview</div>
                </div>
                <div style={{ display: "grid", gap: 1, background: HAIRLINE }}>
                  {mockProStandings.slice(0, 5).map((member, index) => (
                    <div key={member.id} style={{ display: "grid", gridTemplateColumns: "52px minmax(0,1fr) 86px", background: PANEL_BG }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900, color: index === 0 ? "#f59e0b" : SUBTLE_TEXT }}>{index + 1}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px" }}>
                        <AvatarChip name={member.username} colorKey={member.avatar_color} pro={isProProfile(member)} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 800 }}>{member.username}</div>
                          <div style={{ fontSize: 11, color: MUTED_TEXT }}>{index === 0 ? "Championship pace" : "Pro league driver"}</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 900 }}>{member.points || 0}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )
      )}

      {tab === "leaderboard" && (
        <section style={{ borderRadius: SECTION_RADIUS, border: PANEL_BORDER, background: PANEL_BG, overflow: "hidden", boxShadow: SOFT_SHADOW }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "16px 18px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT }}>Global leaderboard</div>
              <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: -0.5, marginTop: 4 }}>Top players</div>
            </div>
          </div>

          {loadingLB ? (
            <div style={{ padding: 30, color: MUTED_TEXT }}>Loading leaderboard...</div>
          ) : leaderboard.length === 0 ? (
            <div style={{ padding: 30, color: MUTED_TEXT }}>No players yet.</div>
          ) : (
            <div style={{ display: "grid", gap: 1, background: HAIRLINE, maxHeight: 620, overflowY: "auto" }}>
              {leaderboard.map((player, index) => (
                <div key={player.id || player.username} style={{ display: "grid", gridTemplateColumns: "56px minmax(0,1fr) 110px", background: PANEL_BG }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900, color: index === 0 ? "#f97316" : index === 1 ? "#cbd5e1" : index === 2 ? "#facc15" : SUBTLE_TEXT }}>
                    {index + 1}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px" }}>
                    <AvatarChip name={player.username} colorKey={player.avatar_color} pro={isProProfile(player)} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800 }}>{player.username}</div>
                      <div style={{ fontSize: 11, color: MUTED_TEXT }}>{index === 0 ? "Overall leader" : "Active player"}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 900 }}>{player.points || 0}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "standings" && (
        <StandingsPage compact />
      )}

      {/* ── Create League Modal ── */}
      {showCreateModal && (() => {
        const isPro = user?.subscription_status === "pro";
        const MODES = [
          { key: "standard",     label: "Standard",     pro: false, desc: "Classic pick-em every race weekend." },
          { key: "survival",     label: "Survival",     pro: true,  desc: "Lowest scorer is eliminated each round." },
          { key: "draft",        label: "Draft",        pro: true,  desc: "Snake-draft your drivers at season start." },
          { key: "double_down",  label: "Double Down",  pro: true,  desc: "Triple one pick per race — or lose points." },
          { key: "head_to_head", label: "Head-to-Head", pro: true,  desc: "Bracket: beat your opponent each weekend." },
          { key: "budget_picks", label: "Budget Picks", pro: true,  desc: "50 credits per race, bet on your picks." },
        ];
        const SCORING_FIELDS = [
          { key: "pole",   label: "Pole" },
          { key: "winner", label: "Winner" },
          { key: "p2",     label: "P2" },
          { key: "p3",     label: "P3" },
          { key: "fl",     label: "Fastest Lap" },
          { key: "dotd",   label: "DOTD" },
          { key: "dnf",    label: "DNF" },
          { key: "ctor",   label: "Constructor" },
        ];
        const TIEBREAKER_LABELS = {
          most_correct:    "Most correct picks",
          best_single_race: "Best single race",
          head_to_head:    "Head-to-head record",
          earliest_joined: "Earliest to join",
        };

        return (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(2,6,23,0.88)",
              backdropFilter: "blur(12px)",
              zIndex: 200,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "20px 16px",
            }}
            onClick={(e) => { if (e.target === e.currentTarget) { setShowCreateModal(false); setCreateError(""); setCreateStep(0); } }}
          >
            <div
              style={{
                background: "linear-gradient(180deg,rgba(16,26,46,0.99),rgba(10,18,34,0.99))",
                border: "1px solid rgba(255,106,26,0.18)",
                borderRadius: 28,
                width: "100%",
                maxWidth: 520,
                boxShadow: "0 60px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.03), inset 0 1px 0 rgba(255,255,255,0.04)",
                overflow: "hidden",
                maxHeight: "90vh",
                overflowY: "auto",
              }}
            >
              {/* Header */}
              <div
                style={{
                  padding: "28px 28px 24px",
                  background: "linear-gradient(160deg,rgba(255,106,26,0.08) 0%,rgba(10,18,34,0) 60%)",
                  borderBottom: `1px solid ${HAIRLINE}`,
                  position: "relative",
                }}
              >
                <div
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    top: -40,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: 300,
                    height: 160,
                    background: "radial-gradient(ellipse at center,rgba(255,106,26,0.12) 0%,transparent 70%)",
                    pointerEvents: "none",
                  }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative", zIndex: 1 }}>
                  <div>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(255,106,26,0.10)", border: "1px solid rgba(255,106,26,0.22)", borderRadius: 999, padding: "4px 12px", marginBottom: 14 }}>
                      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", color: ACCENT, textTransform: "uppercase" }}>New League</span>
                    </div>
                    <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1 }}>Make it yours.</div>
                    <div style={{ fontSize: 13, color: MUTED_TEXT, marginTop: 6, lineHeight: 1.5 }}>
                      {isPro ? `Step ${createStep + 1} of 2 — ${createStep === 0 ? "Name, mode and access" : "Advanced scoring"}` : "Name it, pick a game mode, set the rules."}
                    </div>
                  </div>
                  <button
                    onClick={() => { setShowCreateModal(false); setCreateError(""); setCreateStep(0); }}
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 999, color: MUTED_TEXT, cursor: "pointer", fontSize: 14, fontWeight: 700, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div style={{ padding: "22px 28px 28px" }}>
                {/* Name */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 7 }}>League name</div>
                  <input
                    style={{ ...inputStyle, fontSize: 15, padding: "13px 14px", fontWeight: 700 }}
                    placeholder="e.g. Office Grid, Paddock Club, Sunday Sessions"
                    value={leagueName}
                    onChange={(e) => setLeagueName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && createLeague()}
                    autoFocus
                  />
                </div>

                {/* Game mode */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 7 }}>Game mode</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                    {MODES.map(({ key, label, pro, desc }) => {
                      const isSelected = leagueGameMode === key;
                      const locked = pro && !isPro;
                      return (
                        <button
                          key={key}
                          onClick={() => { if (!locked) setLeagueGameMode(key); }}
                          title={desc}
                          style={{
                            background: isSelected ? "rgba(255,106,26,0.14)" : PANEL_BG_ALT,
                            border: isSelected ? "1px solid rgba(255,106,26,0.4)" : "1px solid rgba(148,163,184,0.12)",
                            borderRadius: 12,
                            color: locked ? SUBTLE_TEXT : isSelected ? "#fff" : MUTED_TEXT,
                            cursor: locked ? "default" : "pointer",
                            fontSize: 12,
                            fontWeight: 700,
                            padding: "10px 12px",
                            textAlign: "left",
                            display: "flex",
                            flexDirection: "column",
                            gap: 4,
                          }}
                        >
                          <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontWeight: 900, fontSize: 13, color: locked ? SUBTLE_TEXT : isSelected ? "#fff" : "#cbd5e1" }}>{label}</span>
                            {locked && <span style={{ fontSize: 8, fontWeight: 900, color: ACCENT, background: "rgba(255,106,26,0.12)", borderRadius: 999, padding: "1px 5px", letterSpacing: "0.06em" }}>PRO</span>}
                          </span>
                          <span style={{ fontSize: 11, lineHeight: 1.4, color: isSelected ? "rgba(255,255,255,0.6)" : SUBTLE_TEXT }}>{desc}</span>
                        </button>
                      );
                    })}
                  </div>
                  {!isPro && (
                    <div style={{ marginTop: 8, fontSize: 11, color: MUTED_TEXT }}>
                      Pro modes unlock with{" "}
                      <span style={{ color: ACCENT, fontWeight: 800, cursor: "pointer" }} onClick={() => { setShowCreateModal(false); }}>Stint Pro</span>.
                    </div>
                  )}
                </div>

                {/* Visibility */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 7 }}>Access</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {[["private", "Private", "Invite code only"], ["public", "Public", "Anyone can find and join"]].map(([key, label, hint]) => (
                      <button
                        key={key}
                        onClick={() => setLeagueVisibility(key)}
                        style={{
                          flex: 1,
                          background: leagueVisibility === key ? "rgba(255,106,26,0.14)" : PANEL_BG_ALT,
                          border: leagueVisibility === key ? "1px solid rgba(255,106,26,0.40)" : "1px solid rgba(148,163,184,0.12)",
                          borderRadius: 12,
                          color: leagueVisibility === key ? "#fff" : MUTED_TEXT,
                          cursor: "pointer",
                          fontSize: 12,
                          fontWeight: 700,
                          padding: "10px 12px",
                          textAlign: "left",
                        }}
                      >
                        <div style={{ fontWeight: 900, fontSize: 13, marginBottom: 3, color: leagueVisibility === key ? "#fff" : "#cbd5e1" }}>{label}</div>
                        <div style={{ fontSize: 11, color: leagueVisibility === key ? "rgba(255,255,255,0.55)" : SUBTLE_TEXT }}>{hint}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Step 0 action */}
                {createStep === 0 && (
                  <>
                    {createError && (
                      <div style={{ marginBottom: 16, padding: "10px 12px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", fontSize: 12, color: "#fca5a5", lineHeight: 1.5 }}>
                        {createError}{" "}
                        {createError.includes("Upgrade") && <a href="/pro" style={{ color: ACCENT, fontWeight: 800 }}>Upgrade</a>}
                      </div>
                    )}
                    <button
                      onClick={() => {
                        if (!leagueName.trim()) return;
                        if (isPro) { setCreateStep(1); } else { createLeague(); }
                      }}
                      disabled={!leagueName.trim()}
                      style={{
                        background: leagueName.trim() ? BRAND_GRADIENT : "rgba(255,255,255,0.06)",
                        border: "none",
                        borderRadius: 14,
                        color: "#fff",
                        cursor: leagueName.trim() ? "pointer" : "default",
                        fontWeight: 900,
                        width: "100%",
                        padding: "15px",
                        fontSize: 15,
                        letterSpacing: "-0.01em",
                        opacity: leagueName.trim() ? 1 : 0.45,
                        boxShadow: leagueName.trim() ? "0 8px 24px rgba(255,106,26,0.28)" : "none",
                        transition: "opacity 180ms ease, box-shadow 180ms ease",
                      }}
                    >
                      {isPro
                        ? (leagueName.trim() ? "Continue →" : "Continue")
                        : (leagueName.trim() ? `Create "${leagueName}"` : "Create League")}
                    </button>
                    {isPro && (
                      <div style={{ marginTop: 10, textAlign: "center", fontSize: 11, color: SUBTLE_TEXT }}>
                        Next: advanced scoring settings
                      </div>
                    )}
                  </>
                )}

                {/* Step 1 (Pro only): Advanced scoring */}
                {createStep === 1 && isPro && (
                  <>
                    {/* Step indicator */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
                      <div style={{ display: "flex", gap: 5, flex: 1 }}>
                        {[0, 1].map((s) => (
                          <div key={s} style={{ flex: 1, height: 3, borderRadius: 99, background: s <= createStep ? ACCENT : "rgba(148,163,184,0.18)" }} />
                        ))}
                      </div>
                      <span style={{ fontSize: 10, color: SUBTLE_TEXT, fontWeight: 700, whiteSpace: "nowrap" }}>Step 2 of 2</span>
                    </div>

                    <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>Advanced scoring</div>
                    <div style={{ fontSize: 12, color: MUTED_TEXT, marginBottom: 18, lineHeight: 1.5 }}>
                      Customise how points are awarded in <strong style={{ color: "#fff" }}>{leagueName}</strong>.
                    </div>

                    {/* Scoring weights */}
                    <div style={{ marginBottom: 18 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 10 }}>Points per category</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        {SCORING_FIELDS.map(({ key, label }) => (
                          <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                            <span style={{ fontSize: 12, color: MUTED_TEXT, fontWeight: 600 }}>{label}</span>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={scoringWeights[key]}
                              onChange={(e) => setScoringWeights((prev) => ({ ...prev, [key]: Number(e.target.value) || 0 }))}
                              style={{ ...inputStyle, width: 56, padding: "6px 8px", textAlign: "center", fontSize: 13, fontWeight: 800 }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Sprint multiplier */}
                    <div style={{ marginBottom: 18 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 8 }}>Sprint weekend multiplier</div>
                      <div style={{ display: "flex", gap: 6 }}>
                        {[0.25, 0.5, 0.75, 1].map((val) => (
                          <button
                            key={val}
                            onClick={() => setSprintMultiplier(val)}
                            style={{
                              flex: 1,
                              background: sprintMultiplier === val ? "rgba(255,106,26,0.14)" : "transparent",
                              border: sprintMultiplier === val ? "1px solid rgba(255,106,26,0.4)" : `1px solid ${HAIRLINE}`,
                              borderRadius: 8,
                              color: sprintMultiplier === val ? "#fff" : MUTED_TEXT,
                              cursor: "pointer",
                              fontSize: 12,
                              fontWeight: 800,
                              padding: "7px 0",
                            }}
                          >
                            {val}×
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Bonus pick categories */}
                    <div style={{ marginBottom: 18 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 4 }}>Bonus pick categories</div>
                      <div style={{ fontSize: 11, color: MUTED_TEXT, marginBottom: 10, lineHeight: 1.5 }}>Enable extra picks for members of this league. Scored separately within your league.</div>
                      {[
                        { key: "p4",            label: "4th Place",          desc: "Driver who finishes P4" },
                        { key: "p10",           label: "10th Place",         desc: "Who scores the final point?" },
                        { key: "vsc",           label: "Virtual Safety Car", desc: "Will there be a VSC period?" },
                        { key: "lap1_incident", label: "Lap 1 Incident",     desc: "Contact or chaos on lap 1?" },
                        { key: "rain_race",     label: "Rain During Race",   desc: "Wet conditions at any point?" },
                        { key: "fastest_ctor",  label: "Fastest Pit Stop",   desc: "Which team posts the fastest stop?" },
                      ].map(({ key, label, desc }) => {
                        const on = extraCategories.includes(key);
                        return (
                          <div
                            key={key}
                            onClick={() => setExtraCategories((prev) => on ? prev.filter((k) => k !== key) : [...prev, key])}
                            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 10px", borderRadius: 8, background: on ? "rgba(255,106,26,0.08)" : "transparent", border: on ? "1px solid rgba(255,106,26,0.28)" : `1px solid ${HAIRLINE}`, cursor: "pointer", marginBottom: 5 }}
                          >
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 800, color: on ? "#fff" : MUTED_TEXT }}>{label}</div>
                              <div style={{ fontSize: 11, color: SUBTLE_TEXT }}>{desc}</div>
                            </div>
                            <div style={{ width: 18, height: 18, borderRadius: 4, background: on ? ACCENT : "transparent", border: on ? `1px solid ${ACCENT}` : `1px solid ${HAIRLINE}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff", flexShrink: 0 }}>
                              {on ? "✓" : ""}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Tiebreaker order */}
                    <div style={{ marginBottom: 22 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 8 }}>Tiebreaker (in order)</div>
                      <div style={{ display: "grid", gap: 6 }}>
                        {tiebreakerOrder.map((key, idx) => (
                          <div key={key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 11, color: SUBTLE_TEXT, fontWeight: 800, width: 16, textAlign: "center" }}>{idx + 1}</span>
                            <div style={{ flex: 1, background: "rgba(255,255,255,0.03)", border: `1px solid ${HAIRLINE}`, borderRadius: 8, padding: "7px 10px", fontSize: 12, color: MUTED_TEXT }}>{TIEBREAKER_LABELS[key]}</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                              <button onClick={() => { if (idx === 0) return; const next = [...tiebreakerOrder]; [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]; setTiebreakerOrder(next); }} disabled={idx === 0} style={{ background: "transparent", border: `1px solid ${HAIRLINE}`, borderRadius: 4, color: idx === 0 ? SUBTLE_TEXT : MUTED_TEXT, cursor: idx === 0 ? "default" : "pointer", fontSize: 9, padding: "2px 5px", opacity: idx === 0 ? 0.3 : 1 }}>▲</button>
                              <button onClick={() => { if (idx === tiebreakerOrder.length - 1) return; const next = [...tiebreakerOrder]; [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]; setTiebreakerOrder(next); }} disabled={idx === tiebreakerOrder.length - 1} style={{ background: "transparent", border: `1px solid ${HAIRLINE}`, borderRadius: 4, color: idx === tiebreakerOrder.length - 1 ? SUBTLE_TEXT : MUTED_TEXT, cursor: idx === tiebreakerOrder.length - 1 ? "default" : "pointer", fontSize: 9, padding: "2px 5px", opacity: idx === tiebreakerOrder.length - 1 ? 0.3 : 1 }}>▼</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {createError && (
                      <div style={{ marginBottom: 16, padding: "10px 12px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", fontSize: 12, color: "#fca5a5", lineHeight: 1.5 }}>
                        {createError}{" "}
                        {createError.includes("Upgrade") && <a href="/pro" style={{ color: ACCENT, fontWeight: 800 }}>Upgrade</a>}
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 10 }}>
                      <button
                        onClick={() => { setCreateStep(0); setCreateError(""); }}
                        style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${HAIRLINE}`, borderRadius: 14, color: MUTED_TEXT, cursor: "pointer", fontWeight: 800, padding: "15px 20px", fontSize: 14 }}
                      >
                        ← Back
                      </button>
                      <button
                        onClick={createLeague}
                        style={{
                          flex: 1,
                          background: BRAND_GRADIENT,
                          border: "none",
                          borderRadius: 14,
                          color: "#fff",
                          cursor: "pointer",
                          fontWeight: 900,
                          padding: "15px",
                          fontSize: 15,
                          letterSpacing: "-0.01em",
                          boxShadow: "0 8px 24px rgba(255,106,26,0.28)",
                        }}
                      >
                        {leagueName.trim() ? `Create "${leagueName}"` : "Create League"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
