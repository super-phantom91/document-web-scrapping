function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function FileBackstage({
  section,
  onSection,
  documents = [],
  current,
  busy,
  error,
  onBack,
  onNew,
  onOpenComputer,
  onOpenDocument,
  onPrint,
  onShare,
  onClose,
}) {
  return (
    <div className="backstage">
      <nav className="backstage-nav" aria-label="File">
        <button type="button" className="backstage-back" onClick={onBack}>
          ← Back
        </button>
        {[
          ["info", "Info"],
          ["new", "New"],
          ["open", "Open"],
          ["print", "Print"],
          ["share", "Share"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={section === id ? "active" : ""}
            onClick={() => onSection(id)}
          >
            {label}
          </button>
        ))}
        <button type="button" onClick={onClose}>
          Close
        </button>
      </nav>

      <div className="backstage-main">
        {error && <div className="form-error">{error}</div>}
        {busy && <p className="muted">Opening Word document…</p>}

        {section === "info" && (
          <div className="backstage-section">
            <h1>Info</h1>
            <p className="backstage-filename">{current?.title || "Document"}.docx</p>
            <dl className="backstage-meta">
              <div>
                <dt>Author</dt>
                <dd>{current?.ownerName || "—"}</dd>
              </div>
              <div>
                <dt>Last modified</dt>
                <dd>{current?.updatedAt ? formatDate(current.updatedAt) : "—"}</dd>
              </div>
              <div>
                <dt>Created</dt>
                <dd>{current?.createdAt ? formatDate(current.createdAt) : "—"}</dd>
              </div>
            </dl>
            <p className="muted">Changes are saved automatically while you type.</p>
          </div>
        )}

        {section === "new" && (
          <div className="backstage-section">
            <h1>New</h1>
            <button type="button" className="template-card" onClick={onNew} disabled={busy}>
              <span className="template-page" />
              <strong>Blank document</strong>
              <em>Letter · 8.5" × 11"</em>
            </button>
          </div>
        )}

        {section === "open" && (
          <div className="backstage-section">
            <h1>Open</h1>
            <button type="button" className="btn primary" onClick={onOpenComputer} disabled={busy}>
              Browse
            </button>
            <p className="muted">Open a Microsoft Word document (.docx) in this browser.</p>
            <h2>Recent</h2>
            {documents.length === 0 ? (
              <p className="muted">No recent documents.</p>
            ) : (
              <ul className="recent-list">
                {documents.map((doc) => (
                  <li key={doc.id}>
                    <button type="button" onClick={() => onOpenDocument(doc.id)}>
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
            )}
          </div>
        )}

        {section === "print" && (
          <div className="backstage-section">
            <h1>Print</h1>
            <p>Print this document from the browser, including headers and page layout.</p>
            <button type="button" className="btn primary" onClick={onPrint}>
              Print
            </button>
          </div>
        )}

        {section === "share" && (
          <div className="backstage-section">
            <h1>Share</h1>
            <p>Anyone signed in with this link can edit the document at the same time.</p>
            <button type="button" className="btn primary" onClick={onShare}>
              Copy link
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
