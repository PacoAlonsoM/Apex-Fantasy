import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import {
  CARD_RADIUS,
  CONTENT_MAX,
  DEFAULT_AVATAR_COLOR,
  EDGE_RING,
  HAIRLINE,
  MUTED_TEXT,
  PANEL_BG,
  PANEL_BG_ALT,
  PANEL_BG_STRONG,
  PANEL_BORDER,
  SECTION_RADIUS,
  SOFT_SHADOW,
  SUBTLE_TEXT,
  avatarTheme,
  teamSupportKey,
} from "../constants/design";
import { TEAMS } from "../constants/teams";
import useViewport from "../useViewport";

function teamAccent(teamName) {
  return TEAMS[teamName]?.c || "#94a3b8";
}

function avatarTone(name = "") {
  const total = name.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const palettes = [
    ["#94a3b8", "#e2e8f0"],
    ["#64748b", "#dbe4f0"],
    ["#0f766e", "#ccfbf1"],
    ["#1d4ed8", "#dbeafe"],
    ["#475569", "#f8fafc"],
  ];
  return palettes[total % palettes.length];
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

function AvatarChip({ name, colorKey, size = 40, radius = 14, fontSize = 13 }) {
  const theme = colorKey ? avatarTheme(colorKey) : null;
  const [bg, color] = theme ? [theme.fill, theme.text] : avatarTone(name);
  const border = theme ? theme.border : `${bg}44`;

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: theme ? bg : `${bg}22`,
        border: `1px solid ${border}`,
        boxShadow: theme ? "inset 0 0 0 1px rgba(255,255,255,0.08)" : "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize,
        fontWeight: 900,
        color,
        flexShrink: 0,
      }}
    >
      {(name || "?").slice(0, 2).toUpperCase()}
    </div>
  );
}

function SummaryMetric({ label, value, detail, accent = "#f8fafc" }) {
  return (
    <div
      style={{
        borderRadius: CARD_RADIUS,
        border: "1px solid rgba(148,163,184,0.14)",
        background: PANEL_BG_ALT,
        boxShadow: EDGE_RING,
        padding: "16px 16px 15px",
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: -1.1, color: accent, marginBottom: 5 }}>{value}</div>
      <div style={{ fontSize: 12, lineHeight: 1.65, color: MUTED_TEXT }}>{detail}</div>
    </div>
  );
}

function formatSupportLabel(teamName) {
  if (!teamName) return "No team selected";
  return teamName;
}

