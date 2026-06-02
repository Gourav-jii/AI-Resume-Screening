import { useState, useRef, useEffect } from "react";
import "./AppStyles.css";
import Auth from "./components/Auth";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

function App() {
  const [user, setUser] = useState(() => {
    const session = localStorage.getItem("auth_currentUser");
    return session ? JSON.parse(session) : null;
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [activeSection, setActiveSection] = useState("upload");
  const [jobTitle, setJobTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [location, setLocation] = useState("");
  const [skills, setSkills] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [showJobModal, setShowJobModal] = useState(false);
  const [savedJobDescriptions, setSavedJobDescriptions] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [toast, setToast] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const toastTimer = useRef(null);
  const panelRef = useRef(null);

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
    const file = e.target.files[0];
    setSelectedFile(file || null);
    setToast(null);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      showToast("Please choose a resume file before uploading.", "error");
      return;
    }

    setIsUploading(true);
    setToast(null);

    const formData = new FormData();
    formData.append("resume", selectedFile);

    try {
      const response = await fetch(
        "http://localhost:5678/webhook-test/resume_upload",
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      showToast("Resume uploaded successfully!", "success");
      setSelectedFile(null);
    } catch (error) {
      showToast("Upload failed. Please try again.", "error");
    } finally {
      setIsUploading(false);
    }
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

  const handleJobDescriptionSubmit = async (e) => {
    e.preventDefault();

    if (!jobTitle.trim() || !jobDescription.trim()) {
      showToast("Please enter both job title and description.", "error");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/job-description`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jobTitle,
          department,
          location,
          skills,
          description: jobDescription,
          createdBy: user?.email,
        }),
      });

      if (!response.ok) {
        const errorMessage = await handleJsonError(response);
        throw new Error(errorMessage || "Unable to save job description.");
      }

      // Refresh list from backend to reflect persisted job descriptions
      await fetchJobs();
      showToast("Job description saved.", "success");
      setShowJobModal(false);
      setJobTitle("");
      setDepartment("");
      setLocation("");
      setSkills("");
      setJobDescription("");
    } catch (error) {
      console.error("Save JD error:", error);
      showToast(error.message || "Failed to save job description.", "error");
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
    try {
      setLoadingJobs(true);
      const res = await fetch(`${API_URL}/api/job-description`);
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
    fetchJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeSection === "job") fetchJobs();
  }, [activeSection]);

  const handleLoginSuccess = (loggedInUser) => {
    setUser(loggedInUser);
    showToast(`Welcome back, ${loggedInUser.name}!`, "success");
  };

  const handleLogout = () => {
    localStorage.removeItem("auth_currentUser");
    setUser(null);
    showToast("Signed out successfully.", "success");
  };

  return (
    <div className="app-screen">
      {!user ? (
        <Auth onLoginSuccess={handleLoginSuccess} />
      ) : (
        <div className="dashboard-shell">
          <header className="topbar">
            <div className="brand">
              <span className="brand-mark">R</span>
              <div className="brand-copy">
                <strong>AI Resume</strong>
                <span>Screening</span>
              </div>
            </div>

            <div className="topbar-actions">
              <div className="topbar-user">
                <div className="user-avatar">
                  {user.name ? user.name.charAt(0).toUpperCase() : "U"}
                </div>
                <div className="user-meta">
                  <span className="user-name">{user.name}</span>
                  <small className="user-email">{user.email}</small>
                </div>
              </div>
              <button
                type="button"
                className="signout-button"
                onClick={handleLogout}
              >
                Sign Out
              </button>
            </div>
          </header>

          <div className="dashboard-layout">
            <aside className="dashboard-sidebar">
              <div className="sidebar-heading">Workspace</div>
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
            </aside>

            <main className="dashboard-content">
              {activeSection === "upload" && (
                <section className="panel-card" ref={panelRef}>
                  <div className="panel-header">
                    <div>
                      <span className="panel-label">Upload Resume</span>
                      <h1>Resume Upload</h1>
                    </div>
                  </div>

                  <div className="upload-header">
                    <p className="upload-description">
                      Upload your resume in PDF or Word format and let the system
                      extract key details automatically.
                    </p>
                  </div>

                  <div className="upload-form">
                    <input
                      id="resume-upload"
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={handleFileChange}
                      className="file-input"
                    />
                    <label htmlFor="resume-upload" className="file-picker">
                      {selectedFile ? selectedFile.name : "Choose resume file"}
                    </label>

                    <div className="upload-actions">
                      <button
                        type="button"
                        onClick={handleUpload}
                        className="upload-button"
                        disabled={isUploading}
                      >
                        {isUploading ? "Uploading..." : "Upload Resume"}
                      </button>
                      <p className="file-hint">Supported: .pdf, .doc, .docx</p>
                    </div>
                  </div>

                  <div className="panel-note">
                    <h2>Professional dashboard design</h2>
                    <p>
                      A clear sidebar, polished navbar, and full-screen layout keep
                      the interface polished and human-centered.
                    </p>
                  </div>
                </section>
              )}

              {activeSection === "job" && (
                <section className="panel-card" ref={panelRef}>
                  <div className="panel-header">
                    <div>
                      <span className="panel-label">Job Description</span>
                      <h1>Position Details</h1>
                    </div>
                  </div>

                  <p className="upload-description">
                    Click Add Job to open a full job detail modal and save the
                    position data in one place.
                  </p>

                  <div className="job-actions-bar">
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => setShowJobModal(true)}
                    >
                      Add Job
                    </button>
                  </div>

                  {loadingJobs ? (
                    <p className="empty-note">Loading job descriptions…</p>
                  ) : savedJobDescriptions.length > 0 ? (
                    <div className="saved-jobs-section">
                      <div className="saved-jobs-header">
                        <h3>Saved Job Descriptions</h3>
                        <span className="saved-jobs-count">{savedJobDescriptions.length} saved</span>
                      </div>

                      <ul className="saved-job-list">
                        {savedJobDescriptions.map((job, index) => (
                          <li key={index} className="saved-job-item">
                            <details>
                              <summary>
                                <div className="saved-job-top">
                                  <h4>{job.jobTitle}</h4>
                                  <span className="saved-job-meta">
                                    {job.department || "No department"}
                                  </span>
                                </div>
                              </summary>

                              <div className="saved-job-content">
                                <p>
                                  <strong>Location:</strong> {job.location || "—"}
                                </p>
                                <p>
                                  <strong>Skills:</strong> {job.skills || "—"}
                                </p>
                                <p className="saved-job-desc">{job.jobDescription}</p>
                              </div>
                            </details>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="empty-note">
                      No job descriptions added yet. Use Add Job to enter the full
                      position details.
                    </p>
                  )}

                

                  {showJobModal && (
                    <div className="modal-overlay">
                      <div className="modal">
                        <div className="modal-header">
                          <div>
                            <h2>Add Job Description</h2>
                            <p>Enter all job details in one popup.</p>
                          </div>
                          <button
                            type="button"
                            className="close-button"
                            onClick={() => {
                              setShowJobModal(false);
                              setJobTitle("");
                              setDepartment("");
                              setLocation("");
                              setSkills("");
                              setJobDescription("");
                            }}
                          >
                            ×
                          </button>
                        </div>

                        <form className="job-form modal-form" onSubmit={handleJobDescriptionSubmit}>
                          <div className="job-form-grid">
                            <label>
                              Job Title
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
                            <label>
                              Required Skills
                              <input
                                type="text"
                                value={skills}
                                onChange={(e) => setSkills(e.target.value)}
                                placeholder="Leadership, SQL, UX"
                              />
                            </label>
                          </div>

                          <label>
                            Job Description
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
                              onClick={() => {
                                setShowJobModal(false);
                                setJobTitle("");
                                setDepartment("");
                                setLocation("");
                                setSkills("");
                                setJobDescription("");
                              }}
                            >
                              Cancel
                            </button>
                            <button type="submit" className="primary-button">
                              Save Job Description
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}
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
