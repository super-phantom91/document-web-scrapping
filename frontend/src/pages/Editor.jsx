import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { Color } from "@tiptap/extension-color";
import TextStyle from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import FontFamily from "@tiptap/extension-font-family";
import Image from "@tiptap/extension-image";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import LinkMark from "@tiptap/extension-link";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { HocuspocusProvider } from "@hocuspocus/provider";
import * as Y from "yjs";
import { ArrowLeft, Database, Printer, ScanSearch, Search, Share2 } from "lucide-react";
import { api, getToken } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { FontSize } from "../extensions/FontSize.js";
import { ParagraphStyle } from "../extensions/ParagraphStyle.js";
import Toolbar from "../components/Toolbar.jsx";
import ExtractPanel from "../components/ExtractPanel.jsx";

const COLLAB_URL = import.meta.env.VITE_COLLAB_URL || "ws://localhost:1234";

export default function EditorPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [meta, setMeta] = useState(null);
  const [title, setTitle] = useState("");
  const [peers, setPeers] = useState([]);
  const [extractOpen, setExtractOpen] = useState(false);
  const [extraction, setExtraction] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState("");
  const [shareNote, setShareNote] = useState("");
  const [zoom, setZoom] = useState(100);
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [findFrom, setFindFrom] = useState(0);

  const ydoc = useMemo(() => new Y.Doc(), [id]);
  const [provider, setProvider] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api(`/documents/${id}`)
      .then((data) => {
        if (cancelled) return;
        setMeta(data.document);
        setTitle(data.document.title);
      })
      .catch((err) => setExtractError(err.message));
    api(`/documents/${id}/extraction`)
      .then((data) => {
        if (!cancelled && data.extraction) setExtraction(data.extraction);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    const p = new HocuspocusProvider({
      url: COLLAB_URL,
      name: id,
      document: ydoc,
      token: getToken(),
    });
    setProvider(p);
    return () => p.destroy();
  }, [id, ydoc]);

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({ history: false }),
        Underline,
        TextStyle,
        Color,
        Highlight.configure({ multicolor: true }),
        FontFamily,
        FontSize,
        ParagraphStyle,
        Subscript,
        Superscript,
        TextAlign.configure({ types: ["heading", "paragraph"] }),
        Image,
        LinkMark.configure({ openOnClick: false }),
        Table.configure({ resizable: true }),
        TableRow,
        TableHeader,
        TableCell,
        Placeholder.configure({ placeholder: "Start typing, or import a Word document from the home page…" }),
        CharacterCount,
        Collaboration.configure({ document: ydoc }),
        ...(provider
          ? [
              CollaborationCursor.configure({
                provider,
                user: { name: user.username, color: user.color },
              }),
            ]
          : []),
      ],
      editorProps: {
        attributes: { class: "page-editor", spellcheck: "true" },
      },
    },
    [ydoc, provider, user]
  );

  useEffect(() => {
    if (!editor || !provider || !meta) return;
    const apply = () => {
      const fragment = ydoc.getXmlFragment("default");
      if (fragment.length === 0 && meta.initialHtml) {
        editor.commands.setContent(meta.initialHtml);
        api(`/documents/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ initialHtml: "" }),
        }).catch(() => {});
      }
    };
    if (provider.synced) apply();
    provider.on("synced", apply);
    return () => provider.off("synced", apply);
  }, [editor, provider, meta, ydoc, id]);

  useEffect(() => {
    if (!provider) return;
    const update = () => {
      const states = Array.from(provider.awareness.getStates().values());
      setPeers(states.map((s) => s.user).filter(Boolean));
    };
    provider.awareness.on("change", update);
    update();
    return () => provider.awareness.off("change", update);
  }, [provider]);

  useEffect(() => {
    if (!title || !meta || title === meta.title) return;
    const timer = setTimeout(() => {
      api(`/documents/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ title }),
      }).then((data) => setMeta(data.document));
    }, 500);
    return () => clearTimeout(timer);
  }, [title, id, meta]);

  async function extract() {
    if (!editor) return;
    setExtractOpen(true);
    setExtracting(true);
    setExtractError("");
    try {
      const data = await api(`/documents/${id}/extract`, {
        method: "POST",
        body: JSON.stringify({ html: editor.getHTML() }),
      });
      setExtraction(data.extraction);
    } catch (err) {
      setExtractError(err.message);
    } finally {
      setExtracting(false);
    }
  }

  async function share() {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setShareNote("Link copied — anyone signed in can edit.");
    } catch {
      setShareNote(url);
    }
    setTimeout(() => setShareNote(""), 2500);
  }

  function findNext(startAt = findFrom) {
    if (!editor || !findQuery.trim()) return;
    const needle = findQuery.toLowerCase();
    let found = null;
    editor.state.doc.descendants((node, pos) => {
      if (found || !node.isText) return;
      const hay = node.text.toLowerCase();
      let from = 0;
      if (pos < startAt && pos + node.text.length > startAt) from = startAt - pos;
      else if (pos < startAt) return;
      const idx = hay.indexOf(needle, from);
      if (idx >= 0) found = { from: pos + idx, to: pos + idx + findQuery.length };
    });
    if (!found && startAt > 0) {
      setFindFrom(0);
      findNext(0);
      return;
    }
    if (found) {
      editor.chain().focus().setTextSelection(found).run();
      setFindFrom(found.to);
    }
  }

  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setFindOpen(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        window.print();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const words = editor?.storage.characterCount?.words?.() || 0;
  const chars = editor?.storage.characterCount?.characters?.() || 0;

  return (
    <div className="editor-shell word-app">
      <header className="editor-top word-titlebar">
        <Link to="/" className="icon-btn light" title="All documents">
          <ArrowLeft size={18} />
        </Link>
        <span className="word-mark" title="DocuSync">W</span>
        <input className="title-input" value={title} onChange={(e) => setTitle(e.target.value)} />
        <span className="word-ext">.docx</span>
        <div className="peer-row">
          {peers.map((peer, i) => (
            <span key={`${peer.name}-${i}`} className="avatar" style={{ background: peer.color }} title={peer.name}>
              {peer.name.slice(0, 1).toUpperCase()}
            </span>
          ))}
        </div>
        <button className="btn ghost light" onClick={() => setFindOpen((open) => !open)} title="Find (Ctrl+F)">
          <Search size={16} />
        </button>
        <button className="btn ghost light" onClick={() => window.print()} title="Print (Ctrl+P)">
          <Printer size={16} />
        </button>
        <button className="btn ghost light" onClick={share}>
          <Share2 size={16} /> Share
        </button>
        {extraction && (
          <button className="btn ghost light" onClick={() => setExtractOpen(true)} title="Open data saved in MySQL">
            <Database size={16} /> Saved
          </button>
        )}
        <button className="btn primary" onClick={extract}>
          <ScanSearch size={16} /> Extract
        </button>
      </header>
      {findOpen && (
        <form
          className="find-bar"
          onSubmit={(e) => {
            e.preventDefault();
            findNext();
          }}
        >
          <Search size={14} />
          <input
            autoFocus
            value={findQuery}
            placeholder="Find in document"
            onChange={(e) => {
              setFindQuery(e.target.value);
              setFindFrom(0);
            }}
          />
          <button type="submit" className="btn">
            Find next
          </button>
          <button type="button" className="icon-btn" onClick={() => setFindOpen(false)} title="Close">
            ×
          </button>
        </form>
      )}
      {shareNote && <div className="toast">{shareNote}</div>}
      <Toolbar editor={editor} />
      <div className="editor-body">
        <div className="page-wrap">
          <div
            className="page-stage"
            style={{
              transform: `scale(${zoom / 100})`,
              height: `${Math.round((1076 * zoom) / 100)}px`,
            }}
          >
            <div className="ruler" aria-hidden="true">
              {Array.from({ length: 9 }, (_, inch) => (
                <span key={inch} className="ruler-inch" style={{ left: `${inch * 96}px` }}>
                  {inch}
                  <i />
                </span>
              ))}
            </div>
            <div className="page">{editor ? <EditorContent editor={editor} /> : <div className="boot">Connecting…</div>}</div>
          </div>
        </div>
        {extractOpen && (
          <ExtractPanel
            data={extraction}
            loading={extracting}
            error={extractError}
            onClose={() => setExtractOpen(false)}
          />
        )}
      </div>
      <footer className="status-bar word-status">
        <span>Page 1 of 1</span>
        <span>{words} words</span>
        <span>{chars} characters</span>
        <span>{peers.length} editing</span>
        <label className="zoom-control">
          <span>{zoom}%</span>
          <input type="range" min="75" max="150" step="5" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
        </label>
      </footer>
    </div>
  );
}
