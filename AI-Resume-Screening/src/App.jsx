import { useEffect, useRef, useState } from "react";
import "./AppStyles.css";

const roleLabels = {
  seeker: "Job Seeker",
  provider: "Job Provider",
};

const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";

function App() {
  const [page, setPage] = useState("role");
  const [selectedRole, setSelectedRole] = useState(null);
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "", company: "" });
  const [user, setUser] = useState(null);
  const [toast, setToast] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [resumes, setResumes] = useState([]);
  const [selectedResumeFile, setSelectedResumeFile] = useState(null);
  const toastTimer = useRef(null);

  useEffect(() => {
    return () => {
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }
    };
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

  const resetForm = () => {
    setForm({ name: "", email: "", password: "", company: "" });
  };

  const chooseRole = (role) => {
    setSelectedRole(role);
    setMode("login");
    resetForm();
    setPage("auth");
  };

  const handleModeSwitch = (nextMode) => {
    setMode(nextMode);
    resetForm();
    setToast(null);
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAuthSubmit = async (event) => {
    event.preventDefault();

    if (!form.email.trim() || !form.password.trim() || (mode === "signup" && !form.name.trim())) {
      showToast("Please fill in all required fields.", "error");
      return;
    }

    if (selectedRole === "provider" && mode === "signup" && !form.company.trim()) {
      showToast("Company is required for providers.", "error");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${apiUrl}/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: selectedRole,
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          company: form.company.trim(),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        showToast(data.message || "Unable to complete request.", "error");
        return;
      }

      setUser(data.user);
      setPage("dashboard");
      showToast(mode === "signup" ? "Signup successful!" : "Login successful.");
      resetForm();
    } catch (error) {
      showToast("Server error. Check backend or MongoDB.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchResumes = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/resumes`);
      const data = await res.json();
      if (res.ok) setResumes(data.resumes || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (page === "dashboard" && user?.role === "provider") {
      fetchResumes();
    }
  }, [page, user]);

  const handleResumeChange = (e) => {
    setSelectedResumeFile(e.target.files[0] || null);
  };

  const handleResumeUpload = async () => {
    if (!selectedResumeFile) {
      showToast("Please choose a file to upload.", "error");
      return;
    }

    const formData = new FormData();
    formData.append("resume", selectedResumeFile);
    formData.append("uploaderEmail", user.email);
    formData.append("uploaderName", user.name || user.email);

    try {
      const res = await fetch(`${apiUrl}/api/resume/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.message || "Upload failed.", "error");
        return;
      }
      showToast("Resume uploaded.");
      setSelectedResumeFile(null);
    } catch (e) {
      showToast("Upload failed.", "error");
    }
  };

  const handleLogout = () => {
    setPage("role");
    setSelectedRole(null);
    setMode("login");
    setUser(null);
    resetForm();
    setToast(null);
  };

  const renderRoleSelection = () => (
    <div className="panel-card">
      <div className="panel-head">
        <span className="panel-overline">Account type</span>
        <h1>Choose your role</h1>
        <p>Login or signup as a job seeker or a job provider to continue.</p>
      </div>
      <div className="role-grid">
        {Object.entries(roleLabels).map(([key, label]) => (
          <button key={key} className="role-card" onClick={() => chooseRole(key)}>
            <span className="role-title">{label}</span>
            <p>{key === "seeker" ? "Search jobs, upload your resume, and manage applications." : "Post jobs, review candidates, and grow your hiring pipeline."}</p>
          </button>
        ))}
      </div>
    </div>
  );

  const renderAuthForm = () => (
    <div className="panel-card auth-card">
      <div className="panel-head">
        <span className="panel-overline">{roleLabels[selectedRole]}</span>
        <h1>{mode === "login" ? "Login" : "Create an account"}</h1>
        <p>{mode === "login" ? "Enter your credentials to access your dashboard." : "Create a new account to start using the platform."}</p>
      </div>

      <div className="mode-switch">
        <button className={mode === "login" ? "mode-active" : ""} onClick={() => handleModeSwitch("login")}>Login</button>
        <button className={mode === "signup" ? "mode-active" : ""} onClick={() => handleModeSwitch("signup")}>Signup</button>
      </div>

      <form className="auth-form" onSubmit={handleAuthSubmit}>
        {mode === "signup" && (
          <label className="input-group">
            <span>Name</span>
            <input name="name" value={form.name} onChange={handleFormChange} placeholder="Full name" />
          </label>
        )}

        {selectedRole === "provider" && mode === "signup" && (
          <label className="input-group">
            <span>Company</span>
            <input name="company" value={form.company} onChange={handleFormChange} placeholder="Company name" />
          </label>
        )}

        <label className="input-group">
          <span>Email</span>
          <input name="email" value={form.email} onChange={handleFormChange} type="email" placeholder="you@example.com" />
        </label>

        <label className="input-group">
          <span>Password</span>
          <input name="password" value={form.password} onChange={handleFormChange} type="password" placeholder="Enter password" />
        </label>

        <button type="submit" className="primary-btn" disabled={isLoading}>
          {isLoading ? "Please wait..." : mode === "login" ? "Login to dashboard" : "Create account"}
        </button>
      </form>

      <button className="ghost-btn" onClick={() => setPage("role")}>Change role</button>
    </div>
  );

  const renderDashboard = () => (
    <div className="dashboard-shell">
      <div className="dashboard-header">
        <div>
          <span className="panel-overline">Dashboard</span>
          <h1>Welcome, {user?.name || roleLabels[user.role]}</h1>
          <p>{user.role === "seeker" ? "Manage your job search from one place." : "Manage your job postings and candidate pipeline."}</p>
        </div>
        <button className="secondary-btn" onClick={handleLogout}>Logout</button>
      </div>
      <div className="dashboard-grid">
        {user.role === "seeker" ? (
          <>
            <div className="dashboard-card">
              <h2>Profile & Resume</h2>
              <p>Keep your profile updated and upload your resume.</p>
              <div style={{ marginTop: 12 }}>
                <input type="file" onChange={handleResumeChange} />
                <div style={{ marginTop: 10 }}>
                  <button className="primary-btn" onClick={handleResumeUpload}>Upload Resume</button>
                </div>
              </div>
            </div>

            <div className="dashboard-card">
              <h2>Application Status</h2>
              <p>View the status of your applications.</p>
            </div>
          </>
        ) : (
          <>
            <div className="dashboard-card">
              <h2>Open Postings</h2>
              <p>See your live job posts and activity.</p>
            </div>

            <div className="dashboard-card">
              <h2>Candidate Resumes</h2>
              <p>Download resumes submitted by candidates below.</p>
              <div style={{ marginTop: 12 }}>
                {resumes.length === 0 ? (
                  <p>No resumes uploaded yet.</p>
                ) : (
                  <ul>
                    {resumes.map((r) => (
                      <li key={r._id} style={{ marginBottom: 8 }}>
                        <strong>{r.uploaderName}</strong> — {r.originalname} —{' '}
                        <a href={`${apiUrl}/api/resumes/${r._id}/download`} target="_blank" rel="noreferrer">Download</a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="app-screen">
      <header className="app-topbar">
        <div>
          <p className="brand">AI Resume Screening</p>
          <p className="brand-subtitle">Two account types, one simple hiring experience.</p>
        </div>
      </header>

      <main className="app-content">
        {page === "role" && renderRoleSelection()}
        {page === "auth" && renderAuthForm()}
        {page === "dashboard" && renderDashboard()}
      </main>

      {toast && <div className={`toast ${toast.type === "error" ? "toast-error" : "toast-success"}`}>{toast.message}</div>}
    </div>
  );
}

export default App;
