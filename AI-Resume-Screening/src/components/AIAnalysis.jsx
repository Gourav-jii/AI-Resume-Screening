import { useState, useEffect } from "react";
import "./AIAnalysis.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export default function AIAnalysis({ user }) {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const [candidate, setCandidate] = useState(null);

  useEffect(() => {
    const fetchCandidates = async () => {
      try {
        setSelectedId("");
        setCandidate(null);
        const token = localStorage.getItem("auth_token");
        const res = await fetch(`${API_URL}/api/candidates`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        // Sort by ATS score descending — highest score first
        const sorted = [...data].sort((a, b) =>
          (b.resume_analysis?.ats_score || 0) - (a.resume_analysis?.ats_score || 0)
        );
        setCandidates(sorted);
        // Auto-select highest scoring candidate
        const first = sorted.find((c) => c.resume_analysis?.ats_score);
        if (first) {
          setSelectedId(first._id);
          setCandidate(first);
        }
      } catch (err) {
        console.error(err);
        setCandidates([]);
        setSelectedId("");
        setCandidate(null);
      } finally {
        setLoading(false);
      }
    };
    fetchCandidates();
  }, [user?.userId]);

  // Use all candidates directly — server handles user scoping
  const ownedCandidates = candidates;

  const handleSelect = (e) => {
    const id = e.target.value;
    setSelectedId(id);
    const found = ownedCandidates.find((c) => c._id === id);
    setCandidate(found || null);
  };

  const analysis = candidate?.resume_analysis || {};
  const profile = candidate?.candidate_profile || {};
  const name = profile.full_name || "Candidate";

  const atsScore = analysis.ats_score || 0;
  const technicalScore = analysis.technical_score || 0;
  const communicationScore = analysis.communication_score || 0;
  const experienceScore = analysis.experience_score || Math.round(atsScore * 0.9);
  const educationScore = analysis.education_score || Math.round(atsScore * 0.85);

  const strengths = analysis.resume_strengths || [];
  const recommendation = analysis.reason_for_decision || "No recommendation available.";

  // Build a meaningful AI summary from available data
  const buildSummary = () => {
    if (analysis.summary) return analysis.summary;
    if (candidate?.professional_summary) return candidate.professional_summary;

    // Auto-generate from structured data
    const expLevel = analysis.experience_level || "entry-level";
    const roles = (analysis.best_matching_roles || []).slice(0, 2).join(" and ");
    const tech = candidate?.technical_skills || {};
    const allSkills = [
      ...(tech.programming_languages || []),
      ...(tech.frontend || []),
      ...(tech.backend || []),
      ...(tech.databases || []),
    ].slice(0, 5);
    const workExp = candidate?.work_experience || [];
    const projects = candidate?.projects || [];
    const edu = candidate?.education || [];

    let summary = `${name} is a${expLevel.toLowerCase().startsWith("e") ? "n" : ""} ${expLevel.toLowerCase()} professional`;
    if (roles) summary += ` best suited for ${roles} roles`;
    summary += ".";
    if (allSkills.length > 0) summary += ` Key technical skills include ${allSkills.join(", ")}.`;
    if (workExp.length > 0) summary += ` Has ${workExp.length} work experience${workExp.length > 1 ? "s" : ""} including roles at ${workExp.slice(0, 2).map(w => w.company).filter(Boolean).join(", ") || "various companies"}.`;
    if (projects.length > 0) summary += ` Has built ${projects.length} project${projects.length > 1 ? "s" : ""}.`;
    if (edu.length > 0) {
      const latestEdu = edu[0];
      if (latestEdu.degree && latestEdu.institution) summary += ` Holds a ${latestEdu.degree} from ${latestEdu.institution}.`;
    }
    if (atsScore > 0) summary += ` Overall ATS score: ${atsScore}/100.`;
    if (analysis.shortlisting_decision) summary += ` AI recommendation: ${analysis.shortlisting_decision}.`;

    return summary || "No AI summary available for this candidate.";
  };

  const summary = buildSummary();

  const getScoreColor = (score) => {
    if (score >= 80) return "#10b981";
    if (score >= 60) return "#3b82f6";
    if (score >= 40) return "#f59e0b";
    return "#ef4444";
  };

  const ScoreBar = ({ label, value, color }) => (
    <div className="ai-score-row">
      <div className="ai-score-label-row">
        <span className="ai-score-label">{label}</span>
        <span
          className="ai-score-pct"
          style={{ color: value >= 80 ? "#10b981" : "inherit" }}
        >
          {value}%
        </span>
      </div>
      <div className="ai-score-track">
        <div
          className="ai-score-fill"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="ai-analysis-container">
        <div className="ai-section-header">
          <h1 className="ai-section-title">AI Analysis</h1>
          <p className="ai-section-sub">AI-powered analysis and feedback for the candidate.</p>
        </div>
        <div className="ai-loading">Loading candidates…</div>
      </div>
    );
  }

  return (
    <div className="ai-analysis-container">
      {/* Header */}
      <div className="ai-section-header">
        <div>
          <h1 className="ai-section-title">AI Analysis</h1>
          <p className="ai-section-sub">AI-powered analysis and feedback for the candidate.</p>
        </div>

        {/* Candidate Selector */}
        <div className="ai-candidate-selector">
          <label htmlFor="ai-candidate-select" className="ai-selector-label">
            Select Candidate
          </label>
          <div className="ai-select-wrap">
            <select
              id="ai-candidate-select"
              className="ai-select"
              value={selectedId}
              onChange={handleSelect}
            >
              <option value="">
                {ownedCandidates.length === 0 ? "No candidates available" : "Choose a candidate"}
              </option>
              {ownedCandidates.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.candidate_profile?.full_name || "Unnamed"}{" "}
                  {c.resume_analysis?.ats_score ? `— ${c.resume_analysis.ats_score}/100` : ""}
                </option>
              ))}
            </select>
            <span className="ai-select-arrow">▾</span>
          </div>
        </div>
      </div>

      {!candidate ? (
        <div className="ai-empty">
          <div className="ai-empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h.01M15 9h.01M8 13h8"/><circle cx="12" cy="17" r="1"/></svg>
          </div>
          <p className="ai-empty-text">Select a candidate to view AI analysis.</p>
        </div>
      ) : (
        <>
          {/* Top 2-column row */}
          <div className="ai-top-grid">
            {/* AI Summary */}
            <div className="ai-card">
              <h3 className="ai-card-title">AI Summary</h3>
              <p className="ai-summary-text">
                {typeof summary === "string"
                  ? summary
                  : `${name} is a skilled professional with strong technical capabilities.`}
              </p>
            </div>

            {/* Strengths */}
            <div className="ai-card">
              <h3 className="ai-card-title">Strengths</h3>
              {strengths.length > 0 ? (
                <ul className="ai-strengths-list">
                  {strengths.map((s, i) => (
                    <li key={i} className="ai-strength-item">
                      <span className="ai-strength-dot" />
                      {s}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="ai-empty-field">No strengths recorded.</p>
              )}
            </div>
          </div>

          {/* Bottom 2-column row */}
          <div className="ai-bottom-grid">
            {/* Score Breakdown */}
            <div className="ai-card">
              <h3 className="ai-card-title">AI Score Breakdown</h3>
              <div className="ai-scores-wrap">
                <ScoreBar
                  label="Skills Match"
                  value={technicalScore}
                  color={getScoreColor(technicalScore)}
                />
                <ScoreBar
                  label="Experience"
                  value={experienceScore}
                  color={getScoreColor(experienceScore)}
                />
                <ScoreBar
                  label="Education"
                  value={educationScore}
                  color={getScoreColor(educationScore)}
                />
                <ScoreBar
                  label="Overall Score"
                  value={atsScore}
                  color={getScoreColor(atsScore)}
                />
              </div>
            </div>

            {/* Recommendations */}
            <div className="ai-card">
              <h3 className="ai-card-title">Recommendations</h3>
              <p className="ai-recommendation-text">{recommendation}</p>

              {analysis.shortlisting_decision && (
                <div
                  className="ai-decision-badge"
                  style={{
                    background:
                      analysis.shortlisting_decision.toLowerCase() === "shortlist"
                        ? "rgba(16,185,129,0.1)"
                        : analysis.shortlisting_decision.toLowerCase() === "reject"
                        ? "rgba(239,68,68,0.1)"
                        : "rgba(245,158,11,0.1)",
                    color:
                      analysis.shortlisting_decision.toLowerCase() === "shortlist"
                        ? "#065f46"
                        : analysis.shortlisting_decision.toLowerCase() === "reject"
                        ? "#dc2626"
                        : "#92400e",
                  }}
                >
                  Decision: {analysis.shortlisting_decision}
                </div>
              )}

              {analysis.best_matching_roles && analysis.best_matching_roles.length > 0 && (
                <div className="ai-matching-roles">
                  <span className="ai-roles-label">Best Matching Roles:</span>
                  <div className="ai-roles-pills">
                    {analysis.best_matching_roles.map((role, i) => (
                      <span key={i} className="ai-role-pill">{role}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
