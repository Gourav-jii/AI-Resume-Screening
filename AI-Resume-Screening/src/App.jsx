import { useState, useRef } from "react";
import "./AppStyles.css";
import Auth from "./components/Auth";

function App() {
  const [user, setUser] = useState(() => {
    const session = localStorage.getItem("auth_currentUser");
    return session ? JSON.parse(session) : null;
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [toast, setToast] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const toastTimer = useRef(null);

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

  const handleLoginSuccess = (loggedInUser) => {
    setUser(loggedInUser);
    showToast(`Welcome back, ${loggedInUser.name}!`, "success");
  };

  const handleLogout = () => {
    localStorage.removeItem("auth_currentUser");
    setUser(null);
    setSelectedFile(null);
    showToast("Logged out successfully.", "success");
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

  return (
    <div className="app-screen">
      {!user ? (
        <Auth onLoginSuccess={handleLoginSuccess} />
      ) : (
        <div className="upload-container">
          <header className="app-header">
            <div className="user-profile">
              <div className="user-avatar">
                {user.name ? user.name.charAt(0).toUpperCase() : "U"}
              </div>
              <div className="user-details">
                <span className="user-name">{user.name}</span>
                <span className="user-email">{user.email}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="logout-button"
              title="Sign Out"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="logout-icon"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span>Sign Out</span>
            </button>
          </header>

          <div className="upload-card">
            <div className="upload-header">
              <span className="upload-badge">AI Resume Screening</span>
              <h1>Resume Upload</h1>
              <p className="upload-description">
                Upload your resume in PDF or Word format and let the system extract
                key details automatically.
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
          </div>
        </div>
      )}

      {toast && (
        <div className={`toast ${toast.type === "error" ? "toast-error" : "toast-success"}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

export default App;