export default function StandingsPage({ user }) {
  const { isMobile, isTablet } = useViewport();
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function fetchLeaderboard() {
      setLoading(true);
      setError("");

      const { data, error: fetchError } = await supabase
        .from("profiles")
        .select("id,username,points,avatar_color,favorite_team")
        .order("points", { ascending: false })
        .order("username", { ascending: true });

      if (!active) return;

      if (fetchError) {
        setError(fetchError.message || "Could not load leaderboard.");
        setLeaderboard([]);
        setLoading(false);
        return;
      }

      const normalized = (data || []).map((profile) => normalizeProfileIdentity(profile, user));
      setLeaderboard(normalized);
      setLoading(false);
    }

    fetchLeaderboard();

    return () => {
      active = false;
    };
  }, [user]);

  const rankedPlayers = useMemo(
    () => leaderboard.map((profile, index) => ({ ...profile, rank: index + 1 })),
    [leaderboard]
  );

  const leader = rankedPlayers[0] || null;
  const runnerUp = rankedPlayers[1] || null;
  const currentUserRank = user ? rankedPlayers.find((profile) => profile.id === user.id) || null : null;
  const playerCount = rankedPlayers.length;
  const topTenAverage = rankedPlayers.length
    ? Math.round(rankedPlayers.slice(0, 10).reduce((sum, profile) => sum + (profile.points || 0), 0) / Math.min(10, rankedPlayers.length))
    : 0;
  const leaderGap = leader ? (leader.points || 0) - (runnerUp?.points || 0) : 0;

  const supportLeaders = useMemo(() => {
    const grouped = rankedPlayers.reduce((acc, profile) => {
      if (!profile.favorite_team) return acc;
      if (!acc[profile.favorite_team]) {
        acc[profile.favorite_team] = {
          team: profile.favorite_team,
          count: 0,
          totalPoints: 0,
        };
      }
      acc[profile.favorite_team].count += 1;
      acc[profile.favorite_team].totalPoints += profile.points || 0;
      return acc;
    }, {});

    return Object.values(grouped)
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return b.totalPoints - a.totalPoints;
      })
      .slice(0, 5);
  }, [rankedPlayers]);

  return (
    <div
      style={{
        maxWidth: CONTENT_MAX,
        margin: "0 auto",
        padding: isMobile ? "28px 18px 72px" : isTablet ? "34px 22px 80px" : "38px 28px 84px",
        position: "relative",
        zIndex: 1,
      }}
    >
      <section
        style={{
          borderRadius: SECTION_RADIUS,
          border: PANEL_BORDER,
          background: `linear-gradient(180deg,rgba(10,18,32,0.98),${PANEL_BG_STRONG})`,
          boxShadow: SOFT_SHADOW,
          overflow: "hidden",
          marginBottom: 18,
        }}
      >
        <div
          style={{
            padding: "28px 30px 24px",
            borderBottom: `1px solid ${HAIRLINE}`,
            background: "linear-gradient(180deg,rgba(255,255,255,0.02),rgba(7,16,27,0.96))",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
            <div style={{ maxWidth: 760 }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "7px 12px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(148,163,184,0.12)",
                  boxShadow: EDGE_RING,
                  marginBottom: 18,
                }}
              >
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: loading ? "#facc15" : "#34d399" }} />
                <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#dbe4f0" }}>
                  {loading ? "Loading leaderboard" : "Live leaderboard"}
                </span>
              </div>

              <h1 style={{ fontSize: isMobile ? 40 : 58, lineHeight: 0.96, margin: "0 0 12px", letterSpacing: isMobile ? -1.6 : -2.8 }}>
                Global leaderboard.
                <br />
                Real player standings.
              </h1>
              <div style={{ maxWidth: 640, fontSize: 14, lineHeight: 1.82, color: MUTED_TEXT }}>
                This board now reads directly from live profile points. Rank, gaps, support trends, and your own position all update from the same fantasy scoring system used across the app.
              </div>
            </div>

            {currentUserRank && (
              <div
                style={{
                  minWidth: isMobile ? "100%" : 250,
                  borderRadius: CARD_RADIUS,
                  border: "1px solid rgba(249,115,22,0.18)",
                  background: "linear-gradient(180deg,rgba(249,115,22,0.08),rgba(26,39,64,0.9))",
                  boxShadow: EDGE_RING,
                  padding: "16px 18px",
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 8 }}>
                  Your standing
                </div>
                <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: -1.1, marginBottom: 4 }}>P{currentUserRank.rank}</div>
                <div style={{ fontSize: 13, color: MUTED_TEXT }}>{currentUserRank.points || 0} pts · {formatSupportLabel(currentUserRank.favorite_team)}</div>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,minmax(0,1fr))" : "repeat(4,minmax(0,1fr))", gap: 12, padding: 18 }}>
          <SummaryMetric label="Leader" value={leader?.username || "—"} detail={leader ? `${leader.points || 0} pts on top of the board` : "No players ranked yet"} accent={teamAccent(leader?.favorite_team)} />
          <SummaryMetric label="Gap to P2" value={leader ? `${leaderGap} pts` : "—"} detail={runnerUp ? `${leader.username} over ${runnerUp.username}` : "Waiting for more than one player"} accent="#dbeafe" />
          <SummaryMetric label="Players" value={playerCount ? String(playerCount) : "—"} detail="Profiles with ranked fantasy points" accent="#fde68a" />
          <SummaryMetric label="Top 10 average" value={playerCount ? `${topTenAverage} pts` : "—"} detail="Current scoring pace near the front" accent="#86efac" />
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: isTablet ? "1fr" : "minmax(0,1.1fr) 320px", gap: 16 }}>
        <div
          style={{
            borderRadius: SECTION_RADIUS,
            border: PANEL_BORDER,
            background: PANEL_BG,
            overflow: "hidden",
            boxShadow: SOFT_SHADOW,
          }}
        >
          <div
            style={{
              padding: "18px 20px",
              borderBottom: `1px solid ${HAIRLINE}`,
              background: PANEL_BG_ALT,
              display: "flex",
              justifyContent: "space-between",
              gap: 14,
              alignItems: "flex-end",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 5 }}>
                Global table
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: -1.1, marginBottom: 6 }}>Every player ranked by live points</div>
              <div style={{ fontSize: 13, color: MUTED_TEXT }}>
                No placeholders here. This table is driven by the same `profiles.points` field used across leagues and profile rank.
              </div>
            </div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT }}>
              Updated from live app data
            </div>
          </div>

          {error ? (
            <div style={{ padding: 22, fontSize: 14, color: "#fca5a5" }}>{error}</div>
          ) : loading ? (
            <div style={{ padding: 22, fontSize: 14, color: MUTED_TEXT }}>Loading leaderboard…</div>
          ) : !rankedPlayers.length ? (
            <div style={{ padding: 22, fontSize: 14, color: MUTED_TEXT }}>No ranked players yet. Once users start locking picks and scoring points, the board will fill automatically.</div>
          ) : (
            <div style={{ display: "grid", gap: 1, background: HAIRLINE, overflowX: isMobile ? "auto" : "visible" }}>
              {rankedPlayers.map((profile) => {
                const accent = teamAccent(profile.favorite_team);
                const isLeader = profile.rank === 1;
                const isCurrentUser = !!user && profile.id === user.id;

                return (
                  <div
                    key={profile.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: isMobile ? "64px minmax(240px,1fr) 94px" : "72px minmax(280px,1fr) 150px 118px",
                      gap: 0,
                      background: isCurrentUser
                        ? "linear-gradient(180deg,rgba(249,115,22,0.06),#0c1525)"
                        : isLeader
                          ? "linear-gradient(180deg,rgba(255,255,255,0.02),#0c1525)"
                          : PANEL_BG,
                      alignItems: "stretch",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", borderRight: `1px solid ${HAIRLINE}` }}>
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 14,
                          background: isCurrentUser ? "rgba(249,115,22,0.14)" : isLeader ? `${accent}26` : PANEL_BG_ALT,
                          border: `1px solid ${isCurrentUser ? "rgba(249,115,22,0.35)" : isLeader ? `${accent}44` : "rgba(148,163,184,0.14)"}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 14,
                          fontWeight: 900,
                        }}
                      >
                        {profile.rank}
                      </div>
                    </div>

                    <div style={{ padding: "16px 18px 15px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                        <AvatarChip name={profile.username} colorKey={profile.avatar_color} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                            <div style={{ fontSize: 17, fontWeight: 900, letterSpacing: -0.4, minWidth: 0 }}>{profile.username}</div>
                            {isCurrentUser && (
                              <span style={{ padding: "4px 8px", borderRadius: 999, background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.2)", fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#fed7aa" }}>
                                You
                              </span>
                            )}
                          </div>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: MUTED_TEXT }}>
                            <span style={{ width: 7, height: 7, borderRadius: "50%", background: accent }} />
                            {formatSupportLabel(profile.favorite_team)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {!isMobile && (
                      <div style={{ borderLeft: `1px solid ${HAIRLINE}`, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "12px 10px" }}>
                        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 5 }}>
                          Gap
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 900 }}>
                          {leader ? (profile.rank === 1 ? "Leader" : `-${(leader.points || 0) - (profile.points || 0)}`) : "—"}
                        </div>
                      </div>
                    )}

                    <div style={{ borderLeft: `1px solid ${HAIRLINE}`, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "12px 10px" }}>
                      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 5 }}>
                        Points
                      </div>
                      <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: -0.8 }}>{profile.points || 0}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <div style={{ borderRadius: CARD_RADIUS, border: PANEL_BORDER, background: PANEL_BG, boxShadow: SOFT_SHADOW, overflow: "hidden" }}>
            <div style={{ padding: "16px 18px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 4 }}>
                Podium snapshot
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: -0.6 }}>Front of the global board</div>
            </div>
            <div style={{ display: "grid", gap: 10, padding: 14 }}>
              {rankedPlayers.slice(0, 3).map((profile) => (
                <div key={profile.id} style={{ borderRadius: 18, border: "1px solid rgba(148,163,184,0.14)", background: PANEL_BG_ALT, padding: "14px 14px 13px", boxShadow: EDGE_RING }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 7 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <AvatarChip name={profile.username} colorKey={profile.avatar_color} size={34} radius={12} fontSize={11} />
                      <div style={{ fontSize: 14, fontWeight: 800, minWidth: 0 }}>{profile.username}</div>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 900, color: "#f8fafc" }}>P{profile.rank}</div>
                  </div>
                  <div style={{ fontSize: 12, color: MUTED_TEXT }}>{profile.points || 0} pts · {formatSupportLabel(profile.favorite_team)}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ borderRadius: CARD_RADIUS, border: PANEL_BORDER, background: PANEL_BG, boxShadow: SOFT_SHADOW, overflow: "hidden" }}>
            <div style={{ padding: "16px 18px", borderBottom: `1px solid ${HAIRLINE}`, background: PANEL_BG_ALT }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 4 }}>
                Support trends
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: -0.6 }}>Most-backed teams on the board</div>
            </div>
            <div style={{ padding: 18 }}>
              {!supportLeaders.length ? (
                <div style={{ fontSize: 13, lineHeight: 1.8, color: MUTED_TEXT }}>No support-team data yet. Once players choose a team in profile, the distribution will show here.</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {supportLeaders.map((entry) => (
                    <div key={entry.team} style={{ borderRadius: 16, border: "1px solid rgba(148,163,184,0.14)", background: PANEL_BG_ALT, padding: "13px 14px 12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 6 }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 800 }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: teamAccent(entry.team) }} />
                          {entry.team}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 900 }}>{entry.count}</div>
                      </div>
                      <div style={{ fontSize: 12, lineHeight: 1.7, color: MUTED_TEXT }}>{entry.totalPoints} total points across supporters</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
