import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import {
  ACCENT,
  BRAND_GRADIENT,
  CARD_RADIUS,
  CONTENT_MAX,
  DEFAULT_AVATAR_COLOR,
  EDGE_RING,
  HAIRLINE,
  LIFTED_SHADOW,
  MUTED_TEXT,
  PANEL_BG,
  PANEL_BG_ALT,
  PANEL_BORDER,
  SOFT_SHADOW,
  SUBTLE_TEXT,
  avatarTheme,
  teamSupportKey,
} from "@/src/constants/design";
import { requireActiveSession } from "@/src/shell/authProfile";
import useViewport from "@/src/lib/useViewport";
import usePageMetadata from "@/src/lib/usePageMetadata";
import PageHeader from "@/src/ui/PageHeader";
import ProPip from "@/src/ui/ProPip";

// ─── Seed posts (shown when category has no real posts yet) ──────────────────

const SEED_POSTS = {
  race_discussion: [
    {
      id: "seed-rd-1",
      author_name: "paddockwatch",
      title: "Norris on race pace — is this the real turning point?",
      body: "Qualifying lap was good but the long runs in practice told the real story. MCL39 looked significantly quicker on used mediums than anyone else. I'm going Norris race winner regardless of where he qualifies.",
      created_at: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
      _seed: true,
      _comments: [
        { id: "sc-1", author_name: "grid_lurker", body: "Agree. Red Bull on race pace is nowhere near what it was in 2023. The car is a handful on the softs now.", created_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString() },
        { id: "sc-2", author_name: "tifosi_takes", body: "McLaren 1-2 is genuinely on the table. Piastri looked calm all weekend.", created_at: new Date(Date.now() - 2.5 * 3600 * 1000).toISOString() },
      ],
    },
    {
      id: "seed-rd-2",
      author_name: "apex_anon",
      title: "Who's brave enough to take the DNF pick this weekend?",
      body: "I've been burned twice already this season but Gasly feels overdue. Quiet weekend, no drama, car's been borderline all year. Could also make a case for Stroll — he's been invisible.",
      created_at: new Date(Date.now() - 9 * 3600 * 1000).toISOString(),
      _seed: true,
      _comments: [
        { id: "sc-3", author_name: "pitwall_pro", body: "Stroll for me. That car has looked nervous on the kerbs all season and this circuit punishes that.", created_at: new Date(Date.now() - 8 * 3600 * 1000).toISOString() },
        { id: "sc-4", author_name: "paddockwatch", body: "Gasly OR Albon. Both teams have reliability issues queued up behind the scenes.", created_at: new Date(Date.now() - 7 * 3600 * 1000).toISOString() },
      ],
    },
    {
      id: "seed-rd-3",
      author_name: "tifosi_takes",
      title: "Hamilton to Ferrari was the right call and the data backs it up",
      body: "Week 1 everyone wrote him off. Midway through the season he's top 5 in the standings and Ferrari are regularly fighting for the podium. The narrative flipped fast.",
      created_at: new Date(Date.now() - 26 * 3600 * 1000).toISOString(),
      _seed: true,
      _comments: [
        { id: "sc-5", author_name: "apex_anon", body: "The car suits him more than Leclerc's setup preferences. That's the uncomfortable truth.", created_at: new Date(Date.now() - 25 * 3600 * 1000).toISOString() },
      ],
    },
  ],
  feature_requests: [
    {
      id: "seed-fr-1",
      author_name: "grid_lurker",
      title: "Split comparison: my picks vs top 10 average after each race",
      body: "After scoring I'd love to see a breakdown of how my picks compared to the community average. Did I take more risk on the volatile categories? Was I contrarian on pole? Useful to see where you diverge.",
      created_at: new Date(Date.now() - 18 * 3600 * 1000).toISOString(),
      vote_score: 14,
      _seed: true,
      _comments: [
        { id: "sc-6", author_name: "pitwall_pro", body: "Yes. Even just seeing 'you were in the top 20% on DNF accuracy' would be useful context.", created_at: new Date(Date.now() - 17 * 3600 * 1000).toISOString() },
        { id: "sc-7", author_name: "tifosi_takes", body: "Upvoted. Would also help identify if I'm consistently too conservative on the high-variance categories.", created_at: new Date(Date.now() - 16 * 3600 * 1000).toISOString() },
      ],
    },
    {
      id: "seed-fr-2",
      author_name: "pitwall_pro",
      title: "Push notification 30 minutes before picks lock",
      body: "I missed lock in Singapore because I forgot the time zone change. A 30-minute reminder notification would fix this every time. Especially useful for races that aren't on your home schedule.",
      created_at: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
      vote_score: 9,
      _seed: true,
      _comments: [
        { id: "sc-8", author_name: "grid_lurker", body: "This needs to exist. Missed two locks this year because of exactly this.", created_at: new Date(Date.now() - 35 * 3600 * 1000).toISOString() },
      ],
    },
    {
      id: "seed-fr-3",
      author_name: "apex_anon",
      title: "Show each pick's historical accuracy next to the input",
      body: "When I'm filling in the pole pick, show me that I've been right 3/7 times on pole historically. Small addition but would stop me from just going on gut every time.",
      created_at: new Date(Date.now() - 52 * 3600 * 1000).toISOString(),
      vote_score: 6,
      _seed: true,
      _comments: [],
    },
  ],
  general: [
    {
      id: "seed-gen-1",
      author_name: "pitwall_pro",
      title: "New to Stint — any tips for the first few races?",
      body: "Just signed up before this weekend. Still getting my head around the scoring. Is DNF a trap or is it actually worth going for? And does pole matter as much as race winner for points?",
      created_at: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
      _seed: true,
      _comments: [
        { id: "sc-9", author_name: "paddockwatch", body: "DNF is high risk — only go for it if you have a strong read. Pole and race winner are the safest entry points to start building your score.", created_at: new Date(Date.now() - 5 * 3600 * 1000).toISOString() },
        { id: "sc-10", author_name: "tifosi_takes", body: "Don't neglect fastest lap. It's more predictable than people think — look at who's on fresh tyres late in the race.", created_at: new Date(Date.now() - 4.5 * 3600 * 1000).toISOString() },
        { id: "sc-11", author_name: "grid_lurker", body: "Also: the safety car pick is either 0 or 1. Circuits like Monaco and Singapore it's almost always worth taking.", created_at: new Date(Date.now() - 4 * 3600 * 1000).toISOString() },
      ],
    },
    {
      id: "seed-gen-2",
      author_name: "grid_lurker",
      title: "Which constructor is the biggest steal in picks right now?",
      body: "Ferrari have been consistently undervalued by the community average in the constructor pick. They're consistently P2 or better in constructor points but people keep picking Red Bull out of habit.",
      created_at: new Date(Date.now() - 30 * 3600 * 1000).toISOString(),
      _seed: true,
      _comments: [
        { id: "sc-12", author_name: "apex_anon", body: "McLaren is my answer. People sleep on them because Hamilton isn't there but Norris + Piastri is a solid lineup.", created_at: new Date(Date.now() - 29 * 3600 * 1000).toISOString() },
      ],
    },
  ],
};

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  {
    key: "race_discussion",
    label: "Race Discussion",
    kicker: "Opinions, takes, weekend banter",
    emptyTitle: "No race discussion yet",
    emptyBody: "Start the first thread about this weekend's race.",
    placeholder: "Share your take on the race weekend...",
  },
  {
    key: "feature_requests",
    label: "Feature Requests",
    kicker: "Suggest improvements to Stint",
    emptyTitle: "No feature requests yet",
    emptyBody: "Be the first to suggest a new Stint feature.",
    placeholder: "Describe the feature you'd like to see...",
    hasVoting: true,
  },
  {
    key: "general",
    label: "General",
    kicker: "Anything F1 or Stint related",
    emptyTitle: "No general posts yet",
    emptyBody: "Start a conversation about anything F1 or Stint.",
    placeholder: "Start a conversation...",
  },
];

