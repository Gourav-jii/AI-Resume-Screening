import { useState, useRef, useEffect } from "react";
import "./AppStyles.css";
import Auth from "./components/Auth";
import Candidates from "./components/Candidates";
import Shortlisted from "./components/Shortlisted";
import AIAnalysis from "./components/AIAnalysis";
import Dashboard from "./components/Dashboard";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

function App() {
  const [user, setUser] = useState(() => {
    const session = localStorage.getItem("auth_currentUser");
    return session ? JSON.parse(session) : null;
  });

  // Dark mode — persisted in localStorage
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("theme");
    if (saved) return saved === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.setAttribute("data-theme", "dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.removeAttribute("data-theme");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

  const token = localStorage.getItem("auth_token") || null;

  const [selectedFiles, setSelectedFiles] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [activeSection, setActiveSection] = useState("dashboard");
  const [jobTitle, setJobTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [location, setLocation] = useState("");
  const [skills, setSkills] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [thresholdScore, setThresholdScore] = useState(70);
  const [showJobModal, setShowJobModal] = useState(false);
  const [editingJob, setEditingJob] = useState(null); // null = add mode, object = edit mode
  const [jdFormSubmitted, setJdFormSubmitted] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [savedJobDescriptions, setSavedJobDescriptions] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [toast, setToast] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [jdViewMode, setJdViewMode] = useState("list"); // "list" | "grid"
  const toastTimer = useRef(null);
  const panelRef = useRef(null);
  const userMenuRef = useRef(null);

  // Close user menu on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const showToast = (message, type = "success") => {
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
    }

    setToast({ message, type });
    toastTimer.current = setTimeout(() => {
      setToast(null);
      toastTimer.current = null;
    }, 3200);
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setSelectedFiles(files);
    setToast(null);
  };

  const removeFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      showToast("Please choose at least one resume file.", "error");
      return;
    }
    if (!selectedJobId) {
      showToast("Please select a job title before uploading.", "error");
      return;
    }

    const selectedJob = savedJobDescriptions.find((job) => job._id === selectedJobId);

    setIsUploading(true);
    setUploadProgress({ current: 0, total: selectedFiles.length });
    setToast(null);

    let successCount = 0;
    let failCount    = 0;

    try {
      const fd = new FormData();
      selectedFiles.forEach((file) => {
        fd.append("resume", file);
      });
      fd.append("jobId",          selectedJobId);
      fd.append("jobTitle",       selectedJob?.jobTitle   || "");
      fd.append("department",     selectedJob?.department || "");
      fd.append("location",       selectedJob?.location   || "");
      fd.append("skills",         selectedJob?.skills     || "");
      fd.append("jobDescription", selectedJob?.description || "");

      // Send all files in a single POST request
      const res = await fetch(`${API_URL}/api/resume-upload`, {
        method: "POST",
        body:   fd,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${res.status}`);
      }

      const result = await res.json();

      if (result.files && result.files.length > 0) {
        // Count skipped duplicates
        const skipped = result.files.filter(f => f.skipped).length;
        const toProcess = result.files.filter(f => !f.skipped);

        if (skipped > 0 && toProcess.length === 0) {
          showToast(`${skipped} resume${skipped > 1 ? "s" : ""} already uploaded. No duplicates added.`, "error");
          setSelectedFiles([]);
          setSelectedJobId("");
          setIsUploading(false);
          setUploadProgress({ current: 0, total: 0 });
          return;
        }

        if (skipped > 0) {
          showToast(`${skipped} duplicate${skipped > 1 ? "s" : ""} skipped.`, "error");
        }

        for (let i = 0; i < toProcess.length; i++) {
          const fileInfo = toProcess[i];
          setUploadProgress({ current: i + 1, total: toProcess.length });

          // Save candidate placeholder to database
          await fetch(`${API_URL}/api/candidates/save`, {
            method:  "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body:    JSON.stringify({
              candidate_profile: {
                full_name: fileInfo.originalName
                  .replace(/\.(pdf|doc|docx)$/i, "")
                  .replace(/[-_]+/g, " ")
                  .replace(/\s+/g, " ")
                  .trim()
                  .split(" ")
                  .slice(0, 4)
                  .join(" ") || "Candidate"
              },
              filePath:     fileInfo.filePath,
              originalName: fileInfo.originalName,
              jobId:        selectedJobId,
              source:       "AI Resume Screening",
              status:       "Pending",
            }),
          });
          successCount++;
        }
      } else {
        throw new Error("No files uploaded successfully.");
      }
    } catch (err) {
      console.error("[Upload] Batch upload failed:", err.message);
      failCount = selectedFiles.length;
    }

    if (failCount === 0) {
      showToast(`${successCount} resume${successCount > 1 ? "s" : ""} uploaded successfully!`, "success");
    } else if (successCount === 0) {
      showToast("All uploads failed. Please try again.", "error");
    } else {
      showToast(`${successCount} uploaded, ${failCount} failed.`, "error");
    }

    setSelectedFiles([]);
    setSelectedJobId("");
    setIsUploading(false);
    setUploadProgress({ current: 0, total: 0 });
  };

  const handleJsonError = async (response) => {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const errorData = await response.json();
      return errorData.message || response.statusText;
    }

    const errorText = await response.text();
    if (errorText.trim().startsWith("<")) {
      return response.statusText || "Server error.";
    }
    return errorText || response.statusText;
  };

  const openAddModal = () => {
    setJdFormSubmitted(false);
    setEditingJob(null);
    setJobTitle("");
    setDepartment("");
    setLocation("");
    setSkills("");
    setJobDescription("");
    setThresholdScore(70);
    setShowJobModal(true);
  };

  const openEditModal = (job) => {
    setJdFormSubmitted(false);
    setEditingJob(job);
    setJobTitle(job.jobTitle);
    setDepartment(job.department || "");
    setLocation(job.location || "");
    setSkills(job.skills || "");
    setJobDescription(job.description || "");
    setThresholdScore(job.thresholdScore != null ? job.thresholdScore : 70);
    setShowJobModal(true);
  };

  const closeModal = () => {
    setJdFormSubmitted(false);
    setShowJobModal(false);
    setEditingJob(null);
    setJobTitle("");
    setDepartment("");
    setLocation("");
    setSkills("");
    setJobDescription("");
    setThresholdScore(70);
  };

  const handleJobDescriptionSubmit = async (e) => {
    e.preventDefault();
    setJdFormSubmitted(true);

    if (!jobTitle.trim() || !skills.trim() || !jobDescription.trim()) {
      showToast("Please fill in all required fields.", "error");
      return;
    }

    try {
      const isEditing = !!editingJob;
      const url = isEditing
        ? `${API_URL}/api/job-description/${editingJob._id}`
        : `${API_URL}/api/job-description`;
      const method = isEditing ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobTitle,
          department,
          location,
          skills,
          description: jobDescription,
          thresholdScore: Number(thresholdScore),
          createdBy: user?.email,
        }),
      });

      if (!response.ok) {
        const errorMessage = await handleJsonError(response);
        throw new Error(errorMessage || "Unable to save job description.");
      }

      await fetchJobs();
      showToast(isEditing ? "Job updated successfully." : "Job description saved.", "success");
      closeModal();
    } catch (error) {
      console.error("Save JD error:", error);
      showToast(error.message || "Failed to save job description.", "error");
    }
  };

  const handleDeleteJob = async (jobId) => {
    try {
      const response = await fetch(
        `${API_URL}/api/job-description/${jobId}?email=${encodeURIComponent(user.email)}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        const errorMessage = await handleJsonError(response);
        throw new Error(errorMessage || "Unable to delete job.");
      }

      await fetchJobs();
      setDeleteConfirmId(null);
      showToast("Job deleted.", "success");
    } catch (error) {
      showToast(error.message || "Failed to delete job.", "error");
    }
  };

  const handleSidebarSelect = (section) => {
    setActiveSection(section);

    if (panelRef.current) {
      panelRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Fetch job descriptions from backend when the app loads and when user opens the Job section
  const fetchJobs = async () => {
    if (!user?.email) return;
    try {
      setLoadingJobs(true);
      const res = await fetch(
        `${API_URL}/api/job-description?email=${encodeURIComponent(user.email)}`
      );
      if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
      const data = await res.json();
      const jobs = Array.isArray(data) ? data : (data?.jobs || []);
      setSavedJobDescriptions(jobs);
    } catch (err) {
      console.error("Error fetching job descriptions:", err);
      showToast(err.message || "Unable to load job descriptions.", "error");
      setSavedJobDescriptions([]);
    } finally {
      setLoadingJobs(false);
    }
  };

  useEffect(() => {
    if (user?.email) fetchJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (activeSection === "job") fetchJobs();
  }, [activeSection]);

  const handleLoginSuccess = (loggedInData) => {
    // loggedInData may be { token, user } from the backend
    if (loggedInData?.token) {
      localStorage.setItem("auth_token", loggedInData.token);
      setUser(loggedInData.user || null);
    } else {
      // fallback for older shape
      setUser(loggedInData);
    }

    setSavedJobDescriptions([]);
    showToast(`Welcome back, ${loggedInData?.user?.name || loggedInData?.name || "User"}!`, "success");
  };


  const handleLogout = () => {
    localStorage.removeItem("auth_currentUser");
    localStorage.removeItem("auth_token");
    setUser(null);

    setSavedJobDescriptions([]);
    setSelectedJobId("");
    setSelectedFiles([]);
    setActiveSection("dashboard");
    showToast("Signed out successfully.", "success");
  };

  return (
    <div className="app-screen">
      {!user ? (
        <Auth onLoginSuccess={handleLoginSuccess} />
      ) : (
        <div className="dashboard-shell">
          <header className="topbar">
            <button
              type="button"
              className="mobile-menu-toggle"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="4" y1="18" x2="20" y2="18" />
              </svg>
            </button>
            <div className="brand">
              <span className="brand-mark">R</span>
              <div className="brand-copy">
                <strong>AI Resume</strong>
                <span>Screening</span>
              </div>
            </div>

            {/* User menu — top right */}
            <div className="topbar-user-menu" ref={userMenuRef}>
              <button
                type="button"
                className="topbar-user-trigger"
                onClick={() => setUserMenuOpen((o) => !o)}
                aria-label="User menu"
              >
                <div className="topbar-avatar">
                  {user.name ? user.name.charAt(0).toUpperCase() : "U"}
                </div>
                <div className="topbar-user-info">
                  <span className="topbar-user-name">{user.name || "User"}</span>
                  <span className="topbar-user-email">{user.email}</span>
                </div>
                <svg className={`topbar-chevron ${userMenuOpen ? "open" : ""}`} xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m6 9 6 6 6-6"/>
                </svg>
              </button>

              {userMenuOpen && (
                <div className="topbar-dropdown">
                  {/* Profile info */}
                  <div className="dropdown-profile">
                    <div className="dropdown-avatar">
                      {user.name ? user.name.charAt(0).toUpperCase() : "U"}
                    </div>
                    <div>
                      <div className="dropdown-name">{user.name || "User"}</div>
                      <div className="dropdown-email">{user.email}</div>
                    </div>
                  </div>

                  <div className="dropdown-divider" />

                  {/* Theme toggle inside dropdown */}
                  <button
                    type="button"
                    className="dropdown-item"
                    onClick={() => setDarkMode((d) => !d)}
                  >
                    <span className="dropdown-item-icon">{darkMode ? "" : ""}</span>
                    <span>{darkMode ? "Dark Mode" : "Light Mode"}</span>
                    <span className="dropdown-item-badge">{darkMode ? "On" : "Off"}</span>
                  </button>

                  <div className="dropdown-divider" />

                  {/* Sign out */}
                  <button
                    type="button"
                    className="dropdown-item dropdown-signout"
                    onClick={() => { setUserMenuOpen(false); handleLogout(); }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                      <polyline points="16 17 21 12 16 7"/>
                      <line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </header>

          {mobileMenuOpen && (
            <div className="mobile-drawer-overlay" onClick={() => setMobileMenuOpen(false)}>
              <div className="mobile-drawer" onClick={(e) => e.stopPropagation()}>
                <div className="mobile-drawer-header">
                  <div className="brand">
                    <span className="brand-mark">R</span>
                    <div className="brand-copy">
                      <strong>AI Resume</strong>
                      <span>Screening</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="mobile-drawer-close"
                    onClick={() => setMobileMenuOpen(false)}
                    aria-label="Close menu"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>

                <div className="mobile-drawer-body">
                  <div className="drawer-heading">Workspace</div>
                  <nav className="drawer-nav">
                    <button
                      type="button"
                      className={`drawer-item ${activeSection === "dashboard" ? "active" : ""}`}
                      onClick={() => { handleSidebarSelect("dashboard"); setMobileMenuOpen(false); }}
                    >
                      Dashboard
                    </button>
                    <button
                      type="button"
                      className={`drawer-item ${activeSection === "upload" ? "active" : ""}`}
                      onClick={() => { handleSidebarSelect("upload"); setMobileMenuOpen(false); }}
                    >
                      Upload Resume
                    </button>
                    <button
                      type="button"
                      className={`drawer-item ${activeSection === "job" ? "active" : ""}`}
                      onClick={() => { handleSidebarSelect("job"); setMobileMenuOpen(false); }}
                    >
                      Job Description
                    </button>
                    <button
                      type="button"
                      className={`drawer-item ${activeSection === "candidates" ? "active" : ""}`}
                      onClick={() => { handleSidebarSelect("candidates"); setMobileMenuOpen(false); }}
                    >
                      Candidates
                    </button>
                    <button
                      type="button"
                      className={`drawer-item ${activeSection === "shortlisted" ? "active" : ""}`}
                      onClick={() => { handleSidebarSelect("shortlisted"); setMobileMenuOpen(false); }}
                    >
                      Shortlisted
                    </button>
                    <button
                      type="button"
                      className={`drawer-item ${activeSection === "aianalysis" ? "active" : ""}`}
                      onClick={() => { handleSidebarSelect("aianalysis"); setMobileMenuOpen(false); }}
                    >
                      AI Analysis
                    </button>
                  </nav>

                  <div className="drawer-divider" />

                  <button
                    type="button"
                    className="drawer-theme-toggle"
                    onClick={() => setDarkMode((d) => !d)}
                  >
                    <span className="theme-toggle-label">
                      {darkMode ? "Dark Mode" : "Light Mode"}
                    </span>
                    <span className="theme-toggle-track">
                      <span className="theme-toggle-thumb" style={{ transform: darkMode ? "translateX(18px)" : "translateX(0px)" }} />
                    </span>
                  </button>
                </div>

                <div className="mobile-drawer-footer">
                  <div className="drawer-user">
                    <div className="drawer-avatar">
                      {user.name ? user.name.charAt(0).toUpperCase() : "U"}
                    </div>
                    <div className="drawer-user-meta">
                      <span className="drawer-user-name">{user.name}</span>
                      <small className="drawer-user-email">{user.email}</small>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="drawer-signout-btn"
                    onClick={() => { setMobileMenuOpen(false); handleLogout(); }}
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="dashboard-layout">
            <aside className="dashboard-sidebar">
              <div className="sidebar-heading">Workspace</div>
              <button
                type="button"
                className={`sidebar-item ${activeSection === "dashboard" ? "active" : ""}`}
                onClick={() => handleSidebarSelect("dashboard")}
              >
                Dashboard
              </button>
              <button
                type="button"
                className={`sidebar-item ${activeSection === "upload" ? "active" : ""}`}
                onClick={() => handleSidebarSelect("upload")}
              >
                Upload Resume
              </button>
              <button
                type="button"
                className={`sidebar-item ${activeSection === "job" ? "active" : ""}`}
                onClick={() => handleSidebarSelect("job")}
              >
                Job Description
              </button>
              <button
                type="button"
                className={`sidebar-item ${activeSection === "candidates" ? "active" : ""}`}
                onClick={() => handleSidebarSelect("candidates")}
              >
                Candidates
              </button>
              <button
                type="button"
                className={`sidebar-item ${activeSection === "shortlisted" ? "active" : ""}`}
                onClick={() => handleSidebarSelect("shortlisted")}
              >
                Shortlisted
              </button>
              <button
                type="button"
                className={`sidebar-item ${activeSection === "aianalysis" ? "active" : ""}`}
                onClick={() => handleSidebarSelect("aianalysis")}
              >
                AI Analysis
              </button>

              {/* User profile at bottom of sidebar */}
              <div className="sidebar-spacer" />

              {/* Theme toggle */}
              <button
                type="button"
                className="theme-toggle-btn"
                onClick={() => setDarkMode((d) => !d)}
                title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
              >
                <span className="theme-toggle-track">
                  <span className="theme-toggle-thumb" />
                </span>
                <span className="theme-toggle-label">
                  {darkMode ? "Dark Mode" : "Light Mode"}
                </span>
              </button>

              <div className="sidebar-user-card">
                <div className="sidebar-user-avatar">
                  {user.name ? user.name.charAt(0).toUpperCase() : "U"}
                </div>
                <div className="sidebar-user-info">
                  <span className="sidebar-user-name">{user.name}</span>
                  <small className="sidebar-user-email">{user.email}</small>
                </div>
                <button
                  type="button"
                  className="sidebar-signout-btn"
                  onClick={handleLogout}
                  title="Sign Out"
                >
                  ⏻
                </button>
              </div>
            </aside>

            <main className="dashboard-content">
              {activeSection === "dashboard" && (
                <section className="panel-card" ref={panelRef}>
                  <Dashboard key={`dashboard-${user?.userId || user?.email}`} user={user} onNavigate={handleSidebarSelect} />
                </section>
              )}

              {activeSection === "upload" && (
                <section className="panel-card" ref={panelRef}>
                  {/* Header row: label + title + description, all left-aligned */}
                  <div className="upload-panel-header">
                    <span className="panel-label">Upload Resume</span>
                    <h1 className="upload-panel-title">Resume Upload</h1>
                    <p className="upload-panel-desc">
                      Upload your resume in PDF or Word format and let the system
                      extract key details automatically.
                    </p>
                  </div>

                  {/* Two-column row: job title left, file picker right */}
                  <div className="upload-two-col">
                    {/* Left: Job Title Dropdown */}
                    <div className="upload-col">
                      <label htmlFor="job-select" className="upload-field-label">
                        Job Title
                      </label>
                      <div className="job-select-container">
                        <select
                          id="job-select"
                          className="job-select"
                          value={selectedJobId}
                          onChange={(e) => setSelectedJobId(e.target.value)}
                        >
                          <option value="">
                            {loadingJobs
                              ? "Loading jobs..."
                              : savedJobDescriptions.length === 0
                              ? "No jobs available"
                              : "Select a job title"}
                          </option>
                          {savedJobDescriptions.map((job) => (
                            <option key={job._id} value={job._id}>
                              {job.jobTitle}
                              {job.department ? ` · ${job.department}` : ""}
                            </option>
                          ))}
                        </select>
                        <span className="job-select-arrow">▾</span>
                      </div>
                      {selectedJobId && (() => {
                        const job = savedJobDescriptions.find(j => j._id === selectedJobId);
                        return job ? (
                          <div className="job-select-preview">
                            {job.location && <span> {job.location}</span>}
                            {job.skills && <span> {job.skills}</span>}
                          </div>
                        ) : null;
                      })()}
                    </div>

                    {/* Right: File Picker + Upload Button */}
                    <div className="upload-col">
                      <label className="upload-field-label">Resume Files</label>
                      <input
                        id="resume-upload"
                        type="file"
                        accept=".pdf"
                        multiple
                        onChange={handleFileChange}
                        className="file-input"
                      />
                      <label htmlFor="resume-upload" className="file-picker">
                        <span>
                          {selectedFiles.length === 0
                            ? "Choose resume files"
                            : `${selectedFiles.length} file${selectedFiles.length > 1 ? "s" : ""} selected`}
                        </span>
                        <span className="file-picker-icon"></span>
                      </label>

                      {/* File list with count badge + remove */}
                      {selectedFiles.length > 0 && (
                        <div className="file-list">
                          <div className="file-list-header">
                            <span className="file-list-count">
                              {selectedFiles.length} file{selectedFiles.length > 1 ? "s" : ""} ready
                            </span>
                            <button
                              type="button"
                              className="file-list-clear"
                              onClick={() => setSelectedFiles([])}
                            >
                              Clear all
                            </button>
                          </div>
                          <ul className="file-list-items">
                            {selectedFiles.map((file, i) => (
                              <li key={i} className="file-list-item">
                                <span className="file-list-icon"></span>
                                <span className="file-list-name">{file.name}</span>
                                <span className="file-list-size">
                                  {(file.size / 1024).toFixed(0)} KB
                                </span>
                                <button
                                  type="button"
                                  className="file-list-remove"
                                  onClick={() => removeFile(i)}
                                  title="Remove"
                                >
                                  ×
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <p className="file-hint">Supported: .pdf, .doc, .docx — multiple allowed</p>
                      <div className="upload-submit-row">
                        <button
                          type="button"
                          onClick={handleUpload}
                          className="upload-button"
                          disabled={isUploading}
                        >
                          {isUploading
                            ? "Uploading..."
                            : `Upload${selectedFiles.length > 1 ? ` ${selectedFiles.length} Resumes` : " Resume"}`}
                        </button>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {activeSection === "job" && (
                <section className="panel-card" ref={panelRef}>

                  {/* ── Top bar ── */}
                  <div className="jd-topbar">
                    <div className="jd-topbar-left">
                      <span className="panel-label">Job Description</span>
                      <h1 className="jd-title">Position Details</h1>
                      <p className="jd-subtitle">
                        Manage your open positions. Click <strong>Add Job</strong> to create a new listing.
                      </p>
                    </div>
                    <div className="jd-topbar-right">
                      {/* View toggle */}
                      {savedJobDescriptions.length > 0 && (
                        <div className="jd-view-toggle">
                          <button
                            type="button"
                            className={`jd-view-btn ${jdViewMode === "list" ? "active" : ""}`}
                            onClick={() => setJdViewMode("list")}
                            title="List view"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                              <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                            </svg>
                          </button>
                          <button
                            type="button"
                            className={`jd-view-btn ${jdViewMode === "grid" ? "active" : ""}`}
                            onClick={() => setJdViewMode("grid")}
                            title="Grid view"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                              <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
                            </svg>
                          </button>
                        </div>
                      )}
                      <button
                        type="button"
                        className="add-job-button"
                        onClick={openAddModal}
                      >
                        + Add Job
                      </button>
                    </div>
                  </div>

                  {/* ── Job list ── */}
                  {loadingJobs ? (
                    <p className="empty-note">Loading job descriptions…</p>
                  ) : savedJobDescriptions.length > 0 ? (
                    <div className="jd-list-section">
                      <div className="jd-list-meta">
                        <span className="jd-list-count">{savedJobDescriptions.length} position{savedJobDescriptions.length !== 1 ? "s" : ""}</span>
                      </div>

                      <ul className={`jd-list ${jdViewMode === "grid" ? "jd-list-grid" : ""}`}>
                        {savedJobDescriptions.map((job, index) => (
                          <li key={index} className={`jd-card ${jdViewMode === "grid" ? "jd-card-grid" : ""}`}>

                            {/* Row 1: avatar + title + dept */}
                            <div className="jd-card-top">
                              <div className="jd-card-left">
                                <div className="jd-card-avatar">
                                  {job.jobTitle.charAt(0).toUpperCase()}
                                </div>
                                <div className="jd-card-info">
                                  <h4 className="jd-card-title">{job.jobTitle}</h4>
                                  {job.department && (
                                    <span className="jd-card-dept">{job.department}</span>
                                  )}
                                </div>
                              </div>

                              {/* Actions: right side in list, bottom in grid */}
                              {jdViewMode === "list" && (
                                <div className="jd-card-actions">
                                  <button
                                    type="button"
                                    className="jd-action-btn jd-edit-btn"
                                    onClick={() => openEditModal(job)}
                                  >
                                     Edit
                                  </button>
                                  <button
                                    type="button"
                                    className="jd-action-btn jd-delete-btn"
                                    onClick={() => setDeleteConfirmId(job._id)}
                                  >
                                    Delete
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Row 2: location + skills + threshold badges */}
                            {(job.location || job.skills || job.thresholdScore != null) && (
                              <div className="jd-card-badges">
                                {job.location && (
                                  <span className="jd-badge jd-badge-loc"> {job.location}</span>
                                )}
                                {job.skills && (
                                  <span className="jd-badge jd-badge-skill"> {job.skills}</span>
                                )}
                                {job.thresholdScore != null && (
                                  <span className="jd-badge jd-badge-threshold"> Threshold: {job.thresholdScore}%</span>
                                )}
                              </div>
                            )}

                            {/* Row 3: description */}
                            {job.description && (
                              <p className="jd-card-desc">{job.description}</p>
                            )}

                            {/* Grid mode actions — at bottom */}
                            {jdViewMode === "grid" && (
                              <div className="jd-card-actions">
                                <button
                                  type="button"
                                  className="jd-action-btn jd-edit-btn"
                                  onClick={() => openEditModal(job)}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="jd-action-btn jd-delete-btn"
                                  onClick={() => setDeleteConfirmId(job._id)}
                                >
                                  Delete
                                </button>
                              </div>
                            )}

                            {/* Inline delete confirm */}
                            {deleteConfirmId === job._id && (
                              <div className="jd-delete-confirm">
                                <p>Delete <strong>{job.jobTitle}</strong>? This cannot be undone.</p>
                                <div className="jd-delete-actions">
                                  <button
                                    type="button"
                                    className="jd-confirm-cancel"
                                    onClick={() => setDeleteConfirmId(null)}
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    className="jd-confirm-delete"
                                    onClick={() => handleDeleteJob(job._id)}
                                  >
                                    Yes, Delete
                                  </button>
                                </div>
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="jd-empty">
                      <div className="jd-empty-icon"></div>
                      <p className="jd-empty-text">No positions added yet.</p>
                      <p className="jd-empty-sub">Click <strong>Add Job</strong> to create your first listing.</p>
                    </div>
                  )}

                  {showJobModal && (
                    <div className="modal-overlay">
                      <div className="modal">
                        <div className="modal-header">
                          <div>
                            <h2>{editingJob ? "Edit Job Description" : "Add Job Description"}</h2>
                            <p>{editingJob ? "Update the details below." : "Enter all job details in one popup."}</p>
                          </div>
                          <button
                            type="button"
                            className="close-button"
                            onClick={closeModal}
                          >
                            ×
                          </button>
                        </div>

                        <form className="job-form modal-form" onSubmit={handleJobDescriptionSubmit}>
                          <div className="job-form-grid">
                            <label className={jdFormSubmitted && !jobTitle.trim() ? "has-error" : ""}>
                              <span className="label-text">Job Title <span className="required">*</span></span>
                              <input
                                type="text"
                                value={jobTitle}
                                onChange={(e) => setJobTitle(e.target.value)}
                                placeholder="Senior Product Manager"
                              />
                            </label>
                            <label>
                              Department
                              <input
                                type="text"
                                value={department}
                                onChange={(e) => setDepartment(e.target.value)}
                                placeholder="Product"
                              />
                            </label>
                            <label>
                              Location
                              <input
                                type="text"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                placeholder="Remote / New York"
                              />
                            </label>
                            <label className={jdFormSubmitted && !skills.trim() ? "has-error" : ""}>
                              <span className="label-text">Required Skills <span className="required">*</span></span>
                              <input
                                type="text"
                                value={skills}
                                onChange={(e) => setSkills(e.target.value)}
                                placeholder="Leadership, SQL, UX"
                              />
                            </label>
                            <label>
                              <span className="label-text">Threshold Score (%)</span>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={thresholdScore}
                                onChange={(e) => setThresholdScore(e.target.value)}
                                placeholder="70"
                              />
                              <span className="field-hint">Candidates scoring at or above this threshold will be auto-shortlisted</span>
                            </label>
                          </div>

                          <label className={jdFormSubmitted && !jobDescription.trim() ? "has-error" : ""}>
                            <span className="label-text">Job Description <span className="required">*</span></span>
                            <textarea
                              value={jobDescription}
                              onChange={(e) => setJobDescription(e.target.value)}
                              placeholder="Briefly describe the role, responsibilities, and ideal candidate profile."
                            />
                          </label>

                          <div className="modal-actions">
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={closeModal}
                            >
                              Cancel
                            </button>
                            <button type="submit" className="primary-button">
                              {editingJob ? "Update Job" : "Save Job Description"}
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}
                </section>
              )}

              {activeSection === "candidates" && (
                <section className="panel-card" ref={panelRef}>
                  <Candidates key={`candidates-${activeSection}-${Date.now()}`} user={user} />
                </section>
              )}

              {activeSection === "shortlisted" && (
                <section className="panel-card" ref={panelRef}>
                  <Shortlisted key={`shortlisted-${activeSection}-${Date.now()}`} user={user} />
                </section>
              )}

              {activeSection === "aianalysis" && (
                <section className="panel-card" ref={panelRef}>
                  <AIAnalysis key={`aianalysis-${activeSection}-${Date.now()}`} user={user} />
                </section>
              )}
            </main>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={`toast ${toast.type === "error" ? "toast-error" : "toast-success"}`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

export default App;
