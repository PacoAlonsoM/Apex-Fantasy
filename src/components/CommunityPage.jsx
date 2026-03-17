import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import { nextRace } from "../constants/calendar";
import {
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
} from "../constants/design";
import { requireActiveSession } from "../authProfile";
import useViewport from "../useViewport";

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

export default function CommunityPage({ user, openAuth }) {
  const { isMobile, isTablet } = useViewport();
  const [tab, setTab] = useState("leagues");
  const [leagueView, setLeagueView] = useState("standings");
  const [posts, setPosts] = useState([]);
  const [authorProfiles, setAuthorProfiles] = useState({});
  const [leaderboard, setLeaderboard] = useState([]);
  const [leagues, setLeagues] = useState([]);
  const [leagueStandings, setLeagueStandings] = useState({});
  const [leaguePosts, setLeaguePosts] = useState({});
  const [leagueForumReady, setLeagueForumReady] = useState({});
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

  const currentLeague = leagues.find((league) => league.id === selectedLeagueId) || null;
  const currentStandings = currentLeague ? (leagueStandings[currentLeague.id] || []) : [];
  const currentLeaguePosts = currentLeague ? (leaguePosts[currentLeague.id] || []) : [];
  const next = nextRace();

  useEffect(() => {
    fetchLeaderboard();
    fetchPosts();
  }, []);

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
  const leagueCount = leagues.length;
  const publicThreadCount = posts.length;
  const globalPlayerCount = leaderboard.length;

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

  async function fetchLeaderboard() {
    setLoadingLB(true);
    const { data } = await supabase.from("profiles").select("*").order("points", { ascending: false }).limit(24);
    if (data) setLeaderboard(data.map((profile) => normalizeProfileIdentity(profile, user)));
    setLoadingLB(false);
  }

  async function fetchPosts() {
    const { data } = await supabase.from("posts").select("*").order("created_at", { ascending: false });
    if (data) {
      const globalPosts = data.filter((post) => !post.league_id);
      setPosts(globalPosts);
      hydrateAuthorProfiles(globalPosts);
    }
  }

  async function fetchComments(postId) {
    const { data } = await supabase.from("comments").select("*").eq("post_id", postId).order("created_at", { ascending: true });
    if (data) {
      setComments((current) => ({ ...current, [postId]: data }));
      hydrateAuthorProfiles(data);
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
    fetchPosts();
  }

  async function submitLeaguePost() {
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
            <div key={post.id} style={{ borderRadius: CARD_RADIUS, border: open ? "1px solid rgba(248,250,252,0.14)" : PANEL_BORDER, background: open ? PANEL_BG_ALT : PANEL_BG, overflow: "hidden", boxShadow: open ? EDGE_RING : "none" }}>
              <div
                style={{ padding: "15px 16px", cursor: "pointer", borderRadius: 18 }}
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
              <div style={{ width: "min(100%, 520px)", borderRadius: 18, border: bubbleBorder, background: bubbleBg, padding: "12px 13px 11px" }}>
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

  return (
    <div style={{ maxWidth: CONTENT_MAX, margin: "0 auto", padding: isMobile ? "28px 18px 72px" : isTablet ? "34px 22px 80px" : "38px 28px 84px", position: "relative", zIndex: 1 }}>
      <section style={{ marginBottom: 24 }}>
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
            {user ? "League workspace active" : "Login required for league controls"}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,minmax(0,1fr))" : "repeat(4,minmax(0,1fr))", gap: 12, marginBottom: 18 }}>
          <StatCard label="Your leagues" value={String(leagueCount)} accent="#dbe4f0" />
          <StatCard label="Global players" value={String(globalPlayerCount || 0)} accent="#bfdbfe" />
          <StatCard label="Public threads" value={String(publicThreadCount || 0)} accent="#cbd5e1" />
          <StatCard label="Next race" value={next?.n || "TBA"} accent="#dbe4f0" />
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
                        {[["standings", "Standings"], ["chat", "Chat"], ["info", "League Info"]].map(([value, label]) => (
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
                    <div style={{ display: "grid", gridTemplateColumns: isTablet ? "1fr" : "minmax(340px,0.96fr) minmax(0,0.84fr)", gap: 16 }}>
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
                          <div style={{ display: "grid", gap: 1, background: HAIRLINE }}>
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

                      <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
                        <div style={{ borderRadius: CARD_RADIUS, border: PANEL_BORDER, background: PANEL_BG, overflow: "hidden", boxShadow: SOFT_SHADOW }}>
                          <div style={{ padding: "16px 18px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT }}>
                            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 4 }}>League pulse</div>
                            <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: -0.5 }}>What matters this week</div>
                          </div>
                          <div style={{ padding: 14, display: "grid", gap: 10 }}>
                            <StatCard label="Leader" value={leagueSummary.leader?.username || "No one"} accent="#dbe4f0" />
                            <StatCard label="Lead gap" value={`${leagueSummary.gap} pts`} accent="#bfdbfe" />
                            <StatCard label="Next race" value={next?.n || "TBA"} accent="#cbd5e1" />
                          </div>
                        </div>

                        <div style={{ borderRadius: CARD_RADIUS, border: PANEL_BORDER, background: PANEL_BG, overflow: "hidden", boxShadow: SOFT_SHADOW }}>
                          <div style={{ padding: "16px 18px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT }}>
                            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 4 }}>Member roster</div>
                            <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: -0.5 }}>Who is in the room</div>
                          </div>
                          <div style={{ padding: 14, display: "grid", gap: 10 }}>
                            {rosterPreview.map((member) => (
                              <div key={member.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, borderRadius: 16, border: "1px solid rgba(148,163,184,0.12)", background: PANEL_BG_ALT, padding: "11px 12px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                  <AvatarChip name={member.username} colorKey={member.avatar_color} size={30} radius={9} fontSize={10} />
                                  <div style={{ fontSize: 12, fontWeight: 800 }}>{member.username}</div>
                                </div>
                                <div style={{ fontSize: 11, color: MUTED_TEXT }}>{member.points || 0} pts</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
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
                            {renderLeagueChat(currentLeaguePosts)}
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
                            <div style={{ fontSize: 12, lineHeight: 1.72, color: MUTED_TEXT }}>Your current invite code is <span style={{ color: "#fff", fontWeight: 800, letterSpacing: "0.14em", fontFamily: "monospace" }}>{currentLeague.code}</span>. New players join from the league controls panel.</div>
                          </div>

                          <div style={{ borderRadius: 18, border: "1px solid rgba(148,163,184,0.12)", background: PANEL_BG_ALT, padding: "14px 15px 13px" }}>
                            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 7 }}>Competitive frame</div>
                            <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 6 }}>This league is tracking {next?.n || "the next Grand Prix"}.</div>
                            <div style={{ fontSize: 12, lineHeight: 1.72, color: MUTED_TEXT }}>The cleanest rhythm is: read the race-week information, lock picks, then use chat and standings to track who gained ground after scoring.</div>
                          </div>

                          <div style={{ borderRadius: 18, border: "1px solid rgba(148,163,184,0.12)", background: PANEL_BG_ALT, padding: "14px 15px 13px" }}>
                            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 7 }}>Ownership</div>
                            <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 6 }}>{currentLeague.owner_id === user.id ? "You own this league." : "You are a member of this league."}</div>
                            <div style={{ fontSize: 12, lineHeight: 1.72, color: MUTED_TEXT }}>{currentLeague.owner_id === user.id ? "As owner, you can share the code or remove the league completely." : "You can leave at any time without affecting the rest of the members."}</div>
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
            <div style={{ fontSize: 12, color: MUTED_TEXT }}>{loadingLB ? "Loading..." : `${leaderboard.length} players`}</div>
          </div>

          {loadingLB ? (
            <div style={{ padding: 30, color: MUTED_TEXT }}>Loading leaderboard...</div>
          ) : leaderboard.length === 0 ? (
            <div style={{ padding: 30, color: MUTED_TEXT }}>No players yet.</div>
          ) : (
            <div style={{ display: "grid", gap: 1, background: HAIRLINE }}>
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
