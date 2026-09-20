import { ScanSearch, X } from "lucide-react";

const CORE_FIELDS = [
  ["name", "Name"],
  ["category", "Category"],
  ["summary", "Summary"],
  ["description", "Description"],
  ["author", "Author"],
  ["tags", "Tags"],
  ["emails", "Emails"],
  ["phones", "Phones"],
  ["dates", "Dates"],
];

function isEmpty(value) {
  return value == null || value === "" || (Array.isArray(value) && value.length === 0);
}

function display(value) {
  if (isEmpty(value)) return "—";
  return Array.isArray(value) ? value.join(", ") : String(value);
}

function Field({ label, value }) {
  const empty = isEmpty(value);
  return (
    <div className={`extract-field ${empty ? "empty" : "filled"}`}>
      <span>{label}</span>
      <strong dir="auto">{display(value)}</strong>
    </div>
  );
}

export default function ExtractPanel({ data, onClose, onScrap, loading, error, mysql }) {
  const filled = CORE_FIELDS.filter(([key]) => !isEmpty(data?.[key])).length;
  const extraCount = data?.extra ? Object.keys(data.extra).length : 0;
  const coverage = Math.round((filled / CORE_FIELDS.length) * 100);

  return (
    <aside className={`extract-panel word-taskpane ${loading ? "is-loading" : ""} ${data ? "has-data" : ""}`}>
      <header>
        <div className="taskpane-heading">
          <h2>Scraped information</h2>
          {data && !loading && (
            <span className="pane-count">
              {filled} of {CORE_FIELDS.length} fields
            </span>
          )}
        </div>
        <button className="icon-btn" onClick={onClose} title="Close">
          <X size={16} />
        </button>
      </header>
      <div className={`scrap-progress ${loading ? "active" : ""}`} aria-hidden="true" />
      <p className="taskpane-sub">Name, category, summary, description, author, tags</p>
      {data && (
        <div className="coverage" title={`${coverage}% of core fields found`}>
          <span style={{ width: `${coverage}%` }} />
        </div>
      )}
      <div className="taskpane-actions">
        <button type="button" className="btn primary scrap-btn" onClick={onScrap} disabled={loading}>
          <ScanSearch size={16} className={loading ? "spin" : ""} />
          {loading ? "Scrapping…" : "Scrap document"}
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

      {loading && !data && (
        <div className="extract-body">
          <div className="extract-skel" aria-hidden="true">
            {CORE_FIELDS.map(([key]) => (
              <div key={key} className="skel-card">
                <i />
                <b />
              </div>
            ))}
          </div>
        </div>
      )}

      {data && (
        <div className="extract-body">
          <div className="extract-grid">
            {CORE_FIELDS.map(([key, label]) => (
              <Field key={key} label={label} value={data?.[key]} />
            ))}
          </div>

          {extraCount > 0 && (
            <section>
              <h3>Other fields</h3>
              <dl className="kv">
                {Object.entries(data.extra).map(([k, v]) => (
                  <div key={k}>
                    <dt dir="auto">{k}</dt>
                    <dd dir="auto">{String(v)}</dd>
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
                  <li key={i} style={{ paddingLeft: (h.level - 1) * 12 }} dir="auto">
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
                            <td key={c} dir="auto">
                              {cell}
                            </td>
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