const avatarPalette = [
  ["#94a3b8", "#e2e8f0"],
  ["#64748b", "#dbe4f0"],
  ["#0f766e", "#ccfbf1"],
  ["#1d4ed8", "#dbeafe"],
  ["#475569", "#f8fafc"],
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function normalizeProfile(profile) {
  if (!profile) return profile;
  const favoriteTeam = profile.favorite_team || null;
  const avatarColor =
    profile.avatar_color ||
    (favoriteTeam ? teamSupportKey(favoriteTeam) : DEFAULT_AVATAR_COLOR);
  return { ...profile, favorite_team: favoriteTeam, avatar_color: avatarColor };
}

const MOCK_PRO_USERNAMES = new Set([
  "grid_racer_hk",
  "pitwall_pro",
  "apexhunter_v",
  "tyre_whisperer",
  "overcut_king",
  "drs_zone_r",
  "stint_veteran",
  "paddock_analyst",
  "lauda_line",
  "box_box_bella",
]);

function isProIdentity(profile, fallbackName = "") {
  const username = String(profile?.username || fallbackName || "").trim().toLowerCase();
  return profile?.subscription_status === "pro" || MOCK_PRO_USERNAMES.has(username);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function AvatarChip({ name, colorKey, size = 32, radius = 10, fontSize = 11, pro = false }) {
  const theme = colorKey ? avatarTheme(colorKey) : null;
  const [bg, color] = theme ? [theme.fill, theme.text] : avatarTone(name);
  const border = theme ? theme.border : `${bg}44`;
  const badgeSize = Math.max(12, Math.round(size * 0.42));
  return (
    <div style={{ width: size, height: size, position: "relative", flexShrink: 0 }}>
      <div
        style={{
          width: "100%",
          height: "100%",
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
        }}
      >
        {(name || "?").slice(0, 2).toUpperCase()}
      </div>
      {pro && (
        <ProPip size={badgeSize} style={{ position: "absolute", right: -2, bottom: -2 }} />
      )}
    </div>
  );
}

function VoteButtons({ postId, score, userVote, isOwn, disabled, onVote }) {
  const upActive = userVote === 1;
  const downActive = userVote === -1;
  const btnBase = {
    width: 30,
    height: 30,
    borderRadius: 8,
    border: "1px solid rgba(148,163,184,0.16)",
    background: "rgba(255,255,255,0.03)",
    cursor: isOwn || disabled ? "not-allowed" : "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    lineHeight: 1,
    transition: "background 140ms ease, border-color 140ms ease",
    opacity: isOwn ? 0.38 : 1,
  };

  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}
      title={isOwn ? "You can't vote on your own post" : undefined}
    >
      <button
        onClick={(e) => { e.stopPropagation(); if (!isOwn && !disabled) onVote(postId, upActive ? 0 : 1); }}
        style={{
          ...btnBase,
          background: upActive ? `${ACCENT}22` : btnBase.background,
          borderColor: upActive ? `${ACCENT}66` : btnBase.border,
          color: upActive ? ACCENT : MUTED_TEXT,
        }}
        aria-label="Upvote"
      >
        ▲
      </button>
      <span style={{ fontSize: 13, fontWeight: 900, minWidth: 20, textAlign: "center", color: score > 0 ? "#86efac" : score < 0 ? "#fca5a5" : MUTED_TEXT }}>
        {score}
      </span>
      <button
        onClick={(e) => { e.stopPropagation(); if (!isOwn && !disabled) onVote(postId, downActive ? 0 : -1); }}
        style={{
          ...btnBase,
          background: downActive ? "rgba(239,68,68,0.14)" : btnBase.background,
          borderColor: downActive ? "rgba(239,68,68,0.4)" : btnBase.border,
          color: downActive ? "#fca5a5" : MUTED_TEXT,
        }}
        aria-label="Downvote"
      >
        ▼
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function GridPage({ user, openAuth, demoMode = false }) {
  const { isMobile, isTablet } = useViewport();
  const demoPreview = demoMode && !user;

  const [category, setCategory] = useState("race_discussion");
  const [posts, setPosts] = useState([]);
  const [comments, setComments] = useState({});
  const [authorProfiles, setAuthorProfiles] = useState({});
  const [userVotes, setUserVotes] = useState({});
  const [postScores, setPostScores] = useState({});
  const [expandedPostId, setExpandedPostId] = useState(null);
  const [replyText, setReplyText] = useState({});
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [draft, setDraft] = useState({ title: "", body: "" });
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [votingPostId, setVotingPostId] = useState(null);
  const [hoveredPostId, setHoveredPostId] = useState(null);
  const [totalPostCount, setTotalPostCount] = useState(0);

  const activeCat = useMemo(() => CATEGORIES.find((c) => c.key === category), [category]);

  usePageMetadata({
    title: "The Grid — F1 Community",
    description: "Race takes, feature requests, and F1 discussion. The Grid is Stint's public community space.",
    path: "/grid",
  });

  // ─── Data loading ──────────────────────────────────────────────────────────

  useEffect(() => {
    let ignore = false;

    async function load() {
      setLoading(true);
      setExpandedPostId(null);
      setShowCreateForm(false);

      const isFeatureReq = category === "feature_requests";

      // Try post_with_scores view for feature requests (includes vote_score).
      // Fall back to regular posts table if view doesn't exist yet.
      let fetchedPosts = [];
      let scores = {};

      if (isFeatureReq) {
        const { data: scoredData, error: scoredError } = await supabase
          .from("post_with_scores")
          .select("*")
          .is("league_id", null)
          .eq("category", category)
          .order("vote_score", { ascending: false })
          .limit(80);

        if (!scoredError && scoredData) {
          fetchedPosts = scoredData;
          scoredData.forEach((p) => { scores[p.id] = p.vote_score ?? 0; });
        } else {
          // Fallback if view doesn't exist
          const { data: fallback } = await supabase
            .from("posts")
            .select("*")
            .is("league_id", null)
            .eq("category", category)
            .order("created_at", { ascending: false })
            .limit(80);
          fetchedPosts = fallback || [];
        }
      } else {
        const { data } = await supabase
          .from("posts")
          .select("*")
          .is("league_id", null)
          .eq("category", category)
          .order("created_at", { ascending: false })
          .limit(80);
        fetchedPosts = data || [];
      }

      if (ignore) return;

      setPosts(fetchedPosts);
      setPostScores(scores);

      // Hydrate author profiles
      const ids = [...new Set(fetchedPosts.map((p) => p.author_id).filter(Boolean))];
      if (ids.length) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id,username,avatar_color,favorite_team,favorite_driver,points,subscription_status")
          .in("id", ids);
        if (profileData && !ignore) {
          setAuthorProfiles((prev) => ({
            ...prev,
            ...Object.fromEntries(profileData.map((p) => [p.id, normalizeProfile(p)])),
          }));
        }
      }

      // Fetch total count across all categories for header stat
      const { count } = await supabase
        .from("posts")
        .select("id", { count: "exact", head: true })
        .is("league_id", null);
      if (!ignore) setTotalPostCount(count || 0);

      setLoading(false);
    }

    load();
    return () => { ignore = true; };
  }, [category]);

  // Fetch the current user's votes whenever posts change (Feature Requests only)
  useEffect(() => {
    if (!user || category !== "feature_requests" || !posts.length) return;
    const postIds = posts.map((p) => p.id);

    supabase
      .from("post_votes")
      .select("post_id,vote")
      .eq("user_id", user.id)
      .in("post_id", postIds)
      .then(({ data }) => {
        if (!data) return;
        const votes = {};
        data.forEach((v) => { votes[v.post_id] = v.vote; });
        setUserVotes((prev) => ({ ...prev, ...votes }));
      });
  }, [user, category, posts]);

  // ─── Actions ───────────────────────────────────────────────────────────────

  async function loadComments(postId) {
    const { data, error } = await supabase
      .from("comments")
      .select("*")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (error || !data) return;
    setComments((prev) => ({ ...prev, [postId]: data }));

    const ids = [...new Set(data.map((c) => c.author_id).filter(Boolean))];
    if (ids.length) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id,username,avatar_color,favorite_team,subscription_status")
        .in("id", ids);
      if (profileData) {
        setAuthorProfiles((prev) => ({
          ...prev,
          ...Object.fromEntries(profileData.map((p) => [p.id, normalizeProfile(p)])),
        }));
      }
    }
  }

  function toggleThread(postId, isSeedPost = false) {
    if (expandedPostId === postId) {
      setExpandedPostId(null);
      return;
    }
    setExpandedPostId(postId);
    if (!isSeedPost && !comments[postId]) loadComments(postId);
  }

  async function submitPost() {
    if (demoPreview || posting) return;
    if (!draft.title.trim() || !draft.body.trim() || !user) return;
    const session = await requireActiveSession();
    if (!session) return openAuth("login");

    setPosting(true);
    const { error } = await supabase.from("posts").insert({
      author_id: user.id,
      author_name: user.username,
      title: draft.title.trim(),
      body: draft.body.trim(),
      category,
    });
    setPosting(false);

    if (error) {
      alert(error.message);
      return;
    }

    setDraft({ title: "", body: "" });
    setShowCreateForm(false);

    // Reload current category
    setCategory((c) => c); // trigger useEffect by forcing same value re-run via trick below
    // Directly re-fetch instead:
    const isFeatureReq = category === "feature_requests";
    if (isFeatureReq) {
      const { data } = await supabase
        .from("post_with_scores")
        .select("*")
        .is("league_id", null)
        .eq("category", category)
        .order("vote_score", { ascending: false })
        .limit(80);
      if (data) {
        const scores = {};
        data.forEach((p) => { scores[p.id] = p.vote_score ?? 0; });
        setPosts(data);
        setPostScores(scores);
      }
    } else {
      const { data } = await supabase
        .from("posts")
        .select("*")
        .is("league_id", null)
        .eq("category", category)
        .order("created_at", { ascending: false })
        .limit(80);
      if (data) setPosts(data);
    }
  }

  async function submitReply(postId) {
    if (demoPreview) return;
    if (!replyText[postId]?.trim() || !user) return;
    const session = await requireActiveSession();
    if (!session) return openAuth("login");

    const { error } = await supabase.from("comments").insert({
      post_id: postId,
      author_id: user.id,
      author_name: user.username,
      body: replyText[postId].trim(),
    });

    if (error) {
      alert(error.message);
      return;
    }
    setReplyText((prev) => ({ ...prev, [postId]: "" }));
    loadComments(postId);
  }

  async function handleVote(postId, newVote) {
    if (!user) return openAuth("login");
    if (votingPostId === postId) return;

    // Optimistic update
    const prevVote = userVotes[postId] ?? 0;
    const prevScore = postScores[postId] ?? 0;
    const scoreDelta = newVote - prevVote;

    setUserVotes((prev) => ({ ...prev, [postId]: newVote }));
    setPostScores((prev) => ({ ...prev, [postId]: (prev[postId] ?? 0) + scoreDelta }));
    setPosts((prev) =>
      prev.map((p) => p.id === postId ? { ...p, vote_score: (p.vote_score ?? 0) + scoreDelta } : p)
    );

    setVotingPostId(postId);

    try {
      if (newVote === 0) {
        const { error } = await supabase
          .from("post_votes")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("post_votes")
          .upsert(
            { post_id: postId, user_id: user.id, vote: newVote, updated_at: new Date().toISOString() },
            { onConflict: "post_id,user_id" }
          );
        if (error) throw error;
      }
    } catch {
      // Revert on failure
      setUserVotes((prev) => ({ ...prev, [postId]: prevVote }));
      setPostScores((prev) => ({ ...prev, [postId]: prevScore }));
      setPosts((prev) =>
        prev.map((p) => p.id === postId ? { ...p, vote_score: prevScore } : p)
      );
    } finally {
      setVotingPostId(null);
    }
  }

  // ─── Render helpers ────────────────────────────────────────────────────────

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

  function renderThreadList() {
    if (loading) {
      return (
        <div style={{ padding: "40px 0", textAlign: "center", color: MUTED_TEXT, fontSize: 14 }}>
          Loading...
        </div>
      );
    }

    const displayPosts = posts.length ? posts : (SEED_POSTS[category] || []);
    const isSeed = !posts.length;

    if (!displayPosts.length) {
      return (
        <div style={{ borderRadius: 18, border: PANEL_BORDER, background: PANEL_BG, padding: 32, textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 8 }}>{activeCat?.emptyTitle}</div>
          <div style={{ fontSize: 13, lineHeight: 1.7, color: MUTED_TEXT }}>{activeCat?.emptyBody}</div>
        </div>
      );
    }

    return (
      <div style={{ display: "grid", gap: 10 }}>
        {displayPosts.map((post) => {
          const open = expandedPostId === post.id;
          const postComments = post._seed ? (post._comments || []) : (comments[post.id] || []);
          const isOwn = !post._seed && post.author_id === user?.id;
          const score = postScores[post.id] ?? post.vote_score ?? 0;
          const userVote = userVotes[post.id] ?? 0;

          return (
            <div
              key={post.id}
              style={{
                borderRadius: CARD_RADIUS,
                border: open ? "1px solid rgba(248,250,252,0.14)" : PANEL_BORDER,
                background: open ? PANEL_BG_ALT : hoveredPostId === post.id ? "rgba(255,255,255,0.04)" : PANEL_BG,
                overflow: "hidden",
                boxShadow: open ? EDGE_RING : "none",
                transition: "background 180ms ease, border-color 180ms ease",
              }}
            >
              {/* Post header */}
              <div
                style={{ padding: "15px 16px", cursor: "pointer" }}
                onMouseEnter={() => setHoveredPostId(post.id)}
                onMouseLeave={() => setHoveredPostId(null)}
                onClick={() => toggleThread(post.id, !!post._seed)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleThread(post.id, !!post._seed); } }}
                role="button"
                tabIndex={0}
              >
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  {activeCat?.hasVoting && (
                    <VoteButtons
                      postId={post.id}
                      score={score}
                      userVote={userVote}
                      isOwn={isOwn}
                      disabled={!user || !!votingPostId}
                      onVote={handleVote}
                    />
                  )}
                  <AvatarChip name={post.author_name} colorKey={authorProfiles[post.author_id]?.avatar_color} pro={isProIdentity(authorProfiles[post.author_id], post.author_name)} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 5, flexWrap: "wrap" }}>
                      <div style={{ fontSize: 12, fontWeight: 800 }}>{post.author_name}</div>
                      <div style={{ fontSize: 10, color: SUBTLE_TEXT }}>{formatStamp(post.created_at)}</div>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: -0.3, marginBottom: 5, lineHeight: 1.3 }}>{post.title}</div>
                    {!open && post.body && (
                      <div style={{ fontSize: 13, lineHeight: 1.62, color: MUTED_TEXT, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                        {post.body}
                      </div>
                    )}
                    {!open && (
                      <div style={{ marginTop: 8, display: "flex", gap: 10, alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: SUBTLE_TEXT, fontWeight: 700 }}>
                          {postComments.length > 0 ? `${postComments.length} repl${postComments.length === 1 ? "y" : "ies"}` : "Reply"}
                        </span>
                        <span style={{ fontSize: 11, color: open ? ACCENT : SUBTLE_TEXT, fontWeight: 700 }}>
                          {open ? "↑ Close" : "↓ Open"}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded thread */}
              {open && (
                <div style={{ borderTop: `1px solid ${HAIRLINE}`, background: "rgba(0,0,0,0.14)" }}>
                  {/* Full post body */}
                  <div style={{ padding: "14px 16px", borderBottom: postComments.length ? `1px solid ${HAIRLINE}` : "none" }}>
                    <div style={{ fontSize: 14, lineHeight: 1.72, color: MUTED_TEXT, whiteSpace: "pre-wrap" }}>
                      {post.body}
                    </div>
                  </div>

                  {/* Comments */}
                  {postComments.length > 0 && (
                    <div style={{ padding: "12px 16px 0" }}>
                      {postComments.map((comment, index) => (
                        <div
                          key={comment.id}
                          style={{
                            display: "flex",
                            gap: 10,
                            padding: "10px 0",
                            borderBottom: index < postComments.length - 1 ? `1px solid ${HAIRLINE}` : "none",
                          }}
                        >
                          <AvatarChip name={comment.author_name} colorKey={authorProfiles[comment.author_id]?.avatar_color} size={28} radius={8} fontSize={10} pro={isProIdentity(authorProfiles[comment.author_id], comment.author_name)} />
                          <div style={{ flex: 1, minWidth: 0 }}>
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

                  {/* Reply box — hidden for seed posts */}
                  {!post._seed && (
                    <div style={{ padding: "12px 16px 14px", display: "flex", gap: 8, alignItems: "center" }}>
                      {user ? (
                        <>
                          <input
                            style={{ ...inputStyle, padding: "9px 11px", fontSize: 12, flex: 1 }}
                            placeholder="Reply..."
                            value={replyText[post.id] || ""}
                            onChange={(e) => setReplyText((prev) => ({ ...prev, [post.id]: e.target.value }))}
                            onKeyDown={(e) => e.key === "Enter" && submitReply(post.id)}
                          />
                          <button
                            onClick={() => submitReply(post.id)}
                            style={{ background: BRAND_GRADIENT, border: "none", borderRadius: 10, color: "#fff", cursor: "pointer", fontWeight: 800, fontSize: 12, padding: "9px 12px", flexShrink: 0 }}
                          >
                            Reply
                          </button>
                        </>
                      ) : demoPreview ? (
                        <div style={{ fontSize: 12, color: MUTED_TEXT }}>Preview mode — posting disabled.</div>
                      ) : (
                        <div style={{ fontSize: 12, color: MUTED_TEXT }}>
                          <span style={{ color: "#fff", fontWeight: 800, cursor: "pointer" }} onClick={() => openAuth("login")}>Log in</span>
                          {" "}to join the discussion.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // ─── Layout ────────────────────────────────────────────────────────────────

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
      <PageHeader
        eyebrow="The Grid"
        title={(
          <>
            Talk the race.
            <br />
            Shape the product.
          </>
        )}
        description="Race takes, feature ideas, and general F1 chat — all in one place."
        aside={(
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 10 }}>
            {[
              [String(totalPostCount || 0), "threads"],
              [String(CATEGORIES.length), "categories"],
              [loading ? "..." : user ? "can post" : "read-only", "access"],
            ].map(([value, label]) => (
              <div key={label} style={{ borderRadius: 16, border: "1px solid rgba(148,163,184,0.14)", background: "rgba(255,255,255,0.02)", padding: "13px 14px" }}>
                <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: -0.6 }}>{value}</div>
                <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>
        )}
        asideWidth={360}
        marginBottom={18}
        bgImage="/images/Grid lights.png"
      />

      <section
        style={{
          borderRadius: 28,
          border: PANEL_BORDER,
          background: PANEL_BG,
          overflow: "hidden",
          marginBottom: 18,
          boxShadow: LIFTED_SHADOW,
        }}
      >
        <div style={{ padding: "12px 24px", background: PANEL_BG, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setCategory(cat.key)}
              style={{
                background: category === cat.key ? "linear-gradient(180deg,rgba(255,255,255,0.1),#111c30)" : PANEL_BG_ALT,
                border: category === cat.key ? "1px solid rgba(248,250,252,0.16)" : "1px solid rgba(148,163,184,0.12)",
                borderRadius: 12,
                color: category === cat.key ? "#fff" : MUTED_TEXT,
                cursor: "pointer",
                fontWeight: 800,
                fontSize: 12,
                padding: "9px 12px",
                transition: "border-color 180ms ease, color 180ms ease",
                whiteSpace: "nowrap",
              }}
            >
              {cat.label}
              {cat.hasVoting && (
                <span style={{ marginLeft: 6, fontSize: 10, color: category === cat.key ? ACCENT : SUBTLE_TEXT }}>▲▼</span>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* ── Category body ── */}
      <section>
        {/* Category header + New Post button */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
            marginBottom: 14,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 6 }}>
              {activeCat?.kicker}
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.6 }}>{activeCat?.label}</div>
          </div>

          {user ? (
            <button
              onClick={() => setShowCreateForm((v) => !v)}
              style={{
                background: showCreateForm ? PANEL_BG_ALT : BRAND_GRADIENT,
                border: showCreateForm ? "1px solid rgba(148,163,184,0.18)" : "none",
                borderRadius: 12,
                color: "#fff",
                cursor: "pointer",
                fontWeight: 800,
                padding: "10px 16px",
                fontSize: 13,
                flexShrink: 0,
              }}
            >
              {showCreateForm ? "Cancel" : `+ New post`}
            </button>
          ) : demoPreview ? null : (
            <button
              onClick={() => openAuth("login")}
              style={{
                background: PANEL_BG_ALT,
                border: "1px solid rgba(148,163,184,0.12)",
                borderRadius: 12,
                color: "#fff",
                cursor: "pointer",
                fontWeight: 800,
                padding: "10px 16px",
                fontSize: 13,
              }}
            >
              Log in to post
            </button>
          )}
        </div>

        {/* Create post form */}
        {showCreateForm && (
          <div
            style={{
              borderRadius: CARD_RADIUS,
              border: PANEL_BORDER,
              background: PANEL_BG,
              padding: 18,
              marginBottom: 16,
              boxShadow: SOFT_SHADOW,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: SUBTLE_TEXT, marginBottom: 12 }}>
              New post in {activeCat?.label}
            </div>
            <input
              style={{ ...inputStyle, marginBottom: 10 }}
              placeholder="Post title"
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            />
            <textarea
              style={{ ...inputStyle, minHeight: 92, resize: "vertical", marginBottom: 12 }}
              placeholder={activeCat?.placeholder}
              value={draft.body}
              onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
            />
            <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "flex-end" }}>
              <div style={{ fontSize: 12, color: SUBTLE_TEXT, flex: 1 }}>
                Posting in <strong style={{ color: "#fff" }}>{activeCat?.label}</strong>
                {activeCat?.hasVoting && " · visible to all · community can vote"}
              </div>
              <button
                onClick={submitPost}
                disabled={posting || !draft.title.trim() || !draft.body.trim()}
                style={{
                  background: posting || !draft.title.trim() || !draft.body.trim() ? "rgba(255,255,255,0.06)" : BRAND_GRADIENT,
                  border: "none",
                  borderRadius: 12,
                  color: "#fff",
                  cursor: posting ? "wait" : "pointer",
                  fontWeight: 800,
                  padding: "10px 18px",
                  fontSize: 13,
                  opacity: !draft.title.trim() || !draft.body.trim() ? 0.5 : 1,
                  transition: "opacity 180ms ease",
                }}
              >
                {posting ? "Publishing..." : "Publish"}
              </button>
            </div>
          </div>
        )}

        {/* Feature Requests sort note */}
        {activeCat?.hasVoting && !loading && posts.length > 0 && (
          <div style={{ fontSize: 12, color: SUBTLE_TEXT, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: ACCENT }}>▲▼</span>
            Sorted by community vote — upvote the features you want most.
            {!user && (
              <span>
                {" "}<span style={{ color: "#fff", fontWeight: 800, cursor: "pointer" }} onClick={() => openAuth("login")}>Log in</span> to vote.
              </span>
            )}
          </div>
        )}

        {renderThreadList()}
      </section>
    </div>
  );
}
