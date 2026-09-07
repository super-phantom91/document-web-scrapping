import { X } from "lucide-react";

function Field({ label, value }) {
  if (!value) return null;
  return (
    <div className="extract-field">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function ExtractPanel({ data, onClose, loading, error }) {
  return (
    <aside className="extract-panel">
      <header>
        <h2>Extracted information</h2>
        <button className="icon-btn" onClick={onClose} title="Close">
          <X size={16} />
        </button>
      </header>

      {loading && <p className="muted">Reading the document…</p>}
      {error && <div className="form-error">{error}</div>}
      {data?.stored_at && (
        <p className="saved-badge">Saved in MySQL · {new Date(data.stored_at).toLocaleString()}</p>
      )}

      {data && (
        <div className="extract-body">
          <div className="extract-grid">
            <Field label="Name" value={data.name} />
            <Field label="Category" value={data.category} />
            <Field label="Summary" value={data.summary} />
            <Field label="Description" value={data.description} />
            <Field label="Author" value={data.author} />
            <Field label="Tags" value={data.tags} />
          </div>

          {data.extra && Object.keys(data.extra).length > 0 && (
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

          {data.headings?.length > 0 && (
            <section>
              <h3>Outline</h3>
              <ul className="outline">
                {data.headings.map((h, i) => (
                  <li key={i} style={{ paddingLeft: (h.level - 1) * 12 }}>
                    {h.text}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data.images?.length > 0 && (
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

          {data.tables?.length > 0 &&
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
