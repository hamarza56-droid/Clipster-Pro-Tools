import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";

export default function AuthPage({ onAuthenticated }) {
  const [mode, setMode] = useState("login"); // 'login' | 'signup'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result =
        mode === "login"
          ? await api.login({ email, password })
          : await api.signup({ email, password, displayName });
      onAuthenticated(result.user);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <div style={styles.logo}>
          <span style={styles.logoDot} />
          <span style={styles.logoText}>Pipeline</span>
        </div>

        <h1 style={styles.title}>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
        <p style={styles.subtitle}>
          {mode === "login"
            ? "Log in to access your team's campaigns."
            : "Campaigns are shared with your team; your clips stay private to you."}
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
          {mode === "signup" && (
            <label style={styles.label}>
              Display name
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
              />
            </label>
          )}
          <label style={styles.label}>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>
          <label style={styles.label}>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "signup" ? "At least 8 characters" : "••••••••"}
              required
              minLength={mode === "signup" ? 8 : undefined}
            />
          </label>

          {error && <div style={styles.errorBanner}>{error}</div>}

          <button type="submit" style={styles.submitBtn} disabled={submitting}>
            {submitting ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
          </button>
        </form>

        <p style={styles.switchText}>
          {mode === "login" ? (
            <>
              Don't have an account?{" "}
              <button style={styles.switchBtn} onClick={() => setMode("signup")}>
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button style={styles.switchBtn} onClick={() => setMode("login")}>
                Log in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    position: "relative",
    zIndex: 1,
  },
  card: {
    width: "100%",
    maxWidth: "380px",
    background: "var(--panel)",
    border: "1px solid var(--border)",
    borderRadius: "16px",
    padding: "32px",
    backdropFilter: "blur(var(--glass-blur))",
    WebkitBackdropFilter: "blur(var(--glass-blur))",
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "28px",
  },
  logoDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, var(--violet), var(--pink))",
    boxShadow: "0 0 14px rgba(139, 92, 246, 0.7)",
  },
  logoText: {
    fontFamily: "var(--font-display)",
    fontWeight: 700,
    fontSize: "16px",
  },
  title: {
    fontFamily: "var(--font-display)",
    fontSize: "22px",
    fontWeight: 700,
    margin: "0 0 8px",
  },
  subtitle: {
    color: "var(--text-dim)",
    fontSize: "13.5px",
    lineHeight: 1.5,
    margin: "0 0 24px",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    fontSize: "13px",
    color: "var(--text-dim)",
  },
  errorBanner: {
    background: "var(--danger-dim)",
    color: "var(--danger)",
    padding: "10px 14px",
    borderRadius: "8px",
    fontSize: "13px",
    border: "1px solid rgba(255, 107, 107, 0.25)",
  },
  submitBtn: {
    background: "linear-gradient(120deg, var(--violet), var(--pink))",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    padding: "12px 16px",
    fontWeight: 600,
    fontSize: "14px",
    cursor: "pointer",
    marginTop: "6px",
    boxShadow: "0 6px 20px -6px rgba(139, 92, 246, 0.5)",
  },
  switchText: {
    fontSize: "13px",
    color: "var(--text-dim)",
    textAlign: "center",
    marginTop: "22px",
  },
  switchBtn: {
    background: "none",
    border: "none",
    color: "var(--violet)",
    fontWeight: 600,
    fontSize: "13px",
    cursor: "pointer",
    padding: 0,
  },
};
