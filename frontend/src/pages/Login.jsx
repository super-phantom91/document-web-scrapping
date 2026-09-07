import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(username, password);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <aside className="auth-brand">
        <div className="brand-mark">DS</div>
        <h1>Write together. Extract anything.</h1>
        <p>
          DocuSync is a multi-person Word-style editor. Co-author in real time, then pull names,
          categories, images, and tables from a DOCX with one click.
        </p>
      </aside>
      <main className="auth-card">
        <h2>Sign in</h2>
        <p className="muted">Use the same document link with your team — everyone sees live cursors.</p>
        <form onSubmit={onSubmit} className="auth-form">
          <label>
            Username
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </label>
          {error && <div className="form-error">{error}</div>}
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="muted">
          New here? <Link to="/register">Create an account</Link>
        </p>
      </main>
    </div>
  );
}
