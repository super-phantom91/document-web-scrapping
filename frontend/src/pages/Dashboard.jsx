import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { api } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [documents, setDocuments] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const [section, setSection] = useState("home");

  async function refresh() {
    const data = await api("/documents");
    setDocuments(data.documents);
  }

  useEffect(() => {
    refresh().catch((err) => setError(err.message));
  }, []);

  async function createDoc() {
    setBusy(true);
    try {
      const data = await api("/documents", {
        method: "POST",
        body: JSON.stringify({ title: "Document" }),
      });
      navigate(`/d/${data.document.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function importDocx(file) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const data = await api("/documents/import", { method: "POST", body: form });
      navigate(`/d/${data.document.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function onFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    await importDocx(file);
  }

  async function remove(id) {
    if (!confirm("Delete this document?")) return;
    try {
      await api(`/documents/${id}`, { method: "DELETE" });
      setDocuments((docs) => docs.filter((d) => d.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div
      className="word-start"
      onDragOver={(e) => {
        e.preventDefault();
        setDropActive(true);
      }}
      onDragLeave={() => setDropActive(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDropActive(false);
        importDocx(e.dataTransfer.files?.[0]);
      }}
    >
      <header className="word-titlebar start-titlebar">
        <span className="word-mark">W</span>
        <strong className="word-product">Word</strong>
        <div className="dash-user">
          <span className="avatar" style={{ background: user.color }}>
            {user.username.slice(0, 1).toUpperCase()}
          </span>
          <span>{user.username}</span>
          <button className="btn ghost light" onClick={logout}>
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </header>

      <div className="start-body">
        <nav className="start-nav">
          <button type="button" className={section === "home" ? "active" : ""} onClick={() => setSection("home")}>
            Home
          </button>
          <button type="button" className={section === "new" ? "active" : ""} onClick={() => setSection("new")}>
            New
          </button>
          <button type="button" className={section === "open" ? "active" : ""} onClick={() => setSection("open")}>
            Open
          </button>
        </nav>

        <main className="start-main">
          {error && <div className="form-error">{error}</div>}
          {busy && <p className="muted">Opening Word document…</p>}

          {section === "home" && (
            <>
              <h1>Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}</h1>
              <div className="template-row">
                <button type="button" className="template-card" onClick={createDoc} disabled={busy}>
                  <span className="template-page" />
                  <strong>Blank document</strong>
                </button>
                <button type="button" className="template-card" onClick={() => fileRef.current?.click()} disabled={busy}>
                  <span className="template-page open" />
                  <strong>Open</strong>
                </button>
              </div>
              <h2>Recent</h2>
              {documents.length === 0 ? (
                <p className="muted">Open a Word document from this computer, or start a blank page.</p>
              ) : (
                <ul className="recent-list">
                  {documents.map((doc) => (
                    <li key={doc.id}>
                      <button type="button" onClick={() => navigate(`/d/${doc.id}`)}>
                        <span className="doc-preview">W</span>
                        <span>
                          <strong>{doc.title}.docx</strong>
                          <em>
                            {doc.ownerName} · {formatDate(doc.updatedAt)}
                          </em>
                        </span>
                      </button>
                      {doc.ownerId === user.id && (
                        <button
                          type="button"
                          className="icon-btn danger"
                          title="Delete"
                          onClick={() => remove(doc.id)}
                        >
                          ×
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {section === "new" && (
            <>
              <h1>New</h1>
              <div className="template-row">
                <button type="button" className="template-card" onClick={createDoc} disabled={busy}>
                  <span className="template-page" />
                  <strong>Blank document</strong>
                  <em>Letter · 8.5" × 11"</em>
                </button>
              </div>
            </>
          )}

          {section === "open" && (
            <>
              <h1>Open</h1>
              <button type="button" className="btn primary" onClick={() => fileRef.current?.click()} disabled={busy}>
                Browse
              </button>
              <p className="muted">Open a Microsoft Word .docx file in this browser.</p>
              <h2>Recent</h2>
              <ul className="recent-list">
                {documents.map((doc) => (
                  <li key={doc.id}>
                    <button type="button" onClick={() => navigate(`/d/${doc.id}`)}>
                      <span className="doc-preview">W</span>
                      <span>
                        <strong>{doc.title}.docx</strong>
                        <em>
                          {doc.ownerName} · {formatDate(doc.updatedAt)}
                        </em>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </main>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        hidden
        onChange={onFileChange}
      />
      {dropActive && <div className="drop-overlay">Drop a Word document (.docx) to open it</div>}
    </div>
  );
}
