import { useState } from "react";
import { X } from "lucide-react";
import { api } from "../api.js";

export default function ShareDialog({ document: doc, user, peers = [], onClose, onChange }) {
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const isOwner = doc?.ownerId === user?.id;
  const people = doc?.people || [];
  const live = [...new Map(peers.filter((peer) => peer?.name).map((peer) => [peer.name, peer])).values()];

  async function invite(e) {
    e.preventDefault();
    if (!username.trim()) return;
    setBusy(true);
    setError("");
    try {
      const data = await api(`/documents/${doc.id}/share`, {
        method: "POST",
        body: JSON.stringify({ username: username.trim() }),
      });
      onChange(data.document);
      setUsername("");
      setNote(`${username.trim()} can now edit this document.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setNote("Link copied. Signed-in people with this link can edit together.");
    } catch {
      setNote(window.location.href);
    }
  }

  async function toggleLink(on) {
    if (!isOwner) return;
    setBusy(true);
    setError("");
    try {
      const data = await api(`/documents/${doc.id}`, {
        method: "PATCH",
        body: JSON.stringify({ visibility: on ? "link" : "private" }),
      });
      onChange(data.document);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function removePerson(person) {
    if (!isOwner || person.role === "Owner") return;
    setBusy(true);
    setError("");
    try {
      const data = await api(`/documents/${doc.id}/share/${person.id}`, { method: "DELETE" });
      onChange(data.document);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="share-overlay" onClick={onClose}>
      <div className="share-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="share-title">
        <header>
          <h2 id="share-title">Share</h2>
          <button type="button" className="icon-btn" onClick={onClose} title="Close">
            <X size={16} />
          </button>
        </header>
        <form className="share-invite" onSubmit={invite}>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Invite people by username"
            autoFocus
            disabled={busy}
          />
          <button type="submit" className="btn primary" disabled={busy || !username.trim()}>
            Send
          </button>
        </form>
        {error && <div className="form-error">{error}</div>}
        {note && <p className="muted">{note}</p>}

        <h3>People with access</h3>
        <ul className="share-people">
          {people.map((person) => (
            <li key={person.id}>
              <span className="avatar" style={{ background: person.color }}>
                {person.username.slice(0, 1).toUpperCase()}
              </span>
              <span>
                <strong>
                  {person.username}
                  {person.id === user?.id ? " (you)" : ""}
                </strong>
                <em>{person.role}</em>
              </span>
              {isOwner && person.role !== "Owner" && (
                <button type="button" className="btn" disabled={busy} onClick={() => removePerson(person)}>
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>

        {live.length > 0 && (
          <>
            <h3>Currently editing</h3>
            <div className="share-live">
              {live.map((peer) => (
                <span key={peer.name} className="avatar" style={{ background: peer.color }} title={peer.name}>
                  {peer.name.slice(0, 1).toUpperCase()}
                </span>
              ))}
              <span className="muted">
                {live.length} {live.length === 1 ? "person" : "people"} in this document
              </span>
            </div>
          </>
        )}

        <label className="share-link-toggle">
          <input
            type="checkbox"
            checked={doc?.visibility !== "private"}
            disabled={!isOwner || busy}
            onChange={(e) => toggleLink(e.target.checked)}
          />
          Anyone with the link can edit
        </label>
        <button type="button" className="btn primary" onClick={copyLink}>
          Copy link
        </button>
      </div>
    </div>
  );
}
