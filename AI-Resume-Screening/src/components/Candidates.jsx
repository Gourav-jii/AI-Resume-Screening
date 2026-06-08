import { useState, useEffect } from 'react';
import './Candidates.css';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export default function Candidates() {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Search & filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedJob, setSelectedJob] = useState("All Jobs");
  const [selectedSkill, setSelectedSkill] = useState("All Skills");
  const [selectedExperience, setSelectedExperience] = useState("All Experience");
  const [selectedStatus, setSelectedStatus] = useState("All Status");

  // Detailed view state
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [activeTab, setActiveTab] = useState("Overview");

  // ── Bulk select state ──
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [selectMode, setSelectMode] = useState(false);

  // Fetch candidates from API
  const fetchCandidates = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/api/candidates`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) throw new Error("Failed to fetch candidates");
      const data = await res.json();
      setCandidates(data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError(err.message || "Something went wrong while fetching candidates.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, []);

  const handleUpdateStatus = async (candidateId, newStatus) => {
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/api/candidates/${candidateId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!res.ok) throw new Error("Failed to update status");
      const updatedCandidate = await res.json();
      setCandidates(prev => prev.map(c => c._id === candidateId ? updatedCandidate : c));
      if (selectedCandidate && selectedCandidate._id === candidateId) {
        setSelectedCandidate(updatedCandidate);
      }
    } catch (err) {
      console.error(err);
      alert("Error updating status: " + err.message);
    }
  };

  // Delete a candidate record + its stored file
  const handleDeleteCandidate = async (candidateId, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm("Delete this candidate? This cannot be undone.")) return;
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_URL}/api/candidates/${candidateId}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) throw new Error("Failed to delete candidate");
      setCandidates(prev => prev.filter(c => c._id !== candidateId));
      if (selectedCandidate?._id === candidateId) setSelectedCandidate(null);
    } catch (err) {
      console.error(err);
      alert("Error deleting candidate: " + err.message);
    }
  };

  // ── Bulk select helpers ──
  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredCandidates.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredCandidates.map(c => c._id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Delete ${selectedIds.size} selected candidate${selectedIds.size > 1 ? "s" : ""}? This cannot be undone.`)) return;

    setBulkDeleting(true);
    const token = localStorage.getItem("auth_token");
    const ids = [...selectedIds];

    const results = await Promise.allSettled(
      ids.map(id =>
        fetch(`${API_URL}/api/candidates/${id}`, {
          method: "DELETE",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
      )
    );

    const deleted = ids.filter((_, i) => results[i].status === "fulfilled");
    setCandidates(prev => prev.filter(c => !deleted.includes(c._id)));
    setSelectedIds(new Set());
    setBulkDeleting(false);
  };

  // Download: use stored PDF if available, else generate text report
  const handleDownloadResume = async (candidate, e) => {
    if (e) e.stopPropagation();

    // Try real file download first
    if (candidate.filePath) {
      const link = document.createElement("a");
      link.href = `${API_URL}/api/candidates/${candidate._id}/download`;
      link.download = candidate.originalName || candidate.filePath;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    // Fallback: generate text report from stored data
    const textContent = `
========================================
CANDIDATE PROFILE: ${candidate.candidate_profile?.full_name || "N/A"}
========================================
Email: ${candidate.candidate_profile?.email || "N/A"}
Phone: ${candidate.candidate_profile?.phone || "N/A"}
Location: ${candidate.candidate_profile?.location || "N/A"}
LinkedIn: ${candidate.candidate_profile?.linkedin || "N/A"}
GitHub: ${candidate.candidate_profile?.github || "N/A"}

PROFESSIONAL SUMMARY:
${candidate.professional_summary || "No summary provided."}

EDUCATION:
${(candidate.education || []).map(e => `- ${e.degree || "Degree"} | ${e.institution || "Institution"} (${e.duration || "N/A"})`).join('\n')}

TECHNICAL SKILLS:
${Object.entries(candidate.technical_skills || {}).map(([cat, list]) =>
  `${cat.replace(/_/g, ' ').toUpperCase()}: ${Array.isArray(list) ? list.join(', ') : list}`
).join('\n')}

WORK EXPERIENCE:
${(candidate.work_experience || []).map(w => `- ${w.role || "Role"} at ${w.company || "Company"} (${w.duration || "N/A"})\n  ${w.description || ""}`).join('\n')}

PROJECTS:
${(candidate.projects || []).map(p => `- ${p.name || p.project_name || "Project"}: ${p.description || ""}`).join('\n')}

========================================
AI ANALYSIS
========================================
Overall Score: ${candidate.resume_analysis?.ats_score || 0}/100
Decision: ${candidate.resume_analysis?.shortlisting_decision || "Hold"}
Strengths:
${(candidate.resume_analysis?.resume_strengths || []).map(s => `  * ${s}`).join('\n')}
Weaknesses:
${(candidate.resume_analysis?.resume_weaknesses || []).map(w => `  * ${w}`).join('\n')}
Reason: ${candidate.resume_analysis?.reason_for_decision || "N/A"}
    `;

    const blob = new Blob([textContent], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href     = url;
    link.download = `${(candidate.candidate_profile?.full_name || "candidate").replace(/\s+/g, '_')}_analysis.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getCandidateSkillsList = (candidate) => {
    const tech = candidate.technical_skills || {};
    const all = [];
    if (tech.programming_languages) all.push(...tech.programming_languages);
    if (tech.frontend) all.push(...tech.frontend);
    if (tech.backend) all.push(...tech.backend);
    if (tech.databases) all.push(...tech.databases);
    if (tech.tools_platforms) all.push(...tech.tools_platforms);
    if (tech.ai_ml) all.push(...tech.ai_ml);
    return [...new Set(all.map(s => s.trim()).filter(Boolean))];
  };

  // Setup unique dropdown filters dynamically from candidate data
  const uniqueJobs = ["All Jobs", ...new Set(candidates.flatMap(c => c.resume_analysis?.best_matching_roles || []).filter(Boolean))].sort();
  const uniqueSkills = ["All Skills", ...new Set(candidates.flatMap(c => getCandidateSkillsList(c)).filter(Boolean))].sort();
  const uniqueExperience = ["All Experience", ...new Set(candidates.map(c => c.resume_analysis?.experience_level).filter(Boolean))].sort();

  // Filter candidates based on selected search & filters
  const filteredCandidates = candidates.filter(candidate => {
    const name = candidate.candidate_profile?.full_name || "Unnamed Candidate";
    const email = candidate.candidate_profile?.email || "";
    const skillsList = getCandidateSkillsList(candidate);
    
    const matchesSearch = 
      name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      skillsList.some(s => s.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesJob = selectedJob === "All Jobs" || 
      (candidate.resume_analysis?.best_matching_roles || []).includes(selectedJob);

    const matchesSkill = selectedSkill === "All Skills" || 
      skillsList.includes(selectedSkill);

    const matchesExperience = selectedExperience === "All Experience" || 
      candidate.resume_analysis?.experience_level === selectedExperience;

    const currentStatus = candidate.status || "Pending";
    const matchesStatus = selectedStatus === "All Status" || 
      currentStatus.toLowerCase() === selectedStatus.toLowerCase();

    return matchesSearch && matchesJob && matchesSkill && matchesExperience && matchesStatus;
  });

  const getInitials = (name) => {
    if (!name) return "U";
    const parts = name.split(" ").filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name[0].toUpperCase();
  };

  const getAvatarColor = (name) => {
    const colors = [
      { bg: "#e0e7ff", text: "#4f46e5" }, // indigo
      { bg: "#ede9fe", text: "#7c3aed" }, // purple
      { bg: "#fce7f3", text: "#db2777" }, // pink
      { bg: "#ccfbf1", text: "#0d9488" }, // teal
      { bg: "#fae8ff", text: "#c026d3" }, // fuchsia
      { bg: "#ffedd5", text: "#ea580c" }, // orange
      { bg: "#d1fae5", text: "#059669" }, // green
    ];
    if (!name) return colors[0];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  const getStatusDetails = (statusVal) => {
    const status = (statusVal || "Pending").toLowerCase();
    if (status === "shortlisted" || status === "selected") {
      return { label: "Shortlisted", bg: "#d1fae5", text: "#059669" };
    }
    if (status === "rejected") {
      return { label: "Rejected", bg: "#fee2e2", text: "#dc2626" };
    }
    return { label: "Pending", bg: "#fef3c7", text: "#d97706" };
  };

  const getScoreColor = (score) => {
    if (score >= 80) return "#10b981"; // Green
    if (score >= 60) return "#3b82f6"; // Blue
    if (score >= 40) return "#f59e0b"; // Orange
    return "#ef4444"; // Red
  };

  // RENDER DETAILED VIEW
  if (selectedCandidate) {
    const candidate = selectedCandidate;
    const avatarStyle = getAvatarColor(candidate.candidate_profile?.full_name);
    const statusDetails = getStatusDetails(candidate.status);
    const scoreColor = getScoreColor(candidate.resume_analysis?.ats_score || 0);
    const skillsList = getCandidateSkillsList(candidate);

    return (
      <div className="candidate-details-container">
        {/* Back Button */}
        <button className="back-btn" onClick={() => { setSelectedCandidate(null); setActiveTab("Overview"); }}>
          ← Back to Candidates
        </button>

        {/* Profile Header */}
        <div className="profile-header-card">
          <div className="profile-header-left">
            <div className="profile-avatar-large" style={{ backgroundColor: avatarStyle.bg, color: avatarStyle.text }}>
              {getInitials(candidate.candidate_profile?.full_name)}
            </div>
            <div className="profile-info-main">
              <h2 className="profile-name">{candidate.candidate_profile?.full_name || "Unnamed Candidate"}</h2>
              <div className="profile-meta-grid">
                {candidate.candidate_profile?.email && (
                  <span className="profile-meta-item">📧 {candidate.candidate_profile.email}</span>
                )}
                {candidate.candidate_profile?.phone && (
                  <span className="profile-meta-item">📞 {candidate.candidate_profile.phone}</span>
                )}
                {candidate.candidate_profile?.location && (
                  <span className="profile-meta-item">📍 {candidate.candidate_profile.location}</span>
                )}
              </div>
            </div>
          </div>

          <div className="profile-header-right">
            <div className="score-badge-card">
              <span className="badge-label">AI Score</span>
              <span className="badge-value" style={{ color: scoreColor }}>
                {candidate.resume_analysis?.ats_score || 0}/100
              </span>
            </div>
            <div className="score-badge-card">
              <span className="badge-label">Match Score</span>
              <span className="badge-value">
                {candidate.resume_analysis?.ats_score || 0}%
              </span>
            </div>
            <div className="status-badge-container">
              <span className="status-badge" style={{ backgroundColor: statusDetails.bg, color: statusDetails.text }}>
                {statusDetails.label}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="details-tab-bar">
          {["Overview", "Resume", "Analysis", "Activity"].map(tab => (
            <button 
              key={tab} 
              className={`details-tab-item ${activeTab === tab ? "active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Contents */}
        <div className="tab-content-container">
          
          {/* OVERVIEW TAB */}
          {activeTab === "Overview" && (
            <div className="overview-tab-grid">
              
              {/* Left Column: Skills & Experience */}
              <div className="overview-card info-col">
                <h3 className="card-sec-title">Skills</h3>
                <div className="detail-skills-wrap">
                  {skillsList.length > 0 ? (
                    skillsList.map((skill, index) => (
                      <span key={index} className="skill-pill detail-skill-pill">{skill}</span>
                    ))
                  ) : (
                    <span className="empty-text">No skills extracted.</span>
                  )}
                </div>

                <h3 className="card-sec-title" style={{ marginTop: '2rem' }}>Experience Level</h3>
                <div className="exp-level-text">
                  {candidate.resume_analysis?.experience_level || "Entry-Level (calculated)"}
                </div>
              </div>

              {/* Middle Column: Work Experience & Projects */}
              <div className="overview-card timeline-col">
                <h3 className="card-sec-title">Work Experience</h3>
                {candidate.work_experience && candidate.work_experience.length > 0 ? (
                  <div className="timeline">
                    {candidate.work_experience.map((work, index) => (
                      <div key={index} className="timeline-item">
                        <div className="timeline-dot"></div>
                        <div className="timeline-content">
                          <h4 className="timeline-title">{work.role} - <span className="company">{work.company}</span></h4>
                          <span className="timeline-date">{work.duration || work.start_date + ' - ' + work.end_date || ""}</span>
                          {work.description && <p className="timeline-desc">{work.description}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="empty-text">No formal work experience listed.</p>
                )}

                {candidate.projects && candidate.projects.length > 0 && (
                  <>
                    <h3 className="card-sec-title" style={{ marginTop: '2rem' }}>Projects</h3>
                    <div className="timeline">
                      {candidate.projects.map((proj, index) => (
                        <div key={index} className="timeline-item project-item">
                          <div className="timeline-dot project-dot"></div>
                          <div className="timeline-content">
                            <h4 className="timeline-title">
                              {proj.name || proj.project_name || "Project"} 
                              {(proj.link || proj.live_link) && (
                                <a href={proj.link || proj.live_link} target="_blank" rel="noreferrer" className="proj-link"> 🔗</a>
                              )}
                            </h4>
                            <p className="timeline-desc">{proj.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Right Column: Education & Actions */}
              <div className="overview-card education-col">
                <h3 className="card-sec-title">Education</h3>
                {candidate.education && candidate.education.length > 0 ? (
                  <div className="edu-list">
                    {candidate.education.map((edu, index) => (
                      <div key={index} className="edu-item">
                        <h4 className="edu-degree">{edu.degree}</h4>
                        <span className="edu-inst">{edu.institution}</span>
                        <div className="edu-meta">
                          <span className="edu-duration">{edu.duration || edu.start_date + ' - ' + edu.end_date || ""}</span>
                          {edu.percentage && <span className="edu-grade">Grade: {edu.percentage}%</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="empty-text">No education details listed.</p>
                )}

                {/* Actions Sidebar */}
                <div className="detail-actions-sidebar">
                  <button className="btn-detail-action download" onClick={(e) => handleDownloadResume(candidate, e)}>
                    Download Resume
                  </button>
                  <button className="btn-detail-action shortlist" onClick={() => handleUpdateStatus(candidate._id, "Shortlisted")}>
                     Shortlist
                  </button>
                  <button className="btn-detail-action reject" onClick={() => handleUpdateStatus(candidate._id, "Rejected")}>
                     Reject
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* RESUME TAB */}
          {activeTab === "Resume" && (
            <div className="resume-tab-view">
              <div className="resume-paper">
                <div className="resume-paper-header">
                  <h1>{candidate.candidate_profile?.full_name || "Resume"}</h1>
                  <div className="resume-contact-info">
                    {candidate.candidate_profile?.email && <span>{candidate.candidate_profile.email}</span>}
                    {candidate.candidate_profile?.phone && <span> | {candidate.candidate_profile.phone}</span>}
                    {candidate.candidate_profile?.location && <span> | {candidate.candidate_profile.location}</span>}
                  </div>
                </div>

                {candidate.professional_summary && (
                  <div className="resume-paper-section">
                    <h3 className="section-heading">Professional Summary</h3>
                    <p>{candidate.professional_summary}</p>
                  </div>
                )}

                <div className="resume-paper-section">
                  <h3 className="section-heading">Skills</h3>
                  <div className="resume-skills-grid">
                    {Object.entries(candidate.technical_skills || {}).map(([key, val]) => {
                      if (!val || (Array.isArray(val) && val.length === 0)) return null;
                      return (
                        <div key={key} className="resume-skill-cat">
                          <strong>{key.replace('_', ' ').toUpperCase()}: </strong>
                          <span>{Array.isArray(val) ? val.join(', ') : val}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {candidate.work_experience && candidate.work_experience.length > 0 && (
                  <div className="resume-paper-section">
                    <h3 className="section-heading">Work Experience</h3>
                    {candidate.work_experience.map((work, idx) => (
                      <div key={idx} className="resume-item">
                        <div className="resume-item-header">
                          <strong>{work.role}</strong> - {work.company}
                          <span className="resume-item-date">{work.duration || work.start_date + ' - ' + work.end_date || ""}</span>
                        </div>
                        <p>{work.description}</p>
                      </div>
                    ))}
                  </div>
                )}

                {candidate.projects && candidate.projects.length > 0 && (
                  <div className="resume-paper-section">
                    <h3 className="section-heading">Projects</h3>
                    {candidate.projects.map((proj, idx) => (
                      <div key={idx} className="resume-item">
                        <div className="resume-item-header">
                          <strong>{proj.name || proj.project_name}</strong>
                          {proj.link && <span className="resume-item-date">{proj.link}</span>}
                        </div>
                        <p>{proj.description}</p>
                      </div>
                    ))}
                  </div>
                )}

                {candidate.education && candidate.education.length > 0 && (
                  <div className="resume-paper-section">
                    <h3 className="section-heading">Education</h3>
                    {candidate.education.map((edu, idx) => (
                      <div key={idx} className="resume-item">
                        <div className="resume-item-header">
                          <strong>{edu.degree}</strong> - {edu.institution}
                          <span className="resume-item-date">{edu.duration || edu.start_date + ' - ' + edu.end_date || ""}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ANALYSIS TAB */}
          {activeTab === "Analysis" && (
            <div className="analysis-tab-view">
              <div className="analysis-card">
                <h3 className="analysis-card-title">AI Assessment & Recommendation</h3>
                
                <div className="scores-grid">
                  <div className="score-ring-container">
                    <div className="score-ring" style={{ borderColor: scoreColor }}>
                      <span className="score-num">{candidate.resume_analysis?.ats_score || 0}</span>
                      <span className="score-max">/100</span>
                    </div>
                    <span className="ring-label">Overall ATS Score</span>
                  </div>

                  <div className="score-metrics-list">
                    <div className="metric-row">
                      <span className="metric-label">Technical Score</span>
                      <div className="metric-bar-container">
                        <div className="metric-bar" style={{ width: `${candidate.resume_analysis?.technical_score || 50}%`, backgroundColor: '#3b82f6' }}></div>
                      </div>
                      <span className="metric-value">{candidate.resume_analysis?.technical_score || 0}%</span>
                    </div>

                    <div className="metric-row">
                      <span className="metric-label">Communication Score</span>
                      <div className="metric-bar-container">
                        <div className="metric-bar" style={{ width: `${candidate.resume_analysis?.communication_score || 50}%`, backgroundColor: '#10b981' }}></div>
                      </div>
                      <span className="metric-value">{candidate.resume_analysis?.communication_score || 0}%</span>
                    </div>
                  </div>
                </div>

                <div className="analysis-reasoning">
                  <h4>Reason for Decision:</h4>
                  <p>{candidate.resume_analysis?.reason_for_decision || "No reason given."}</p>
                </div>

                <div className="strengths-weaknesses-row">
                  <div className="sw-box strengths">
                    <h4>Strengths</h4>
                    <ul>
                      {candidate.resume_analysis?.resume_strengths && candidate.resume_analysis.resume_strengths.length > 0 ? (
                        candidate.resume_analysis.resume_strengths.map((str, idx) => (
                          <li key={idx}>✓ {str}</li>
                        ))
                      ) : (
                        <li>No specific strengths recorded.</li>
                      )}
                    </ul>
                  </div>

                  <div className="sw-box weaknesses">
                    <h4>Weaknesses</h4>
                    <ul>
                      {candidate.resume_analysis?.resume_weaknesses && candidate.resume_analysis.resume_weaknesses.length > 0 ? (
                        candidate.resume_analysis.resume_weaknesses.map((weak, idx) => (
                          <li key={idx}> {weak}</li>
                        ))
                      ) : (
                        <li>No specific weaknesses recorded.</li>
                      )}
                    </ul>
                  </div>
                </div>

                {candidate.resume_analysis?.best_matching_roles && (
                  <div className="matching-roles-sec">
                    <h4>Best Matching Roles</h4>
                    <div className="roles-list">
                      {candidate.resume_analysis.best_matching_roles.map((role, idx) => (
                        <span key={idx} className="role-pill">{role}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ACTIVITY TAB */}
          {activeTab === "Activity" && (
            <div className="activity-tab-view">
              <div className="timeline">
                <div className="timeline-item">
                  <div className="timeline-dot active"></div>
                  <div className="timeline-content">
                    <h4 className="timeline-title">Status Updated</h4>
                    <span className="timeline-date">Just Now</span>
                    <p className="timeline-desc">Candidate status is marked as <strong>{statusDetails.label}</strong></p>
                  </div>
                </div>

                <div className="timeline-item">
                  <div className="timeline-dot"></div>
                  <div className="timeline-content">
                    <h4 className="timeline-title">AI Screening Completed</h4>
                    <span className="timeline-date">
                      {candidate.created_at ? new Date(candidate.created_at).toLocaleDateString() : "Recently"}
                    </span>
                    <p className="timeline-desc">
                      AI evaluated the resume and generated a score of <strong>{candidate.resume_analysis?.ats_score || 0}/100</strong>.
                    </p>
                  </div>
                </div>

                <div className="timeline-item">
                  <div className="timeline-dot"></div>
                  <div className="timeline-content">
                    <h4 className="timeline-title">Resume Received</h4>
                    <span className="timeline-date">
                      {candidate.created_at ? new Date(candidate.created_at).toLocaleDateString() : "Recently"}
                    </span>
                    <p className="timeline-desc">Resume successfully uploaded via <strong>{candidate.source || "AI Resume Screening"}</strong>.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    );
  }

  // RENDER CANDIDATES LIST VIEW
  return (
    <div className="candidates-container">
      {/* Header section */}
      <div className="candidates-header-row">
        <div>
          <h1 className="candidates-title">Candidates</h1>
          <p className="candidates-subtitle">Manage and review all candidate applications.</p>
        </div>
        
        <div className="candidates-actions">
          <div className="search-box">
            <span className="search-icon"></span>
            <input 
              type="text" 
              placeholder="Search candidates..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="btn-filter" onClick={fetchCandidates} title="Reload Candidates">
            <span className="icon"></span> Refresh
          </button>
        </div>
      </div>

      {/* Filter row */}
      <div className="candidates-filters-row">
        <select className="filter-select" value={selectedJob} onChange={e => setSelectedJob(e.target.value)}>
          {uniqueJobs.map((job, idx) => <option key={idx} value={job}>{job}</option>)}
        </select>
        <select className="filter-select" value={selectedSkill} onChange={e => setSelectedSkill(e.target.value)}>
          {uniqueSkills.map((skill, idx) => <option key={idx} value={skill}>{skill}</option>)}
        </select>
        <select className="filter-select" value={selectedExperience} onChange={e => setSelectedExperience(e.target.value)}>
          {uniqueExperience.map((exp, idx) => <option key={idx} value={exp}>{exp}</option>)}
        </select>

        {/* Select mode toggle button */}
        {!selectMode ? (
          <button
            className="btn-select-mode"
            onClick={() => setSelectMode(true)}
          >
            ☑ Select
          </button>
        ) : (
          <div className="select-mode-bar">
            <span className="bulk-count">{selectedIds.size} selected</span>
            {selectedIds.size > 0 && (
              <button
                className="bulk-delete-btn"
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
              >
                {bulkDeleting ? "Deleting…" : `🗑 Delete ${selectedIds.size}`}
              </button>
            )}
            <button
              className="btn-cancel-select"
              onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }}
            >
              ✕ Cancel
            </button>
          </div>
        )}
      </div>

      {/* Loading & Error Indicators */}
      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading candidate details...</p>
        </div>
      ) : error ? (
        <div className="error-state">
          <p> {error}</p>
          <button onClick={fetchCandidates} className="retry-btn">Retry</button>
        </div>
      ) : filteredCandidates.length === 0 ? (
        <div className="empty-state">
          <p>No candidates found matching the criteria.</p>
        </div>
      ) : (
        /* Table section */
        <div className="table-responsive">
          <table className="candidates-table">
            <thead>
              <tr>
                {selectMode && (
                  <th className="col-check">
                    <input
                      type="checkbox"
                      className="bulk-checkbox"
                      checked={selectedIds.size === filteredCandidates.length && filteredCandidates.length > 0}
                      ref={el => {
                        if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < filteredCandidates.length;
                      }}
                      onChange={toggleSelectAll}
                      title="Select all"
                    />
                  </th>
                )}
                <th>Candidate</th>
                <th>Skills</th>
                <th>Experience</th>
                <th>AI Score</th>
                <th>Match Score</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCandidates.map(candidate => {
                const name = candidate.candidate_profile?.full_name || "Unnamed Candidate";
                const email = candidate.candidate_profile?.email || "";
                const skillsList = getCandidateSkillsList(candidate);
                const avatarStyle = getAvatarColor(name);
                const scoreColor = getScoreColor(candidate.resume_analysis?.ats_score || 0);
                const isChecked = selectedIds.has(candidate._id);

                return (
                  <tr
                    key={candidate._id}
                    className={isChecked ? "row-selected" : ""}
                  >
                    {selectMode && (
                      <td className="col-check" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="bulk-checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelect(candidate._id)}
                        />
                      </td>
                    )}
                    <td data-label="Candidate">
                      <div className="candidate-info">
                        <div className="candidate-avatar" style={{ backgroundColor: avatarStyle.bg, color: avatarStyle.text }}>
                          {getInitials(name)}
                        </div>
                        <div>
                          <div className="candidate-name">{name}</div>
                          <div className="candidate-email">{email}</div>
                        </div>
                      </div>
                    </td>
                    <td data-label="Skills">
                      <div className="skills-container">
                        {skillsList.slice(0, 3).map((skill, index) => (
                          <span key={index} className="skill-pill">{skill}</span>
                        ))}
                        {skillsList.length > 3 && (
                          <span className="skill-pill-more">+{skillsList.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td data-label="Experience">{candidate.resume_analysis?.experience_level || "Entry-Level"}</td>
                    <td data-label="AI Score" style={{ color: scoreColor, fontWeight: 600 }}>
                      {candidate.resume_analysis?.ats_score || 0}/100
                    </td>
                    <td data-label="Match Score">{candidate.resume_analysis?.ats_score || 0}%</td>
                    <td data-label="Actions">
                      <div className="actions-container">
                        <button className="action-btn" title="View Profile" onClick={() => setSelectedCandidate(candidate)}>
                          View
                        </button>
                        <button className="action-btn" title="Download Resume" onClick={(e) => handleDownloadResume(candidate, e)}>
                          Download
                        </button>
                        <button className="action-btn action-btn-delete" title="Delete Candidate" onClick={(e) => handleDeleteCandidate(candidate._id, e)}>
                          Delete
                        </button>
                      </div>
                    </td>
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
