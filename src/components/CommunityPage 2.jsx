import { useState, useEffect } from "react";
import { supabase } from "../supabase";

export default function CommunityPage({ user, openAuth }) {
  const [tab, setTab] = useState("leaderboard");
  const [posts, setPosts] = useState([]);
  const [leagues, setLeagues] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [viewLeague, setViewLeague] = useState(null);
  const [np, setNp] = useState({ title: "", body: "" });
  const [nlg, setNlg] = useState("");
  const [jc, setJc] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [replyText, setReplyText] = useState({});
  const [comments, setComments] = useState({});
  const [loadingLB, setLoadingLB] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
    fetchPosts();
    if (user) fetchLeagues();
  }, [user]); // eslint-disable-line

  const fetchLeaderboard = async () => {
    setLoadingLB(true);
    const { data } = await supabase.from("profiles").select("username,points").order("points", { ascending: false }).limit(20);
    if (data) setLeaderboard(data);
    setLoadingLB(false);
  };

  const fetchPosts = async () => {
    const { data } = await supabase.from("posts").select("*").order("created_at", { ascending: false });
    if (data) setPosts(data);
  };

  const fetchComments = async (postId) => {
    const { data } = await supabase.from("comments").select("*").eq("post_id", postId).order("created_at", { ascending: true });
    if (data) setComments(c => ({ ...c, [postId]: data }));
  };

  const fetchLeagues = async () => {
    const { data } = await supabase.from("league_members").select("league_id,leagues(*)").eq("user_id", user.id);
    if (data) setLeagues(data.map(d => d.leagues));
  };

  const createLeague = async () => {
    if (!nlg.trim() || !user) return;
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    const { data, error } = await supabase.from("leagues").insert({ name: nlg, code, owner_id: user.id, is_public: false }).select().single();
    if (error) { alert("Error: " + error.message); return; }
    await supabase.from("league_members").insert({ league_id: data.id, user_id: user.id });
    setNlg(""); fetchLeagues();
  };

  const joinLeague = async () => {
    if (!jc.trim() || !user) return;
    const { data, error } = await supabase.from("leagues").select("*").eq("code", jc.toUpperCase()).single();
    if (error || !data) { alert("League not found."); return; }
    const { error: e2 } = await supabase.from("league_members").insert({ league_id: data.id, user_id: user.id });
    if (e2) { alert("Already in this league or error joining."); return; }
    setJc(""); fetchLeagues();
  };

  const leaveLeague = async (leagueId) => {
    if (!window.confirm("Leave this league?")) return;
    await supabase.from("league_members").delete().eq("league_id", leagueId).eq("user_id", user.id);
    fetchLeagues();
    if (viewLeague?.id === leagueId) setViewLeague(null);
  };

  const deleteLeague = async (leagueId) => {
    if (!window.confirm("Delete this league permanently?")) return;
    await supabase.from("leagues").delete().eq("id", leagueId);
    fetchLeagues();
    if (viewLeague?.id === leagueId) setViewLeague(null);
  };

  const submitPost = async () => {
    if (!np.title.trim() || !np.body.trim() || !user) return;
    await supabase.from("posts").insert({ author_id: user.id, author_name: user.username, title: np.title, body: np.body });
    setNp({ title: "", body: "" }); setShowForm(false); fetchPosts();
  };

  const submitReply = async (postId) => {
    if (!user || !replyText[postId]?.trim()) return;
    await supabase.from("comments").insert({ post_id: postId, author_id: user.id, author_name: user.username, body: replyText[postId] });
    setReplyText(r => ({ ...r, [postId]: "" })); fetchComments(postId);
  };

  const togglePost = async (id) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!comments[id]) fetchComments(id);
  };

  const inp = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", padding: "10px 13px", fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box", fontFamily: "inherit" };

  return (
    <div style={{ maxWidth: 1160, margin: "0 auto", padding: "52px 28px", position: "relative", zIndex: 1 }}>
      {viewLeague && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", zIndex: 600, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setViewLeague(null)}>
          <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid rgba(255,255,255,0.11)", background: "rgba(10,10,26,0.97)", width: 460, backdropFilter: "blur(20px)" }} onClick={e => e.stopPropagation()}>
            <div style={{ height: 3, background: "linear-gradient(90deg,#E8002D,#FF6B35)" }} />
            <div style={{ padding: "22px 24px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h2 style={{ margin: "0 0 4px", fontWeight: 900, fontSize: 20 }}>{viewLeague.name}</h2>
                <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ fontFamily: "monospace", fontWeight: 900, fontSize: 20, letterSpacing: 4, color: "#E8002D" }}>{viewLeague.code}</div>
                  <button onClick={() => navigator.clipboard?.writeText(viewLeague.code)} style={{ background: "rgba(232,0,45,0.1)", border: "1px solid rgba(232,0,45,0.25)", borderRadius: 6, color: "#E8002D", cursor: "pointer", fontSize: 10, fontWeight: 700, padding: "3px 8px" }}>COPY</button>
                </div>
              </div>
              <button onClick={() => setViewLeague(null)} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 7, color: "rgba(255,255,255,0.4)", cursor: "pointer", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>✕</button>
            </div>
            <div style={{ padding: "14px 24px", display: "flex", gap: 8 }}>
              {viewLeague.owner_id === user?.id
                ? <button onClick={() => deleteLeague(viewLeague.id)} style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.28)", borderRadius: 7, color: "#F87171", cursor: "pointer", fontSize: 12, fontWeight: 700, padding: "8px 14px", flex: 1 }}>Delete League</button>
                : <button onClick={() => leaveLeague(viewLeague.id)} style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.28)", borderRadius: 7, color: "#F87171", cursor: "pointer", fontSize: 12, fontWeight: 700, padding: "8px 14px", flex: 1 }}>Leave League</button>
              }
            </div>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 26 }}>
        <h1 style={{ fontSize: 34, fontWeight: 900, margin: "0 0 6px", letterSpacing: -1 }}>Community</h1>
        <p style={{ color: "rgba(255,255,255,0.38)", margin: 0, fontSize: 13 }}>Compete globally, build private leagues, and discuss every race</p>
      </div>

      <div style={{ display: "flex", gap: 1, marginBottom: 22, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        {[["leaderboard", "Leaderboard"], ["leagues", "Leagues"], ["forum", "Forum"]].map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)} style={{ background: "none", border: "none", borderBottom: `2px solid ${tab === t ? "#E8002D" : "transparent"}`, cursor: "pointer", padding: "11px 18px", fontSize: 13, fontWeight: tab === t ? 700 : 400, color: tab === t ? "#fff" : "rgba(255,255,255,0.38)", marginBottom: -1 }}>{l}</button>
        ))}
      </div>

      {tab === "leaderboard" && (
        <div style={{ borderRadius: 11, overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)" }}>
          {loadingLB ? (
            <div style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Loading...</div>
          ) : leaderboard.length === 0 ? (
            <div style={{ padding: 60, textAlign: "center" }}>
              <div style={{ fontSize: 36, marginBottom: 16 }}>🏆</div>
              <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>No players yet</div>
              <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 13 }}>Be the first to sign up and make predictions!</div>
            </div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "50px 1fr 80px", background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                {["#", "Player", "Points"].map((h, i) => (
                  <div key={h} style={{ padding: "10px 14px", fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.22)", textAlign: i === 2 ? "center" : "left" }}>{h}</div>
                ))}
              </div>
              {leaderboard.map((p, i) => (
                <div key={p.username} style={{ display: "grid", gridTemplateColumns: "50px 1fr 80px", borderBottom: i < leaderboard.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none", background: i === 0 ? "rgba(232,0,45,0.05)" : i % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent" }}>
                  <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: i < 3 ? 14 : 11, fontWeight: 900, color: i === 0 ? "#E8002D" : i === 1 ? "#9CA3AF" : i === 2 ? "#B87333" : "rgba(255,255,255,0.15)" }}>{i + 1}</div>
                  <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: "linear-gradient(135deg,#E8002D,#FF6B35)", opacity: 0.7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 900, color: "#fff", flexShrink: 0 }}>{p.username.slice(0, 2).toUpperCase()}</div>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{p.username}</span>
                  </div>
                  <div style={{ padding: "12px 14px", fontSize: 15, fontWeight: 900, textAlign: "center", color: i === 0 ? "#E8002D" : "rgba(255,255,255,0.88)", display: "flex", alignItems: "center", justifyContent: "center" }}>{p.points}</div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {tab === "leagues" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)", marginBottom: 11 }}>Create a League</div>
            <div style={{ borderRadius: 11, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.03)", padding: 18, marginBottom: 18 }}>
              <input style={{ ...inp, marginBottom: 11 }} placeholder="League name..." value={nlg} onChange={e => setNlg(e.target.value)} onKeyDown={e => e.key === "Enter" && (user ? createLeague() : openAuth("login"))} />
              <button style={{ background: "linear-gradient(135deg,#E8002D,#FF6B35)", border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", fontWeight: 700, width: "100%", padding: 11, fontSize: 13 }} onClick={user ? createLeague : () => openAuth("login")}>{user ? "Create League" : "Login to Create"}</button>
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)", marginBottom: 11 }}>Join with Code</div>
            <div style={{ borderRadius: 11, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.03)", padding: 18 }}>
              <input style={{ ...inp, marginBottom: 11, fontFamily: "monospace", fontSize: 20, textTransform: "uppercase", letterSpacing: 6, textAlign: "center" }} placeholder="XXXXXX" value={jc} onChange={e => setJc(e.target.value.toUpperCase())} maxLength={6} onKeyDown={e => e.key === "Enter" && (user ? joinLeague() : openAuth("login"))} />
              <button style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", cursor: "pointer", fontWeight: 700, width: "100%", padding: 11, fontSize: 13 }} onClick={user ? joinLeague : () => openAuth("login")}>{user ? "Join League" : "Login to Join"}</button>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)", marginBottom: 11 }}>Your Leagues {leagues.length > 0 && `(${leagues.length})`}</div>
            {leagues.length === 0
              ? <div style={{ borderRadius: 11, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.03)", padding: 32, textAlign: "center", color: "rgba(255,255,255,0.22)", fontSize: 13 }}>Create or join a league to compete with friends</div>
              : <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {leagues.map(l => (
                  <div key={l.id} style={{ borderRadius: 11, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.03)", padding: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                      <div style={{ fontSize: 15, fontWeight: 800 }}>{l.name}</div>
                      <div style={{ fontFamily: "monospace", fontWeight: 900, fontSize: 18, letterSpacing: 3, color: "#E8002D" }}>{l.code}</div>
                    </div>
                    <div style={{ display: "flex", gap: 7 }}>
                      <button onClick={() => setViewLeague(l)} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7, color: "rgba(255,255,255,0.65)", cursor: "pointer", fontSize: 12, fontWeight: 600, padding: "7px 0", flex: 1 }}>View</button>
                      {l.owner_id === user?.id
                        ? <button onClick={() => deleteLeague(l.id)} style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.22)", borderRadius: 7, color: "#F87171", cursor: "pointer", fontSize: 12, fontWeight: 600, padding: "7px 0", flex: 1 }}>Delete</button>
                        : <button onClick={() => leaveLeague(l.id)} style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.22)", borderRadius: 7, color: "#F87171", cursor: "pointer", fontSize: 12, fontWeight: 600, padding: "7px 0", flex: 1 }}>Leave</button>
                      }
                    </div>
                  </div>
                ))}
              </div>
            }
          </div>
        </div>
      )}

      {tab === "forum" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.28)" }}>{posts.length} discussions</div>
            {user
              ? <button style={{ background: "linear-gradient(135deg,#E8002D,#FF6B35)", border: "none", borderRadius: 20, color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 700, padding: "7px 15px" }} onClick={() => setShowForm(!showForm)}>{showForm ? "Cancel" : "+ New Post"}</button>
              : <button style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, color: "rgba(255,255,255,0.55)", cursor: "pointer", fontSize: 12, fontWeight: 600, padding: "7px 15px" }} onClick={() => openAuth("login")}>Login to Post</button>
            }
          </div>
          {showForm && (
            <div style={{ borderRadius: 11, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", padding: 18, marginBottom: 14 }}>
              <input style={{ ...inp, marginBottom: 10 }} placeholder="Post title..." value={np.title} onChange={e => setNp(p => ({ ...p, title: e.target.value }))} />
              <textarea style={{ ...inp, height: 80, resize: "vertical", marginBottom: 10 }} placeholder="Share your thoughts..." value={np.body} onChange={e => setNp(p => ({ ...p, body: e.target.value }))} />
              <button style={{ background: "linear-gradient(135deg,#E8002D,#FF6B35)", border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700, padding: "9px 20px" }} onClick={submitPost}>Post</button>
            </div>
          )}
          {posts.length === 0 ? (
            <div style={{ padding: 60, textAlign: "center" }}>
              <div style={{ fontSize: 36, marginBottom: 16 }}>💬</div>
              <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>No posts yet</div>
              <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 13 }}>Be the first to start a discussion!</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {posts.map(p => {
                const isOpen = expanded === p.id;
                const postComments = comments[p.id] || [];
                return (
                  <div key={p.id} style={{ borderRadius: 11, border: `1px solid ${isOpen ? "rgba(232,0,45,0.28)" : "rgba(255,255,255,0.07)"}`, background: isOpen ? "rgba(232,0,45,0.035)" : "rgba(255,255,255,0.03)", overflow: "hidden" }}>
                    <div style={{ padding: "15px 19px", cursor: "pointer" }} onClick={() => togglePost(p.id)}>
                      <div style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
                        <div style={{ width: 35, height: 35, borderRadius: 8, background: "linear-gradient(135deg,#E8002D,#FF6B35)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900, color: "#fff", flexShrink: 0 }}>{p.author_name.slice(0, 2).toUpperCase()}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                            <span style={{ fontSize: 13, fontWeight: 700 }}>{p.author_name}</span>
                            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▾</div>
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{p.title}</div>
                          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.47)", lineHeight: 1.53 }}>{p.body}</p>
                        </div>
                      </div>
                    </div>
                    {isOpen && (
                      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.18)" }}>
                        {postComments.length > 0 && (
                          <div style={{ padding: "12px 19px 0" }}>
                            {postComments.map((c, ci) => (
                              <div key={c.id} style={{ display: "flex", gap: 10, padding: "9px 0", borderBottom: ci < postComments.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                                <div style={{ width: 27, height: 27, borderRadius: 6, background: "rgba(99,102,241,0.28)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 900, color: "#A5B4FC", flexShrink: 0 }}>{c.author_name.slice(0, 2).toUpperCase()}</div>
                                <div style={{ flex: 1 }}>
                                  <span style={{ fontSize: 12, fontWeight: 700 }}>{c.author_name}</span>
                                  <p style={{ margin: "3px 0 0", fontSize: 12, color: "rgba(255,255,255,0.57)", lineHeight: 1.5 }}>{c.body}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <div style={{ padding: "11px 19px 14px", display: "flex", gap: 8, alignItems: "center" }}>
                          {user ? (
                            <>
                              <input style={{ ...inp, padding: "8px 12px", fontSize: 12, flex: 1 }} placeholder="Reply..." value={replyText[p.id] || ""} onChange={e => setReplyText(r => ({ ...r, [p.id]: e.target.value }))} onKeyDown={e => e.key === "Enter" && submitReply(p.id)} />
                              <button onClick={() => submitReply(p.id)} style={{ background: "linear-gradient(135deg,#E8002D,#FF6B35)", border: "none", borderRadius: 7, color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 12, padding: "8px 13px", flexShrink: 0 }}>Reply</button>
                            </>
                          ) : (
                            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.28)" }}>
                              <span style={{ color: "#E8002D", cursor: "pointer", fontWeight: 700 }} onClick={() => openAuth("login")}>Login</span> to join the discussion
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
