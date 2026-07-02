import { useState, useEffect } from "react";
import "./Shortlisted.css";

const API_URL = import.meta.env.VITE_API_URL || (window.location.port === "5173" ? "http://localhost:4000" : "");

export default function Shortlisted({ user }) {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [search, setSearch]         = useState("");
  const [jobFilter, setJobFilter]   = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const fetchShortlisted = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("auth_token");
      const res  = await fetch(`${API_URL}/api/candidates`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) throw new Error("Failed to fetch candidates");
      const data = await res.json();
      setCandidates(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchShortlisted(); }, []);

  // Use all candidates directly — server handles user scoping
  const ownedCandidates = candidates;

  // Score color
  const scoreColor = (score) => {
    if (score >= 80) return "#10b981";
    if (score >= 60) return "#3b82f6";
    if (score >= 40) return "#f59e0b";
    return "#ef4444";
  };

  // Unique job titles for filter
  const jobTitles = ["All", ...new Set(
    ownedCandidates.flatMap(c => {
      const titles = [];
      if (c.jobId?.jobTitle) titles.push(c.jobId.jobTitle);
      if (c.resume_analysis?.best_matching_roles) {
        titles.push(...c.resume_analysis.best_matching_roles);
      }
      return titles;
    }).filter(Boolean)
  )].sort();

  // Apply search + job + status filter
  const filtered = ownedCandidates.filter(c => {
    const name   = (c.candidate_profile?.full_name || "").toLowerCase();
    const email  = (c.candidate_profile?.email     || "").toLowerCase();
    const q      = search.toLowerCase();
    const status = (c.status || "Pending").toLowerCase();

    const matchSearch = !q || name.includes(q) || email.includes(q);
    const matchJob    = jobFilter === "All" ||
      c.jobId?.jobTitle === jobFilter ||
      (c.resume_analysis?.best_matching_roles || []).includes(jobFilter);
    const matchStatus = statusFilter === "All" ||
      status === statusFilter.toLowerCase();

    return matchSearch && matchJob && matchStatus;
  });

  // Export to CSV
  const handleExport = () => {
    const rows = [
      ["Candidate", "Email", "Job Title", "AI Score", "Match Score", "Shortlisted On"],
      ...filtered.map(c => [
        c.candidate_profile?.full_name || "—",
        c.candidate_profile?.email     || "—",
        (c.resume_analysis?.best_matching_roles || []).join(" | ") || "—",
        c.resume_analysis?.ats_score   || 0,
        c.resume_analysis?.ats_score   || 0,
        c.created_at ? new Date(c.created_at).toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" }) : "—",
      ]),
    ];
    const csv  = rows.map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = "shortlisted_candidates.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Download original resume
  const handleDownload = async (c, e) => {
    e.stopPropagation();
    if (c.filePath) {
      const a    = document.createElement("a");
      const token = localStorage.getItem("auth_token");
      // Download endpoint requires JWT; use fetch+blob to attach header
      const doDownload = async () => {
        const r = await fetch(`${API_URL}/api/candidates/${c._id}/download`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!r.ok) {
          alert("Failed to download resume.");
          return;
        }
        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        a.href = url;
        a.download = c.originalName || c.filePath;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      };

      await doDownload();

    } else {
      alert("Original resume file not stored. Please re-upload this resume.");
    }
  };

  return (
    <div className="sl-container">
      {/* Header */}
      <div className="sl-header">
        <div>
          <h1 className="sl-title">Candidate Management</h1>
          <p className="sl-subtitle">View and manage all candidates by status.</p>
        </div>
        <button className="sl-export-btn" onClick={handleExport}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export
        </button>
      </div>

      {/* Toolbar */}
      <div className="sl-toolbar">
        <div className="sl-search-wrap">
          <span className="sl-search-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </span>
          <input
            type="text"
            className="sl-search"
            placeholder="Search candidates…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && <button className="sl-search-clear" onClick={() => setSearch("")}>×</button>}
        </div>

        {/* Status filter */}
        <div className="sl-filter-wrap">
          <select className="sl-filter" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="All">All Status</option>
            <option value="Shortlisted">Shortlisted</option>
            <option value="Pending">Pending</option>
            <option value="Rejected">Rejected</option>
          </select>
          <span className="sl-filter-arrow">▾</span>
        </div>

        {/* Job title filter */}
        <div className="sl-filter-wrap">
          <select className="sl-filter" value={jobFilter} onChange={e => setJobFilter(e.target.value)}>
            {jobTitles.map((j, i) => <option key={i} value={j}>{j === "All" ? "All Jobs" : j}</option>)}
          </select>
          <span className="sl-filter-arrow">▾</span>
        </div>

        <span className="sl-count">{filtered.length} candidate{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* States */}
      {loading ? (
        <div className="sl-state">
          <div className="sl-spinner" />
          <p>Loading shortlisted candidates…</p>
        </div>
      ) : error ? (
        <div className="sl-state sl-error">
          <p>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:6}}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            {error}
          </p>
          <button onClick={fetchShortlisted} className="sl-retry">Retry</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="sl-state">
          <p className="sl-empty-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{color:'#94a3b8'}}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          </p>
          <p className="sl-empty-text">
            {ownedCandidates.length === 0
              ? "No shortlisted candidates yet. Shortlist candidates from the Candidates section."
              : "No candidates match your search."}
          </p>
        </div>
      ) : (
        <div className="sl-table-wrap">
          <table className="sl-table">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Job Title</th>
                <th>AI Score</th>
                <th>Match Score</th>
                <th>Status</th>
                <th>Date</th>
                
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => {
                const name      = c.candidate_profile?.full_name || "Unknown";
                const email     = c.candidate_profile?.email     || "";
                const jobRoles  = c.jobId?.jobTitle || (c.resume_analysis?.best_matching_roles || []).join(", ") || "—";
                const atsScore  = c.resume_analysis?.ats_score   || 0;
                const date      = c.created_at
                  ? new Date(c.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                  : "—";

                // Avatar initials + color
                const parts  = name.split(" ").filter(Boolean);
                const initials = parts.length >= 2
                  ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
                  : name[0]?.toUpperCase() || "?";
                const colors = ["#e0e7ff","#ede9fe","#ccfbf1","#fce7f3","#ffedd5","#d1fae5"];
                const tcolors= ["#4f46e5","#7c3aed","#0d9488","#db2777","#ea580c","#059669"];
                const ci     = Math.abs(name.charCodeAt(0)) % colors.length;

                return (
                  <tr key={i} className="sl-row">
                    <td data-label="Candidate">
                      <div className="sl-candidate-cell">
                        <div className="sl-avatar" style={{ background: colors[ci], color: tcolors[ci] }}>
                          {initials}
                        </div>
                        <div>
                          <div className="sl-name">{name}</div>
                          {email && <div className="sl-email">{email}</div>}
                        </div>
                      </div>
                    </td>
                    <td data-label="Job Title" className="sl-job">{jobRoles}</td>
                    <td data-label="AI Score">
                      <span className="sl-score" style={{ color: scoreColor(atsScore) }}>
                        {atsScore}/100
                      </span>
                    </td>
                    <td data-label="Match">
                      <span className="sl-score" style={{ color: scoreColor(atsScore) }}>
                        {atsScore}%
                      </span>
                    </td>
                    <td data-label="Status">
                      {(() => {
                        const s = (c.status || "Pending").toLowerCase();
                        const cfg = s === "shortlisted"
                          ? { label: "Shortlisted", bg: "#d1fae5", color: "#059669" }
                          : s === "rejected"
                          ? { label: "Rejected",    bg: "#fee2e2", color: "#dc2626" }
                          : { label: "Pending",     bg: "#fef3c7", color: "#d97706" };
                        return (
                          <span className="sl-status-badge" style={{ background: cfg.bg, color: cfg.color }}>
                            {cfg.label}
                          </span>
                        );
                      })()}
                    </td>
                    <td data-label="Date" className="sl-date">{date}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
