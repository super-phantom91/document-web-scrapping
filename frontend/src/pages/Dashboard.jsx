import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FilePlus, FileUp, LogOut, Trash2 } from "lucide-react";
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
        body: JSON.stringify({ title: "Untitled document" }),
      });
      navigate(`/d/${data.document.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function importDocx(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
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
    <div className="dash">
      <header className="dash-top">
        <div className="brand-inline">
          <span className="brand-mark sm">DS</span>
          <strong>DocuSync</strong>
        </div>
        <div className="dash-user">
          <span className="avatar" style={{ background: user.color }}>
            {user.username.slice(0, 1).toUpperCase()}
          </span>
          <span>{user.username}</span>
          <button className="btn ghost" onClick={logout}>
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </header>

      <section className="dash-hero">
        <div>
          <h1>Documents</h1>
          <p>Create a blank page, import a Word file, and edit it with your team.</p>
        </div>
        <div className="dash-actions">
          <button className="btn primary" onClick={createDoc} disabled={busy}>
            <FilePlus size={16} /> Blank document
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()} disabled={busy}>
            <FileUp size={16} /> Import DOCX
          </button>
          <input ref={fileRef} type="file" accept=".docx" hidden onChange={importDocx} />
        </div>
      </section>

      {error && <div className="form-error">{error}</div>}

      {documents.length === 0 ? (
        <div className="empty">No documents yet. Create one or import a .docx file.</div>
      ) : (
        <div className="doc-grid">
          {documents.map((doc) => (
            <article key={doc.id} className="doc-card" onClick={() => navigate(`/d/${doc.id}`)}>
              <div className="doc-preview">{doc.title.slice(0, 1).toUpperCase()}</div>
              <div className="doc-meta">
                <h3>{doc.title}</h3>
                <p>
                  {doc.ownerName} · {formatDate(doc.updatedAt)}
                </p>
              </div>
              {doc.ownerId === user.id && (
                <button
                  className="icon-btn danger"
                  title="Delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(doc.id);
                  }}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
