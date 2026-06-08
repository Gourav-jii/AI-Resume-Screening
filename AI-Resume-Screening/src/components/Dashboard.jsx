import { useState, useEffect } from "react";
import "./Dashboard.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

function getInitials(name = "") {
  const p = name.trim().split(" ").filter(Boolean);
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : (name[0] || "?").toUpperCase();
}

const AVATAR_COLORS = [
  { bg: "#e0e7ff", text: "#4f46e5" },
  { bg: "#ede9fe", text: "#7c3aed" },
  { bg: "#ccfbf1", text: "#0d9488" },
  { bg: "#fce7f3", text: "#db2777" },
  { bg: "#ffedd5", text: "#ea580c" },
  { bg: "#d1fae5", text: "#059669" },
  { bg: "#fef9c3", text: "#ca8a04" },
];
function avatarColor(name = "") {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function scoreColor(s) {
  if (s >= 80) return "#10b981";
  if (s >= 60) return "#3b82f6";
  if (s >= 40) return "#f59e0b";
  return "#ef4444";
}

export default function Dashboard({ user, onNavigate }) {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const token = localStorage.getItem("auth_token");
        const res = await fetch(`${API_URL}/api/candidates`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error("Failed");
        setCandidates(await res.json());
      } catch {
        setCandidates([]);
      } finally {
        setLoading(false);
      }
    };
    fetch_();
  }, []);

  // ── Stats ──
  const total       = candidates.length;
  const shortlisted = candidates.filter(c => (c.status || "").toLowerCase() === "shortlisted").length;
  const rejected    = candidates.filter(c => (c.status || "").toLowerCase() === "rejected").length;
  const pending     = candidates.filter(c => {
    const s = (c.status || "pending").toLowerCase();
    return s !== "shortlisted" && s !== "rejected";
  }).length;
  const scores      = candidates.map(c => c.resume_analysis?.ats_score || 0).filter(Boolean);
  const avgScore    = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

  const stats = [
    { label: "Total Candidates", value: total,       icon: "👥", color: "#6366f1", bg: "#e0e7ff", trend: "+12%", up: true  },
    { label: "Shortlisted",      value: shortlisted,  icon: "✅", color: "#10b981", bg: "#d1fae5", trend: "+8%",  up: true  },
    { label: "Pending Review",   value: pending,      icon: "⏳", color: "#f59e0b", bg: "#fef3c7", trend: "-5%",  up: false },
    { label: "Rejected",         value: rejected,     icon: "❌", color: "#ef4444", bg: "#fee2e2", trend: "-3%",  up: false },
    { label: "Avg. Match Score", value: `${avgScore}%`, icon: "🎯", color: "#8b5cf6", bg: "#ede9fe", trend: "+15%", up: true },
  ];

  // ── Top Skills ──
  const skillMap = {};
  candidates.forEach(c => {
    const tech = c.technical_skills || {};
    const all  = [
      ...(tech.programming_languages || []),
      ...(tech.frontend || []),
      ...(tech.backend  || []),
      ...(tech.databases || []),
    ];
    all.forEach(s => { skillMap[s] = (skillMap[s] || 0) + 1; });
  });
  const topSkills = Object.entries(skillMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, count]) => ({ name, pct: total ? Math.round((count / total) * 100) : 0 }));

  const skillColors = ["#6366f1","#10b981","#3b82f6","#f59e0b","#8b5cf6","#ec4899"];

  // ── Activity Feed ──
  const activities = candidates
    .slice()
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .slice(0, 5)
    .map(c => {
      const s = (c.status || "pending").toLowerCase();
      if (s === "shortlisted") return { text: `${c.candidate_profile?.full_name || "Candidate"} shortlisted`, icon: "✅", color: "#10b981", time: c.created_at };
      if (s === "rejected")    return { text: `${c.candidate_profile?.full_name || "Candidate"} rejected`,    icon: "❌", color: "#ef4444", time: c.created_at };
      return { text: `${c.candidate_profile?.full_name || "Candidate"} resume uploaded`, icon: "📄", color: "#6366f1", time: c.created_at };
    });

  // ── Recent Candidates (latest 5) ──
  const recent = candidates
    .slice()
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .slice(0, 5);

  const timeAgo = (dateStr) => {
    if (!dateStr) return "—";
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)  return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  return (
    <div className="db-container">
      {/* ── Header ── */}
      <div className="db-header">
        <div>
          <h1 className="db-title">Dashboard</h1>
          <p className="db-subtitle">
            Welcome back, <strong>{user?.name || "Recruiter"}</strong>! Here's what's happening with your recruitment.
          </p>
        </div>
        <button className="db-cta" onClick={() => onNavigate("job")}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Job Description
        </button>
      </div>

      {/* ── Stat Cards ── */}
      <div className="db-stats-grid">
        {stats.map((s, i) => (
          <div key={i} className="db-stat-card">
            <div className="db-stat-icon" style={{ background: s.bg, color: s.color }}>{s.icon}</div>
            <div className="db-stat-body">
              <span className="db-stat-label">{s.label}</span>
              <span className="db-stat-value">{loading ? "—" : s.value}</span>
              {/* <span className={`db-stat-trend ${s.up ? "up" : "down"}`}>
                {s.up ? "↑" : "↓"} {s.trend} from last week
              </span> */}
            </div>
          </div>
        ))}
      </div>

      {/* ── Middle Row: Candidates Chart | Top Skills | Activity ── */}
      <div className="db-mid-grid">

        {/* Candidates Overview — bar chart from real data */}
        <div className="db-card db-overview-card">
          <div className="db-card-header">
            <h3 className="db-card-title">Candidates Overview</h3>
            <span className="db-card-badge">All Time</span>
          </div>
          <div className="db-bar-chart">
            {loading ? (
              <div className="db-chart-loading">Loading…</div>
            ) : candidates.length === 0 ? (
              <div className="db-chart-empty">No candidates yet</div>
            ) : (
              <div className="db-bars">
                {["shortlisted","pending","rejected"].map((status, si) => {
                  const count = status === "shortlisted" ? shortlisted
                    : status === "pending" ? pending
                    : rejected;
                  const pct = total ? (count / total) * 100 : 0;
                  const colors = ["#6366f1","#f59e0b","#ef4444"];
                  const labels = ["Shortlisted","Pending","Rejected"];
                  return (
                    <div key={si} className="db-bar-group">
                      <div className="db-bar-track">
                        <div className="db-bar-fill" style={{ height: `${Math.max(pct, 4)}%`, background: colors[si] }} />
                      </div>
                      <span className="db-bar-label">{labels[si]}</span>
                      <span className="db-bar-val">{count}</span>
                    </div>
                  );
                })}
                <div className="db-bar-group db-bar-group-total">
                  <div className="db-bar-track">
                    <div className="db-bar-fill" style={{ height: "100%", background: "linear-gradient(180deg,#a78bfa,#7c3aed)" }} />
                  </div>
                  <span className="db-bar-label">Total</span>
                  <span className="db-bar-val">{total}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Top Skills */}
        <div className="db-card db-skills-card">
          <div className="db-card-header">
            <h3 className="db-card-title">Top Skills</h3>
          </div>
          {loading ? (
            <div className="db-chart-loading">Loading…</div>
          ) : topSkills.length === 0 ? (
            <div className="db-chart-empty">No skill data yet</div>
          ) : (
            <div className="db-skills-list">
              {topSkills.map((sk, i) => (
                <div key={i} className="db-skill-row">
                  <span className="db-skill-dot" style={{ background: skillColors[i % skillColors.length] }} />
                  <span className="db-skill-name">{sk.name}</span>
                  <div className="db-skill-track">
                    <div className="db-skill-bar" style={{ width: `${sk.pct}%`, background: skillColors[i % skillColors.length] }} />
                  </div>
                  <span className="db-skill-pct">{sk.pct}%</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Activity Feed */}
        <div className="db-card db-activity-card">
          <div className="db-card-header">
            <h3 className="db-card-title">Activity Feed</h3>
          </div>
          {loading ? (
            <div className="db-chart-loading">Loading…</div>
          ) : activities.length === 0 ? (
            <div className="db-chart-empty">No activity yet</div>
          ) : (
            <ul className="db-activity-list">
              {activities.map((a, i) => (
                <li key={i} className="db-activity-item">
                  <span className="db-activity-icon" style={{ background: a.color + "1a", color: a.color }}>{a.icon}</span>
                  <div className="db-activity-body">
                    <span className="db-activity-text">{a.text}</span>
                    <span className="db-activity-time">{timeAgo(a.time)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <button className="db-view-all" onClick={() => onNavigate("candidates")}>
            View all activity →
          </button>
        </div>
      </div>

      {/* ── Recent Candidates Table ── */}
      <div className="db-card db-recent-card">
        <div className="db-card-header">
          <h3 className="db-card-title">Recent Candidates</h3>
          <button className="db-view-all-btn" onClick={() => onNavigate("candidates")}>
            View All
          </button>
        </div>

        {loading ? (
          <div className="db-chart-loading">Loading candidates…</div>
        ) : recent.length === 0 ? (
          <div className="db-chart-empty">No candidates yet. Upload resumes to get started.</div>
        ) : (
          <div className="db-table-wrap">
            <table className="db-table">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Skills</th>
                  <th>Experience</th>
                  <th>AI Score</th>
                  <th>Match Score</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((c, i) => {
                  const name    = c.candidate_profile?.full_name || "Unknown";
                  const email   = c.candidate_profile?.email || "";
                  const tech    = c.technical_skills || {};
                  const skills  = [
                    ...(tech.programming_languages || []),
                    ...(tech.frontend || []),
                    ...(tech.backend  || []),
                  ].slice(0, 3);
                  const expYrs  = c.work_experience?.length
                    ? `${c.work_experience.length * 1.5} Years` : "—";
                  const score   = c.resume_analysis?.ats_score || 0;
                  const status  = c.status || "Pending";
                  const sc      = status.toLowerCase() === "shortlisted"
                    ? { label: "Shortlisted", bg: "#d1fae5", color: "#059669" }
                    : status.toLowerCase() === "rejected"
                    ? { label: "Rejected",    bg: "#fee2e2", color: "#dc2626" }
                    : { label: "Pending",     bg: "#fef3c7", color: "#d97706" };
                  const av      = avatarColor(name);

                  return (
                    <tr key={i} className="db-row">
                      <td>
                        <div className="db-candidate-cell">
                          <div className="db-avatar" style={{ background: av.bg, color: av.text }}>
                            {getInitials(name)}
                          </div>
                          <div>
                            <div className="db-cname">{name}</div>
                            {email && <div className="db-cemail">{email}</div>}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="db-skills-pills">
                          {skills.map((s, si) => (
                            <span key={si} className="db-skill-pill">{s}</span>
                          ))}
                          {[
                            ...(tech.programming_languages || []),
                            ...(tech.frontend || []),
                            ...(tech.backend  || []),
                          ].length > 3 && (
                            <span className="db-skill-pill db-skill-more">
                              +{[...(tech.programming_languages||[]),...(tech.frontend||[]),...(tech.backend||[])].length - 3}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="db-exp">{expYrs}</td>
                      <td>
                        <span className="db-score" style={{ color: scoreColor(score) }}>
                          {score}/100
                        </span>
                      </td>
                      <td>
                        <div className="db-match-cell">
                          <span className="db-score" style={{ color: scoreColor(score) }}>{score}%</span>
                          <div className="db-match-track">
                            <div className="db-match-fill" style={{ width: `${score}%`, background: scoreColor(score) }} />
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="db-status-badge" style={{ background: sc.bg, color: sc.color }}>
                          {sc.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
