import { ScanSearch, X } from "lucide-react";

function Field({ label, value }) {
  const empty = value == null || value === "" || (Array.isArray(value) && value.length === 0);
  return (
    <div className="extract-field">
      <span>{label}</span>
      <strong>{empty ? "—" : Array.isArray(value) ? value.join(", ") : value}</strong>
    </div>
  );
}

export default function ExtractPanel({ data, onClose, onScrap, loading, error, mysql }) {
  return (
    <aside className="extract-panel word-taskpane">
      <header>
        <h2>Scraped information</h2>
        <button className="icon-btn" onClick={onClose} title="Close">
          <X size={16} />
        </button>
      </header>
      <p className="taskpane-sub">Name, category, summary, description, author, tags</p>
      <div className="taskpane-actions">
        <button type="button" className="btn primary" onClick={onScrap} disabled={loading}>
          <ScanSearch size={16} /> {loading ? "Scrapping…" : "Scrap document"}
        </button>
      </div>

      {error && <div className="form-error">{error}</div>}
      {(data?.stored_at || mysql) && (
        <p className="saved-badge">
          Saved in MySQL
          {mysql?.database && mysql?.table ? ` · ${mysql.database}.${mysql.table}` : ""}
          {data?.stored_at ? ` · ${new Date(data.stored_at).toLocaleString()}` : ""}
        </p>
      )}

      {!data && !loading && !error && (
        <p className="muted">
          Press Scrap document to read this page (and the original Word file, if you opened one) and fill the fields
          below.
        </p>
      )}

      {(data || loading) && (
        <div className="extract-body">
          <div className="extract-grid">
            <Field label="Name" value={data?.name} />
            <Field label="Category" value={data?.category} />
            <Field label="Summary" value={data?.summary} />
            <Field label="Description" value={data?.description} />
            <Field label="Author" value={data?.author} />
            <Field label="Tags" value={data?.tags} />
            <Field label="Emails" value={data?.emails} />
            <Field label="Phones" value={data?.phones} />
            <Field label="Dates" value={data?.dates} />
          </div>

          {data?.extra && Object.keys(data.extra).length > 0 && (
            <section>
              <h3>Other fields</h3>
              <dl className="kv">
                {Object.entries(data.extra).map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{String(v)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {data?.headings?.length > 0 && (
            <section>
              <h3>Headings</h3>
              <ul className="outline">
                {data.headings.map((h, i) => (
                  <li key={i} style={{ paddingLeft: (h.level - 1) * 12 }}>
                    {h.text}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data?.images?.length > 0 && (
            <section>
              <h3>Images ({data.images.length})</h3>
              <div className="image-grid">
                {data.images.map((img, i) => {
                  const src = img.data ? `data:${img.content_type};base64,${img.data}` : img.src;
                  if (!src) return null;
                  return (
                    <figure key={i}>
                      <img src={src} alt={img.name || `Image ${i + 1}`} />
                      <figcaption>{img.name}</figcaption>
                    </figure>
                  );
                })}
              </div>
            </section>
          )}

          {data?.tables?.length > 0 &&
            data.tables.map((table, t) => (
              <section key={t}>
                <h3>Table {t + 1}</h3>
                <div className="table-scroll">
                  <table>
                    <tbody>
                      {table.map((row, r) => (
                        <tr key={r}>
                          {row.map((cell, c) => (
                            <td key={c}>{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
        </div>
      )}
    </aside>
  );
}
