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
import { ArrowLeft, Database, ScanSearch, Share2 } from "lucide-react";
import { api, getToken } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { FontSize } from "../extensions/FontSize.js";
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
        attributes: { class: "page-editor" },
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

  const words = editor?.storage.characterCount?.words?.() || 0;

  return (
    <div className="editor-shell">
      <header className="editor-top">
        <Link to="/" className="icon-btn" title="All documents">
          <ArrowLeft size={18} />
        </Link>
        <input className="title-input" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="peer-row">
          {peers.map((peer, i) => (
            <span key={`${peer.name}-${i}`} className="avatar" style={{ background: peer.color }} title={peer.name}>
              {peer.name.slice(0, 1).toUpperCase()}
            </span>
          ))}
        </div>
        <button className="btn" onClick={share}>
          <Share2 size={16} /> Share
        </button>
        {extraction && (
          <button className="btn" onClick={() => setExtractOpen(true)} title="Open data saved in MySQL">
            <Database size={16} /> Saved
          </button>
        )}
        <button className="btn primary" onClick={extract}>
          <ScanSearch size={16} /> Extract
        </button>
      </header>
      {shareNote && <div className="toast">{shareNote}</div>}
      <Toolbar editor={editor} />
      <div className="editor-body">
        <div className="page-wrap">
          <div className="page">{editor ? <EditorContent editor={editor} /> : <div className="boot">Connecting…</div>}</div>
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
      <footer className="status-bar">
        <span>{words} words</span>
        <span>{peers.length} editing</span>
      </footer>
    </div>
  );
}
