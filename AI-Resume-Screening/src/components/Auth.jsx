import { useState } from "react";
import "./Auth.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

const FEATURES = [
  { icon: "🤖", title: "AI-Powered Screening", desc: "Instant resume analysis with GPT" },
  { icon: "📊", title: "Smart Score Ranking", desc: "ATS scoring & candidate ranking" },
  { icon: "⚡", title: "Bulk Processing", desc: "Upload & screen 100s of resumes" },
  { icon: "🎯", title: "Smart Shortlisting", desc: "Auto-shortlist best-fit candidates" },
];

function Auth({ onLoginSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleToggleMode = () => {
    setIsLogin(!isLogin);
    setError("");
    setSuccess("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setName("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (isLogin) {
      if (!email || !password) { setError("Please fill in all fields."); return; }
    } else {
      if (!name || !email || !password || !confirmPassword) { setError("Please fill in all fields."); return; }
      if (password !== confirmPassword) { setError("Passwords do not match."); return; }
      if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) { setError("Please enter a valid email address."); return; }

    setIsLoading(true);

    try {
      if (isLogin) {
        const response = await fetch(`${API_URL}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Invalid credentials.");
        localStorage.setItem("auth_currentUser", JSON.stringify(data.user));
        localStorage.setItem("auth_token", data.token);
        setSuccess("Login successful!");
        setTimeout(() => onLoginSuccess(data), 800);
      } else {
        const response = await fetch(`${API_URL}/api/auth/signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Registration failed.");
        setSuccess(data.message || "Account created! Please log in.");
        setIsLoading(false);
        setTimeout(() => {
          setIsLogin(true);
          setPassword("");
          setConfirmPassword("");
          setSuccess("");
        }, 2000);
      }
    } catch (err) {
      setError(err.message || "Connection error. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      {/* ── Left: Form ── */}
      <div className="auth-left">
        <div className="auth-card">
          <div className="auth-header">
            <span className="auth-badge">Secure Access</span>
            <h1>{isLogin ? "Welcome Back" : "Create Account"}</h1>
            <p className="auth-description">
              {isLogin
                ? "Sign in to your account to upload and analyze resumes."
                : "Sign up to start screening resumes with AI-powered analytics."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {error   && <div className="auth-alert auth-error">{error}</div>}
            {success && <div className="auth-alert auth-success">{success}</div>}

            {!isLogin && (
              <div className="form-group">
                <label htmlFor="name-input">Full Name</label>
                <div className="input-wrapper">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                    strokeLinejoin="round" className="input-icon">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                  <input id="name-input" type="text" value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="John Doe" disabled={isLoading} required />
                </div>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="email-input">Email Address</label>
              <div className="input-wrapper">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                  strokeLinejoin="round" className="input-icon">
                  <rect x="2" y="4" width="20" height="16" rx="2"/>
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                </svg>
                <input id="email-input" type="email" value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com" disabled={isLoading} required />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="password-input">Password</label>
              <div className="input-wrapper">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                  strokeLinejoin="round" className="input-icon">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <input id="password-input" type={showPassword ? "text" : "password"}
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" disabled={isLoading} required />
                <button type="button" className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex="-1" aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
                      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
                      <path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>
                      <line x1="2" y1="2" x2="22" y2="22"/>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {!isLogin && (
              <div className="form-group">
                <label htmlFor="confirm-password-input">Confirm Password</label>
                <div className="input-wrapper">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                    strokeLinejoin="round" className="input-icon">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  <input id="confirm-password-input" type={showPassword ? "text" : "password"}
                    value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="••••••••" disabled={isLoading} required />
                </div>
              </div>
            )}

            <button type="submit" className="auth-button" disabled={isLoading}>
              {isLoading
                ? <div className="spinner" />
                : isLogin ? "Sign In" : "Create Account"}
            </button>

            <div className="auth-footer">
              <p>
                {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
                <button type="button" className="toggle-link-btn"
                  onClick={handleToggleMode} disabled={isLoading}>
                  {isLogin ? "Sign Up" : "Log In"}
                </button>
              </p>
            </div>
          </form>
        </div>
      </div>

      {/* ── Right: Branding panel ── */}
      <div className="auth-right">
        <div className="auth-brand">
          <div className="auth-brand-mark">R</div>
          <div className="auth-brand-name">
            <strong>AI Resume</strong>
            <span>Screening Platform</span>
          </div>
        </div>

        <h2 className="auth-features-heading">Smart Hiring,<br />Better Candidates</h2>
        <p className="auth-features-sub">Everything you need to find the right talent, faster.</p>

        <ul className="auth-features-list">
          {FEATURES.map((f, i) => (
            <li key={i} className="auth-feature-item">
              <span className="auth-feature-icon">{f.icon}</span>
              <div className="auth-feature-text">
                <span className="auth-feature-title">{f.title}</span>
                <span className="auth-feature-desc">{f.desc}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default Auth;
