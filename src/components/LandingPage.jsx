import { useRef } from "react";
import "./LandingPage.css";

function LandingPage({ onLoginClick, onSignupClick, darkMode, setDarkMode }) {
  const featuresRef = useRef(null);
  const workflowRef = useRef(null);

  const scrollToSection = (ref) => {
    if (ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="landing-container">
      {/* ── Navbar ── */}
      <header className="landing-navbar">
        <div className="landing-brand" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <div className="landing-brand-mark">R</div>
          <div className="landing-brand-name">
            <strong>AI Resume</strong>
            <span>Screening & Shortlist</span>
          </div>
        </div>

        <nav className="landing-nav">
          <ul className="landing-nav-links">
            <li>
              <a onClick={() => scrollToSection(featuresRef)}>Features</a>
            </li>
            <li>
              <a onClick={() => scrollToSection(workflowRef)}>How it Works</a>
            </li>
            <li>
              <a onClick={onLoginClick}>Dashboard</a>
            </li>
          </ul>
        </nav>

        <div className="landing-actions">
          {/* Theme Toggle Button */}
          <button
            type="button"
            className="landing-theme-toggle"
            onClick={() => setDarkMode(!darkMode)}
            title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            aria-label="Toggle theme"
          >
            {darkMode ? (
              // Sun Icon
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
              </svg>
            ) : (
              // Moon Icon
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
              </svg>
            )}
          </button>

          <button type="button" className="landing-btn-login" onClick={onLoginClick}>
            Log In
          </button>
          <button type="button" className="landing-btn-signup" onClick={onSignupClick}>
            Sign Up
          </button>
        </div>
      </header>

      {/* ── Hero Section ── */}
      <section className="landing-hero">
        <div className="landing-badge">
          <span>🚀</span> Next-Gen AI Screening Platform
        </div>
        <h1>
          AI Resume Screening & <br />
          <span className="gradient-text">Candidates Shortlisting</span>
        </h1>
        <p className="landing-hero-desc">
          Automate and speed up your hiring pipeline. Upload hundreds of resumes, extract core skills, evaluate ATS compatibility scores, and shortlist the top candidates instantly with advanced AI.
        </p>

        <div className="landing-hero-ctas">
          <button type="button" className="cta-primary" onClick={onSignupClick}>
            Get Started Free
          </button>
          <button type="button" className="cta-secondary" onClick={() => scrollToSection(featuresRef)}>
            Explore Features
          </button>
        </div>

        {/* Stats Grid */}
        <div className="landing-stats-grid">
          <div className="landing-stat-card">
            <span className="stat-number">90%</span>
            <span className="stat-label">Time Saved</span>
          </div>
          <div className="landing-stat-card">
            <span className="stat-number">98%</span>
            <span className="stat-label">ATS Accuracy</span>
          </div>
          <div className="landing-stat-card">
            <span className="stat-number">10k+</span>
            <span className="stat-label">Resumes Processed</span>
          </div>
        </div>
      </section>

      {/* ── Features Section ── */}
      <section ref={featuresRef} className="landing-features-section">
        <div className="section-header">
          <h2>Key Platform Features</h2>
          <p>Everything you need to bypass standard manual screening and source high-quality matches instantly.</p>
        </div>

        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon-wrapper">🤖</div>
            <h3>AI-Powered Screening</h3>
            <p>Leverage intelligence models to read, parse, and analyze candidate histories and experiences automatically.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper">📊</div>
            <h3>Smart Score Ranking</h3>
            <p>Compute dynamic ATS scores based on job descriptions and rank candidates to highlight matching profiles.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper">⚡</div>
            <h3>Bulk Resume Processing</h3>
            <p>Save massive hours of workflow. Drag, drop, and upload hundreds of PDF or Word resumes simultaneously.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper">🎯</div>
            <h3>Smart Shortlisting</h3>
            <p>Auto-categorize candidates and filter profiles above your customized threshold score with extreme precision.</p>
          </div>
        </div>
      </section>

      {/* ── Workflow Section ── */}
      <section ref={workflowRef} className="landing-workflow-section">
        <div className="section-header">
          <h2>How it Works</h2>
          <p>Screen and shortlist candidate resumes in three simple, automated steps.</p>
        </div>

        <div className="workflow-steps">
          <div className="workflow-step">
            <div className="step-num">1</div>
            <h3>Create Job Details</h3>
            <p>Define the title, department, skills, and target scoring parameters for your open position.</p>
          </div>

          <div className="workflow-step">
            <div className="step-num">2</div>
            <h3>Upload Resumes</h3>
            <p>Select or drag multiple candidate resumes to start the batch upload process safely.</p>
          </div>

          <div className="workflow-step">
            <div className="step-num">3</div>
            <h3>Shortlist Matches</h3>
            <p>View ranked profiles, compare AI breakdown analysis, and shortlist the absolute best hires.</p>
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="landing-cta-bottom">
        <div className="cta-box">
          <h2>Supercharge Your HR Operations Today</h2>
          <p>Empower your hiring teams with cutting edge AI capabilities and close open slots twice as fast.</p>
          <button type="button" className="cta-primary" onClick={onSignupClick}>
            Create Free Account
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="landing-footer">
        <div className="footer-brand">
          <span>🤖</span> AI Resume Screening & Candidates Shortlisting Platform
        </div>
        <div className="footer-links">
          <a onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>Top</a>
          <a onClick={() => scrollToSection(featuresRef)}>Features</a>
          <a onClick={() => scrollToSection(workflowRef)}>Workflow</a>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
