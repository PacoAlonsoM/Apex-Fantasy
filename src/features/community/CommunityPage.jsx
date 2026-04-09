import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/src/lib/supabase";
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

function AvatarChip({ name, colorKey, size = 32, radius = 10, fontSize = 11 }) {
  const theme = colorKey ? avatarTheme(colorKey) : null;
  const [bg, color] = theme ? [theme.fill, theme.text] : avatarTone(name);
  const border = theme ? theme.border : `${bg}44`;
  return (
    <div style={{ width: size, height: size, borderRadius: radius, background: theme ? bg : `${bg}22`, border: `1px solid ${border}`, boxShadow: theme ? "inset 0 0 0 1px rgba(255,255,255,0.08)" : "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize, fontWeight: 900, color, flexShrink: 0 }}>
      {(name || "?").slice(0, 2).toUpperCase()}
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

export default function CommunityPage({ user, openAuth, demoMode = false }) {
  const { isMobile, isTablet } = useViewport();
  const [tab, setTab] = useState(demoMode ? "forum" : "leagues");
  const [leagueView, setLeagueView] = useState("standings");
  const [posts, setPosts] = useState([]);
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
  const [expandedPosts, setExpandedPosts] = useState({});
  const [comments, setComments] = useState({});
  const [replyText, setReplyText] = useState({});
  const [loadingLB, setLoadingLB] = useState(true);
  const [showGlobalForm, setShowGlobalForm] = useState(false);
  const [globalDraft, setGlobalDraft] = useState({ title: "", body: "" });
  const [leagueMessage, setLeagueMessage] = useState("");
  const [leagueName, setLeagueName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [hoveredPostId, setHoveredPostId] = useState(null);
  const demoPreview = demoMode && !user;

  const currentLeague = useMemo(
    () => leagues.find((league) => league.id === selectedLeagueId) || leagues[0] || null,
    [leagues, selectedLeagueId]
  );
  const currentStandings = useMemo(
    () => (currentLeague ? (leagueStandings[currentLeague.id] || []) : []),
    [currentLeague, leagueStandings]
  );
  const currentLeaguePosts = useMemo(
    () => (currentLeague ? (leaguePosts[currentLeague.id] || []) : []),
    [currentLeague, leaguePosts]
  );
  const currentLeagueMemberIds = useMemo(
    () => currentStandings.map((member) => member.id).filter(Boolean).join("|"),
    [currentStandings]
  );
  const next = nextRace();

  useEffect(() => {
    fetchPublicCommunity();
    fetchScoredRounds();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (user) fetchLeagues();
    else {
      setLeagues([]);
      setSelectedLeagueId(null);
    }
  }, [user]); // eslint-disable-line

  useEffect(() => {
    if (!selectedLeagueId || !user) return;
    fetchLeagueStandings(selectedLeagueId);
    fetchLeaguePosts(selectedLeagueId);
  }, [selectedLeagueId, user]); // eslint-disable-line

  useEffect(() => {
    if (!leagues.length) {
      setSelectedLeagueId(null);
      return;
    }

    if (!leagues.some((league) => league.id === selectedLeagueId)) {
      setSelectedLeagueId(leagues[0].id);
    }
  }, [leagues, selectedLeagueId]);

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
    if (leagueView === "info") setLeagueView("standings");
  }, [leagueView]);

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
    setLeaderboard((current) => current.map((profile) => normalizeProfileIdentity(profile, user)));
    setLeagueStandings((current) => Object.fromEntries(
      Object.entries(current).map(([leagueId, standings]) => [leagueId, standings.map((profile) => normalizeProfileIdentity(profile, user))])
    ));
  }, [user]);

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
  const rosterPreview = useMemo(() => currentStandings.slice(0, 8), [currentStandings]);
  const selectedLeagueRoundMeta = useMemo(() => roundMeta(leagueReviewRound), [leagueReviewRound]);
  const currentLeagueReviewKey = currentLeague?.id && leagueReviewRound ? `${currentLeague.id}:${leagueReviewRound}` : null;
  const currentLeagueReview = currentLeagueReviewKey ? leagueRoundReviews[currentLeagueReviewKey] : null;
  const currentLeagueRoundResult = currentLeagueReview?.resultRow
    || scoredRounds.find((row) => Number(row.race_round) === Number(leagueReviewRound))
    || null;
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
    const ids = [...new Set((items || []).map((item) => item.author_id).filter(Boolean))];
    if (!ids.length) return;

    const missing = ids.filter((id) => !authorProfiles[id]);
    if (!missing.length) return;

    const { data } = await supabase.from("profiles").select("id,avatar_color,username,favorite_team").in("id", missing);
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
      setLoadingLB(false);
      return;
    }

    const leaderboardRows = (data?.leaderboard || []).map((profile) => normalizeProfileIdentity(profile, user));
    const publicPosts = data?.posts || [];
    const publicComments = data?.commentsByPost || {};
    const profileRows = data?.authorProfiles || [];

    setLeaderboard(leaderboardRows);
    setPosts(publicPosts);
    setComments((current) => ({ ...current, ...publicComments }));

    if (profileRows.length) {
      setAuthorProfiles((current) => ({
        ...current,
        ...Object.fromEntries(profileRows.map((profile) => [profile.id, normalizeProfileIdentity(profile, user)])),
      }));
    } else {
      hydrateAuthorProfiles(publicPosts);
    }

    setLoadingLB(false);
  }

  async function fetchComments(postId) {
    const { data, error } = await supabase.functions.invoke("community-public-feed", {
      body: { postId },
    });

    if (!error && data?.comments) {
      setComments((current) => ({ ...current, [postId]: data.comments }));

      if (data.authorProfiles?.length) {
        setAuthorProfiles((current) => ({
          ...current,
          ...Object.fromEntries(data.authorProfiles.map((profile) => [profile.id, normalizeProfileIdentity(profile, user)])),
        }));
      } else {
        hydrateAuthorProfiles(data.comments);
      }
    }
  }

  async function fetchLeagues() {
    const { data } = await supabase.from("league_members").select("league_id,leagues(*)").eq("user_id", user.id);
    if (!data) return;
    const nextLeagues = data.map((entry) => entry.leagues).filter(Boolean);
    setLeagues(nextLeagues);
    if (!nextLeagues.find((league) => league.id === selectedLeagueId)) {
      setSelectedLeagueId(nextLeagues[0]?.id || null);
    }
  }

  async function fetchLeagueStandings(leagueId) {
    const { data: members } = await supabase.from("league_members").select("user_id").eq("league_id", leagueId);
    const ids = (members || []).map((member) => member.user_id).filter(Boolean);

    if (!ids.length) {
      setLeagueStandings((current) => ({ ...current, [leagueId]: [] }));
      return;
    }

    const { data: profiles } = await supabase.from("profiles").select("*").in("id", ids);
    const sorted = (profiles || [])
      .map((profile) => normalizeProfileIdentity(profile, user))
      .sort((a, b) => (b.points || 0) - (a.points || 0));
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
    const memberIds = members.map((member) => member.id).filter(Boolean);
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
    const { data, error } = await supabase.from("posts").select("*").eq("league_id", leagueId).order("created_at", { ascending: false });
    if (error) {
      setLeagueForumReady((current) => ({ ...current, [leagueId]: false }));
      setLeaguePosts((current) => ({ ...current, [leagueId]: [] }));
      return;
    }

    setLeagueForumReady((current) => ({ ...current, [leagueId]: true }));
    setLeaguePosts((current) => ({ ...current, [leagueId]: data || [] }));
    hydrateAuthorProfiles(data || []);
  }

  async function createLeague() {
    if (demoPreview) return;
    if (!leagueName.trim() || !user) return;
    const session = await requireActiveSession();
    if (!session) return openAuth("login");

    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    const { data, error } = await supabase.from("leagues").insert({ name: leagueName, code, owner_id: user.id, is_public: false }).select().single();
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
    setExpandedPosts((current) => ({ ...current, league: null }));
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
    setExpandedPosts((current) => ({ ...current, league: null }));
    setLeagueMessage("");
  }

  async function submitGlobalPost() {
    if (demoPreview) return;
    if (!globalDraft.title.trim() || !globalDraft.body.trim() || !user) return;
    const session = await requireActiveSession();
    if (!session) return openAuth("login");

    const { error } = await supabase.from("posts").insert({ author_id: user.id, author_name: user.username, title: globalDraft.title, body: globalDraft.body });
    if (error) {
      alert(error.message);
      return;
    }
    setGlobalDraft({ title: "", body: "" });
    setShowGlobalForm(false);
    fetchPublicCommunity();
  }

  async function submitLeaguePost() {
    if (demoPreview) return;
    if (!leagueMessage.trim() || !user || !currentLeague) return;
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

  async function submitReply(postId) {
    if (demoPreview) return;
    if (!user || !replyText[postId]?.trim()) return;
    const session = await requireActiveSession();
    if (!session) return openAuth("login");

    const { error } = await supabase.from("comments").insert({ post_id: postId, author_id: user.id, author_name: user.username, body: replyText[postId] });
    if (error) {
      alert(error.message);
      return;
    }
    setReplyText((current) => ({ ...current, [postId]: "" }));
    fetchComments(postId);
  }

  async function toggleThread(scope, id) {
    if (expandedPosts[scope] === id) {
      setExpandedPosts((current) => ({ ...current, [scope]: null }));
      return;
    }

    setExpandedPosts((current) => ({ ...current, [scope]: id }));
    if (!comments[id]) fetchComments(id);
  }

  function renderThreadList(items, scope, emptyTitle, emptyBody) {
    if (!items.length) {
      return (
        <div style={{ borderRadius: 18, border: PANEL_BORDER, background: PANEL_BG, padding: 28, textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 8 }}>{emptyTitle}</div>
          <div style={{ fontSize: 13, color: MUTED_TEXT }}>{emptyBody}</div>
        </div>
      );
    }

    return (
      <div style={{ display: "grid", gap: 10 }}>
        {items.map((post) => {
          const open = expandedPosts[scope] === post.id;
          const postComments = comments[post.id] || [];

          return (
            <div key={post.id} style={{ borderRadius: CARD_RADIUS, border: open ? "1px solid rgba(248,250,252,0.14)" : PANEL_BORDER, background: open ? PANEL_BG_ALT : (hoveredPostId === post.id ? "rgba(255,255,255,0.05)" : PANEL_BG), overflow: "hidden", boxShadow: open ? EDGE_RING : "none", transition: "background 180ms ease, border-color 180ms ease" }}>
              <div
                style={{ padding: "15px 16px", cursor: "pointer", borderRadius: 18 }}
                onMouseEnter={() => setHoveredPostId(post.id)}
                onMouseLeave={() => setHoveredPostId(null)}
                onClick={() => toggleThread(scope, post.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    toggleThread(scope, post.id);
                  }
                }}
                role="button"
                tabIndex={0}
                data-clickable="true"
              >
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <AvatarChip name={post.author_name} colorKey={authorProfiles[post.author_id]?.avatar_color} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 5 }}>
                      <div style={{ fontSize: 12, fontWeight: 800 }}>{post.author_name}</div>
                      <div style={{ fontSize: 10, color: SUBTLE_TEXT }}>{formatStamp(post.created_at)}</div>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: -0.3, marginBottom: 5 }}>{post.title}</div>
                    <div style={{ fontSize: 13, lineHeight: 1.62, color: MUTED_TEXT }}>{post.body}</div>
                  </div>
                </div>
              </div>

              {open && (
                <div style={{ borderTop: `1px solid ${HAIRLINE}`, background: "rgba(0,0,0,0.14)" }}>
                  {postComments.length > 0 && (
                    <div style={{ padding: "12px 16px 0" }}>
                      {postComments.map((comment, index) => (
                        <div key={comment.id} style={{ display: "flex", gap: 10, padding: "10px 0", borderBottom: index < postComments.length - 1 ? `1px solid ${HAIRLINE}` : "none" }}>
                          <AvatarChip name={comment.author_name} colorKey={authorProfiles[comment.author_id]?.avatar_color} size={28} radius={8} fontSize={10} />
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 4 }}>
                              <div style={{ fontSize: 12, fontWeight: 800 }}>{comment.author_name}</div>
                              <div style={{ fontSize: 10, color: SUBTLE_TEXT }}>{formatStamp(comment.created_at)}</div>
                            </div>
                            <div style={{ fontSize: 12, lineHeight: 1.6, color: MUTED_TEXT }}>{comment.body}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ padding: "12px 16px 14px", display: "flex", gap: 8, alignItems: "center" }}>
                    {user ? (
                      <>
                        <input
                          style={{ ...inputStyle, padding: "9px 11px", fontSize: 12, flex: 1 }}
                          placeholder="Reply..."
                          value={replyText[post.id] || ""}
                          onChange={(event) => setReplyText((current) => ({ ...current, [post.id]: event.target.value }))}
                          onKeyDown={(event) => event.key === "Enter" && submitReply(post.id)}
                        />
                        <button onClick={() => submitReply(post.id)} style={{ background: BRAND_GRADIENT, border: "none", borderRadius: 10, color: "#fff", cursor: "pointer", fontWeight: 800, fontSize: 12, padding: "9px 12px" }}>
                          Reply
                        </button>
                      </>
                    ) : demoPreview ? (
                      <div style={{ fontSize: 12, color: MUTED_TEXT }}>
                        Preview mode is active. Posting is disabled on this link.
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: MUTED_TEXT }}>
                        <span style={{ color: "#fff", fontWeight: 800, cursor: "pointer" }} onClick={() => openAuth("login")}>Login</span> to join the discussion.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
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
          const themeKey = authorProfiles[post.author_id]?.avatar_color;
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
                  {!mine && <AvatarChip name={post.author_name} colorKey={themeKey} size={30} radius={9} fontSize={10} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 5 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: mine ? "#fde68a" : "#fff" }}>{mine ? "You" : post.author_name}</div>
                      <div style={{ fontSize: 10, color: SUBTLE_TEXT }}>{formatStamp(post.created_at)}</div>
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.6, color: mine ? "#fff7ed" : MUTED_TEXT, whiteSpace: "pre-wrap" }}>{post.body}</div>
                  </div>
                  {mine && <AvatarChip name={post.author_name} colorKey={themeKey} size={30} radius={9} fontSize={10} />}
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
        description: "The global board keeps the league energy visible: the same scoring system, the same weekend swings, and a cleaner read on who is setting the pace.",
        stats: [
          [String(leaderboard.length || 0), "players"],
          [leaderboard[0]?.username || "none", "leader"],
          [loadingLB ? "loading" : "live", "status"],
        ],
      }
    : tab === "forum"
      ? {
          eyebrow: "Public forum",
          titleLines: ["Talk the race.", "Challenge the read.", "Keep receipts."],
          description: "The public forum stays inside the same league shell so global conversation feels connected to the table instead of like a separate old page.",
          stats: [
            [String(posts.length || 0), "threads"],
            [user ? "can post" : demoPreview ? "preview" : "login", "access"],
            [showGlobalForm ? "writing" : "live", "status"],
          ],
        }
      : {
          eyebrow: "Leagues",
          titleLines: ["Build the room.", "Track the table.", "Own the weekend."],
          description: "Private leagues now run like workspaces: a control rail on the left, a dedicated standings and chat area on the right, and a cleaner path into the global leaderboard and public discussion.",
          stats: [
            [String(leagues.length || 0), "leagues"],
            [String(currentStandings.length || 0), "members"],
            [user ? "active" : demoPreview ? "preview" : "login", "status"],
          ],
        };

  return (
    <div style={{ maxWidth: CONTENT_MAX, margin: "0 auto", padding: isMobile ? "28px 18px 72px" : isTablet ? "34px 22px 80px" : "38px 28px 84px", position: "relative", zIndex: 1 }}>
      <section style={{ marginBottom: 24 }}>
        {["leagues", "leaderboard", "forum"].includes(tab) ? (
          <section style={{ borderRadius: 28, border: PANEL_BORDER, background: PANEL_BG, overflow: "hidden", boxShadow: SOFT_SHADOW }}>
            <div
              style={{
                padding: "28px 30px 24px",
                minHeight: isMobile ? 0 : 312,
                borderBottom: `1px solid ${HAIRLINE}`,
                background: "linear-gradient(180deg,rgba(255,255,255,0.03),rgba(15,24,44,0.96))",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <img
                src="/images/Grid%20lights.png"
                alt=""
                aria-hidden="true"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: "center 84%",
                  opacity: isMobile ? 0.23 : 0.34,
                  filter: "saturate(1.14) brightness(1.18)",
                  transform: "scale(1.04)",
                  pointerEvents: "none",
                }}
                onError={(e) => { e.target.style.display = "none"; }}
              />
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "linear-gradient(to bottom, rgba(10,15,26,0.06) 0%, rgba(10,15,26,0.62) 100%)",
                  pointerEvents: "none",
                }}
              />
              <div style={{ position: "relative", zIndex: 1, display: "flex", justifyContent: "space-between", alignItems: "flex-start", alignContent: "space-between", gap: 14, flexWrap: "wrap", minHeight: isMobile ? "auto" : 260 }}>
                <div style={{ maxWidth: 760 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 12 }}>
                    {communityHero.eyebrow}
                  </div>
                  <h1 style={{ fontSize: isMobile ? 28 : 54, fontWeight: 800, lineHeight: 0.94, margin: "0 0 12px", letterSpacing: isMobile ? "-0.04em" : "-0.07em" }}>
                    {communityHero.titleLines.map((line, index) => (
                      <span key={line}>
                        {line}
                        {index < communityHero.titleLines.length - 1 && <br />}
                      </span>
                    ))}
                  </h1>
                  <div style={{ fontSize: isMobile ? 14 : 15, lineHeight: 1.82, color: MUTED_TEXT, maxWidth: 640 }}>
                    {communityHero.description}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(3,minmax(0,1fr))" : "repeat(3,minmax(0,116px))", gap: 10, width: isMobile ? "100%" : "auto" }}>
                  {communityHero.stats.map(([value, label]) => (
                    <div key={label} style={{ borderRadius: 18, border: label === "status" ? `1px solid ${ACCENT}33` : "1px solid rgba(148,163,184,0.14)", background: "rgba(255,255,255,0.02)", boxShadow: EDGE_RING, padding: "14px 15px 13px" }}>
                      <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.8 }}>{value}</div>
                      <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginTop: 4 }}>{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ padding: "12px 24px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[["leagues", "Leagues"], ["leaderboard", "Global Leaderboard"], ["forum", "Public forum"]].map(([value, label]) => (
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
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: isTablet ? "1fr" : "minmax(0,1fr) auto", gap: 20, alignItems: "end", marginBottom: 20 }}>
              <div style={{ maxWidth: 780 }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 999, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(148,163,184,0.12)", marginBottom: 18 }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#f97316" }} />
                  <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#cbd5e1" }}>Leagues</span>
                </div>
                <h1 style={{ fontSize: isMobile ? 40 : 58, lineHeight: 0.95, margin: "0 0 12px", letterSpacing: isMobile ? -1.6 : -2.8 }}>
                  Build the room.
                  <br />
                  Track the table.
                  <br />
                  Own the weekend.
                </h1>
                <p style={{ margin: 0, maxWidth: 660, fontSize: 14, lineHeight: 1.82, color: MUTED_TEXT }}>
                  Private leagues now run like workspaces: a control rail on the left, a dedicated standings and chat area on the right, and a cleaner path into the global leaderboard and public discussion.
                </p>
              </div>

              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 999, background: PANEL_BG_ALT, border: "1px solid rgba(148,163,184,0.12)", color: SUBTLE_TEXT, fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", height: "fit-content" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", animation: "pulseDot 2s infinite" }} />
                {user ? "League workspace active" : demoPreview ? "Public preview active" : "Login required for league controls"}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {[["leagues", "Leagues"], ["leaderboard", "Global Leaderboard"], ["forum", "Public forum"]].map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setTab(value)}
                  style={{
                    background: tab === value ? "linear-gradient(180deg,rgba(255,255,255,0.06),rgba(15,24,44,0.96))" : PANEL_BG_ALT,
                    border: tab === value ? "1px solid rgba(248,250,252,0.14)" : "1px solid rgba(148,163,184,0.12)",
                    borderRadius: 999,
                    color: tab === value ? "#fff" : MUTED_TEXT,
                    cursor: "pointer",
                    padding: "11px 16px",
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: "0.04em",
                    boxShadow: tab === value ? SOFT_SHADOW : "none",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </>
        )}
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
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#fff", marginBottom: 8 }}>Create league</div>
                  <input
                    style={{ ...inputStyle, marginBottom: 10 }}
                    placeholder="League name"
                    value={leagueName}
                    onChange={(event) => setLeagueName(event.target.value)}
                    onKeyDown={(event) => event.key === "Enter" && createLeague()}
                  />
                  <button style={{ background: BRAND_GRADIENT, border: "none", borderRadius: 12, color: "#fff", cursor: "pointer", fontWeight: 800, width: "100%", padding: 12, fontSize: 13 }} onClick={createLeague}>
                    Create league
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
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT }}>Your leagues</div>
                  <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: -0.5, marginTop: 4 }}>{leagues.length}</div>
                </div>
                {leagues.length === 0 ? (
                  <div style={{ padding: 22, fontSize: 13, color: MUTED_TEXT }}>
                    Create or join a league to unlock a dedicated standings view for your group.
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 1, background: HAIRLINE }}>
                    {leagues.map((league) => {
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
                    })}
                  </div>
                )}
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
                        {{ standings: "Standings", review: "Round Review", chat: "Chat" }[leagueView] || leagueView}
                      </span>
                    </>
                  )}
                </div>
              )}
              {currentLeague ? (
                <>
                  <div style={{ borderRadius: SECTION_RADIUS, border: PANEL_BORDER, background: PANEL_BG, overflow: "hidden", marginBottom: 16, boxShadow: SOFT_SHADOW }}>
                    <div style={{ height: 3, background: BRAND_GRADIENT }} />
                    <div style={{ padding: "20px 22px 18px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 6 }}>
                            Selected league
                          </div>
                          <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: -1, marginBottom: 6 }}>{currentLeague.name}</div>
                          <div style={{ fontSize: 13, color: MUTED_TEXT }}>Private league for race-by-race competition.</div>
                        </div>

                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,minmax(0,1fr))" : "repeat(4,minmax(0,1fr))", gap: 10 }}>
                        <StatCard label="Members" value={String(currentStandings.length || 0)} accent="#dbe4f0" />
                        <StatCard label="Leader" value={leagueSummary.leader?.username || "No one"} accent="#cbd5e1" />
                        <StatCard label="Average" value={`${leagueSummary.average} pts`} accent="#bfdbfe" />
                        <StatCard label="Next race" value={next?.n || "TBA"} accent="#cbd5e1" />
                      </div>

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
                        {[["standings", "Standings"], ["review", "Round Review"], ["chat", "Chat"]].map(([value, label]) => (
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
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "16px 18px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT, flexWrap: "wrap" }}>
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
                                  <AvatarChip name={member.username} colorKey={member.avatar_color} />
                                  <div>
                                    <div style={{ fontSize: 13, fontWeight: 800 }}>{member.username}</div>
                                    <div style={{ fontSize: 11, color: MUTED_TEXT }}>{index === 0 ? "Current league leader" : "League member"}</div>
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
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "16px 18px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT, flexWrap: "wrap" }}>
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
                                      <AvatarChip name={entry.member.username} colorKey={entry.member.avatar_color} size={36} radius={11} fontSize={12} />
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
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "16px 18px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT, flexWrap: "wrap" }}>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT }}>League chat</div>
                          <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: -0.5, marginTop: 4 }}>Private race room</div>
                        </div>
                        <div style={{ fontSize: 12, color: MUTED_TEXT }}>Quick race-week discussion and lineup talk.</div>
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
                            <div style={{ borderRadius: 16, border: "1px solid rgba(148,163,184,0.14)", background: PANEL_BG_ALT, padding: 14, marginBottom: 14, boxShadow: EDGE_RING }}>
                              <textarea
                                style={{ ...inputStyle, minHeight: 84, resize: "vertical", marginBottom: 10 }}
                                placeholder="Drop a message for your league..."
                                value={leagueMessage}
                                onChange={(event) => setLeagueMessage(event.target.value)}
                              />
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                                <div style={{ fontSize: 11, color: MUTED_TEXT }}>Messages stay inside this private league space.</div>
                                <button onClick={submitLeaguePost} style={{ background: BRAND_GRADIENT, border: "none", borderRadius: 12, color: "#fff", cursor: "pointer", fontWeight: 800, padding: "10px 14px", fontSize: 12 }}>
                                  Send
                                </button>
                              </div>
                            </div>
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

                  {leagueView === "info" && (
                    <div style={{ display: "grid", gridTemplateColumns: isTablet ? "1fr" : "minmax(0,1fr) 320px", gap: 16 }}>
                      <div style={{ borderRadius: CARD_RADIUS, border: PANEL_BORDER, background: PANEL_BG, overflow: "hidden", boxShadow: SOFT_SHADOW }}>
                        <div style={{ padding: "16px 18px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT }}>
                          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 4 }}>League info</div>
                          <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: -0.5 }}>Operate the league cleanly</div>
                        </div>
                        <div style={{ padding: 16, display: "grid", gap: 12 }}>
                          <div style={{ borderRadius: 18, border: "1px solid rgba(148,163,184,0.12)", background: PANEL_BG_ALT, padding: "14px 15px 13px" }}>
                            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 7 }}>Invite flow</div>
                            <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 6 }}>Share the league code and bring the room together.</div>
                            <div style={{ fontSize: 12, lineHeight: 1.72, color: MUTED_TEXT }}>
                              <>Your current invite code is <span style={{ color: "#fff", fontWeight: 800, letterSpacing: "0.14em", fontFamily: "monospace" }}>{currentLeague.code}</span>. New players join from the league controls panel.</>
                            </div>
                          </div>

                          <div style={{ borderRadius: 18, border: "1px solid rgba(148,163,184,0.12)", background: PANEL_BG_ALT, padding: "14px 15px 13px" }}>
                            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 7 }}>Competitive frame</div>
                            <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 6 }}>This league is tracking {next?.n || "the next Grand Prix"}.</div>
                            <div style={{ fontSize: 12, lineHeight: 1.72, color: MUTED_TEXT }}>The cleanest rhythm is: read the race-week information, lock picks, then use chat and standings to track who gained ground after scoring.</div>
                          </div>

                          <div style={{ borderRadius: 18, border: "1px solid rgba(148,163,184,0.12)", background: PANEL_BG_ALT, padding: "14px 15px 13px" }}>
                            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 7 }}>Ownership</div>
                            <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 6 }}>
                              {currentLeague.owner_id === user.id ? "You own this league." : "You are a member of this league."}
                            </div>
                            <div style={{ fontSize: 12, lineHeight: 1.72, color: MUTED_TEXT }}>
                              {currentLeague.owner_id === user.id
                                ? "As owner, you can share the code or remove the league completely."
                                : "You can leave at any time without affecting the rest of the members."}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
                        <div style={{ borderRadius: CARD_RADIUS, border: PANEL_BORDER, background: PANEL_BG, overflow: "hidden", boxShadow: SOFT_SHADOW }}>
                          <div style={{ padding: "16px 18px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT }}>
                            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 4 }}>Members</div>
                            <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: -0.5 }}>Current roster</div>
                          </div>
                          <div style={{ padding: 14, display: "grid", gap: 10 }}>
                            {rosterPreview.length ? rosterPreview.map((member) => (
                              <div key={member.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, borderRadius: 16, border: "1px solid rgba(148,163,184,0.12)", background: PANEL_BG_ALT, padding: "11px 12px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                  <AvatarChip name={member.username} colorKey={member.avatar_color} size={30} radius={9} fontSize={10} />
                                  <div style={{ fontSize: 12, fontWeight: 800 }}>{member.username}</div>
                                </div>
                                <div style={{ fontSize: 11, color: MUTED_TEXT }}>{member.points || 0} pts</div>
                              </div>
                            )) : (
                              <div style={{ fontSize: 12, color: MUTED_TEXT }}>No members yet.</div>
                            )}
                          </div>
                        </div>

                        <div style={{ borderRadius: CARD_RADIUS, border: PANEL_BORDER, background: PANEL_BG, overflow: "hidden", boxShadow: SOFT_SHADOW }}>
                          <div style={{ padding: "16px 18px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT }}>
                            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 4 }}>League health</div>
                            <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: -0.5 }}>Quick checks</div>
                          </div>
                          <div style={{ padding: 14, display: "grid", gap: 10 }}>
                            <StatCard label="Members" value={String(currentStandings.length || 0)} accent="#dbe4f0" />
                            <StatCard label="Leader gap" value={`${leagueSummary.gap} pts`} accent="#bfdbfe" />
                            <StatCard label="Chat posts" value={String(currentLeaguePosts.length || 0)} accent="#cbd5e1" />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
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
        ) : demoPreview ? (
          <div style={{ borderRadius: SECTION_RADIUS, border: PANEL_BORDER, background: PANEL_BG, padding: 28, boxShadow: SOFT_SHADOW }}>
            <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: -0.8, marginBottom: 8 }}>Public league preview</div>
            <div style={{ fontSize: 13, lineHeight: 1.68, color: MUTED_TEXT, marginBottom: 16 }}>
              This demo link keeps league controls off, but the global leaderboard and public forum are open so you can capture the product without logging in.
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={() => setTab("leaderboard")} style={{ background: BRAND_GRADIENT, border: "none", borderRadius: 12, color: "#fff", cursor: "pointer", fontWeight: 800, padding: "12px 14px", fontSize: 13 }}>
                Open Global Leaderboard
              </button>
              <button onClick={() => setTab("forum")} style={{ background: PANEL_BG_ALT, border: "1px solid rgba(148,163,184,0.12)", borderRadius: 12, color: "#fff", cursor: "pointer", fontWeight: 800, padding: "12px 14px", fontSize: 13 }}>
                Open Public Forum
              </button>
            </div>
          </div>
        ) : (
          <div style={{ borderRadius: SECTION_RADIUS, border: PANEL_BORDER, background: PANEL_BG, padding: 28, boxShadow: SOFT_SHADOW }}>
            <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: -0.8, marginBottom: 8 }}>Login to open league spaces</div>
            <div style={{ fontSize: 13, lineHeight: 1.68, color: MUTED_TEXT, marginBottom: 16 }}>
              Leagues are now handled as dedicated workspaces with member standings and league-specific discussion.
            </div>
            <button onClick={() => openAuth("login")} style={{ background: BRAND_GRADIENT, border: "none", borderRadius: 12, color: "#fff", cursor: "pointer", fontWeight: 800, padding: "12px 14px", fontSize: 13 }}>
              Login
            </button>
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
                    <AvatarChip name={player.username} colorKey={player.avatar_color} />
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

      {tab === "forum" && (
        <section>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT }}>Public forum</div>
              <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.6, marginTop: 4 }}>Open discussion</div>
            </div>
            {user ? (
              <button onClick={() => setShowGlobalForm((value) => !value)} style={{ background: BRAND_GRADIENT, border: "none", borderRadius: 12, color: "#fff", cursor: "pointer", fontWeight: 800, padding: "10px 12px", fontSize: 12 }}>
                {showGlobalForm ? "Cancel" : "New post"}
              </button>
            ) : demoPreview ? (
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: SUBTLE_TEXT }}>
                Preview mode
              </div>
            ) : (
              <button onClick={() => openAuth("login")} style={{ background: PANEL_BG_ALT, border: "1px solid rgba(148,163,184,0.12)", borderRadius: 12, color: "#fff", cursor: "pointer", fontWeight: 800, padding: "10px 12px", fontSize: 12 }}>
                Login to post
              </button>
            )}
          </div>

          {showGlobalForm && (
            <div style={{ borderRadius: CARD_RADIUS, border: PANEL_BORDER, background: PANEL_BG, padding: 16, marginBottom: 14, boxShadow: SOFT_SHADOW }}>
              <input
                style={{ ...inputStyle, marginBottom: 10 }}
                placeholder="Post title"
                value={globalDraft.title}
                onChange={(event) => setGlobalDraft((current) => ({ ...current, title: event.target.value }))}
              />
              <textarea
                style={{ ...inputStyle, minHeight: 88, resize: "vertical", marginBottom: 10 }}
                placeholder="Share your take on the next round"
                value={globalDraft.body}
                onChange={(event) => setGlobalDraft((current) => ({ ...current, body: event.target.value }))}
              />
              <button onClick={submitGlobalPost} style={{ background: BRAND_GRADIENT, border: "none", borderRadius: 12, color: "#fff", cursor: "pointer", fontWeight: 800, padding: "10px 14px", fontSize: 12 }}>
                Publish
              </button>
            </div>
          )}

          {renderThreadList(posts, "global", "No global posts yet", "Start the first discussion about the next race, teams or prediction strategy.")}
        </section>
      )}
    </div>
  );
}
