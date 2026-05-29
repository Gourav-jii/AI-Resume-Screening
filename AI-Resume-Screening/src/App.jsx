import { useState, useRef } from "react";
import "./AppStyles.css";

function App() {
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
      {toast && (
        <div className={`toast ${toast.type === "error" ? "toast-error" : "toast-success"}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

export default App;