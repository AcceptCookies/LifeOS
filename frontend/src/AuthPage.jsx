import { useState, useEffect } from "react";
import { api } from "./api";

const MONO = "'SF Mono', 'Fira Code', 'Consolas', monospace";
const SAVED_EMAIL_KEY = "lifeos_saved_email";
const SAVED_PASSWORD_KEY = "lifeos_saved_password";

export default function AuthPage({ onAuth }) {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [rememberCreds, setRememberCreds] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedEmail = localStorage.getItem(SAVED_EMAIL_KEY);
    const savedPassword = localStorage.getItem(SAVED_PASSWORD_KEY);
    if (savedEmail && savedPassword) {
      setEmail(savedEmail);
      setPassword(savedPassword);
      setRememberCreds(true);
      setLoading(true);
      api.login(savedEmail, savedPassword, true)
        .then(() => onAuth())
        .catch(() => setLoading(false));
    } else if (savedEmail) {
      setEmail(savedEmail);
      setRememberCreds(true);
    }
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        if (rememberCreds) {
          localStorage.setItem(SAVED_EMAIL_KEY, email);
          localStorage.setItem(SAVED_PASSWORD_KEY, password);
        } else {
          localStorage.removeItem(SAVED_EMAIL_KEY);
          localStorage.removeItem(SAVED_PASSWORD_KEY);
        }
        await api.login(email, password, rememberMe);
      } else {
        await api.register(email, password);
      }
      onAuth();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={S.page}>
      <div style={S.box}>
        <div style={S.title}>LifeOS</div>
        <div style={S.subtitle}>
          {mode === "login" ? "Prihlásiť sa" : "Registrovať sa"}
        </div>

        <form onSubmit={submit} style={S.form}>
          <input
            style={S.input}
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
          <input
            style={S.input}
            type="password"
            placeholder="Heslo"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={mode === "register" ? 8 : 1}
          />

          {mode === "login" && (
            <div style={S.checkboxGroup}>
              <label style={S.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={S.checkbox}
                />
                Ostať prihlásený
              </label>
              <label style={S.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={rememberCreds}
                  onChange={(e) => setRememberCreds(e.target.checked)}
                  style={S.checkbox}
                />
                Pamätať údaje
              </label>
            </div>
          )}

          {error && <div style={S.error}>{error}</div>}

          <button style={{ ...S.btn, opacity: loading ? 0.6 : 1 }} disabled={loading}>
            {loading ? "..." : mode === "login" ? "Prihlásiť" : "Registrovať"}
          </button>
        </form>

        <button style={S.toggle} onClick={() => { setMode(m => m === "login" ? "register" : "login"); setError(""); }}>
          {mode === "login" ? "Nemáš účet? Registruj sa" : "Už máš účet? Prihlás sa"}
        </button>
      </div>
    </div>
  );
}

const S = {
  page: {
    background: "#0f0f0f",
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Inter', system-ui, sans-serif",
    color: "#e8e8e8",
  },
  box: {
    width: "100%",
    maxWidth: 360,
    padding: "48px 32px",
    border: "1px solid #1e1e1e",
    borderRadius: 12,
    boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
  },
  title: {
    fontSize: 26,
    fontWeight: 700,
    letterSpacing: "0.22em",
    fontFamily: MONO,
    color: "#f0f0f0",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: "#444",
    marginBottom: 32,
    letterSpacing: "0.02em",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  input: {
    background: "#0c0c0c",
    border: "1px solid #222",
    borderRadius: 6,
    padding: "13px 14px",
    color: "#e8e8e8",
    fontSize: 15,
    outline: "none",
    fontFamily: "'Inter', system-ui, sans-serif",
  },
  error: {
    color: "#ef4444",
    fontSize: 13,
    padding: "8px 0 0",
  },
  btn: {
    background: "transparent",
    border: "1px solid #22c55e33",
    borderRadius: 6,
    color: "#22c55e",
    fontSize: 14,
    fontWeight: 600,
    letterSpacing: "0.06em",
    padding: "14px 0",
    cursor: "pointer",
    marginTop: 6,
    transition: "border-color 0.2s, opacity 0.15s",
  },
  toggle: {
    background: "none",
    border: "none",
    color: "#333",
    fontSize: 12,
    cursor: "pointer",
    marginTop: 24,
    padding: 0,
    textDecoration: "none",
    letterSpacing: "0.02em",
    display: "block",
  },
  checkboxGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    paddingTop: 4,
  },
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 12,
    color: "#555",
    cursor: "pointer",
    userSelect: "none",
    letterSpacing: "0.01em",
  },
  checkbox: {
    accentColor: "#22c55e",
    width: 14,
    height: 14,
    cursor: "pointer",
  },
};
