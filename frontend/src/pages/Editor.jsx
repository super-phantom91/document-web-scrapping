import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
import { Redo2, Save, ScanSearch, Search, Share2, Undo2 } from "lucide-react";
import { api, getToken } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { FontSize } from "../extensions/FontSize.js";
import { ParagraphStyle } from "../extensions/ParagraphStyle.js";
import Toolbar from "../components/Toolbar.jsx";
import ExtractPanel from "../components/ExtractPanel.jsx";
import FileBackstage from "../components/FileBackstage.jsx";
import NavPane from "../components/NavPane.jsx";

const COLLAB_URL = import.meta.env.VITE_COLLAB_URL || "ws://localhost:1234";

export default function EditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileRef = useRef(null);
  const [meta, setMeta] = useState(null);
  const [title, setTitle] = useState("");
  const [peers, setPeers] = useState([]);
  const [extractOpen, setExtractOpen] = useState(false);
  const [extraction, setExtraction] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState("");
  const [mysqlInfo, setMysqlInfo] = useState(null);
  const [shareNote, setShareNote] = useState("");
  const [zoom, setZoom] = useState(100);
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [findFrom, setFindFrom] = useState(0);
  const [tab, setTab] = useState("home");
  const [fileOpen, setFileOpen] = useState(false);
  const [fileSection, setFileSection] = useState("info");
  const [documents, setDocuments] = useState([]);
  const [busy, setBusy] = useState(false);
  const [fileError, setFileError] = useState("");
  const [dropActive, setDropActive] = useState(false);
  const [showNav, setShowNav] = useState(false);
  const [showRuler, setShowRuler] = useState(true);
  const [viewMode, setViewMode] = useState("print");
  const [margins, setMargins] = useState("normal");

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
        if (cancelled) return;
        if (data.extraction) setExtraction(data.extraction);
        if (data.mysql) setMysqlInfo(data.mysql);
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
        Placeholder.configure({ placeholder: "Start typing, or open a Word document from File → Open…" }),
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
        attributes: { class: "page-editor margin-normal" },
      },
    },
    [ydoc, provider, user]
  );

  useEffect(() => {
    if (!editor) return;
    editor.setOptions({
      editorProps: {
        attributes: { class: `page-editor margin-${margins}` },
      },
    });
  }, [editor, margins]);

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
      setMysqlInfo(data.mysql || null);
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

  function saveToast() {
    setShareNote("All changes saved automatically.");
    setTimeout(() => setShareNote(""), 2000);
  }

  async function openFileMenu() {
    setFileSection("info");
    setFileOpen(true);
    setFileError("");
    try {
      const data = await api("/documents");
      setDocuments(data.documents);
    } catch {
      setDocuments([]);
    }
  }

  async function createDoc() {
    setBusy(true);
    setFileError("");
    try {
      const data = await api("/documents", {
        method: "POST",
        body: JSON.stringify({ title: "Document" }),
      });
      setFileOpen(false);
      navigate(`/d/${data.document.id}`);
    } catch (err) {
      setFileError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function importDocx(file) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".docx")) {
      setFileError("Only .docx Word documents can be opened.");
      setFileOpen(true);
      setFileSection("open");
      return;
    }
    setBusy(true);
    setFileError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const data = await api("/documents/import", { method: "POST", body: form });
      setFileOpen(false);
      navigate(`/d/${data.document.id}`);
    } catch (err) {
      setFileError(err.message);
      setFileOpen(true);
      setFileSection("open");
    } finally {
      setBusy(false);
    }
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
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === "f") {
        e.preventDefault();
        setFileOpen(false);
        setFindOpen(true);
      }
      if (key === "p") {
        e.preventDefault();
        window.print();
      }
      if (key === "o") {
        e.preventDefault();
        setFileOpen(true);
        setFileSection("open");
        fileRef.current?.click();
      }
      if (key === "s") {
        e.preventDefault();
        setShareNote("All changes saved automatically.");
        setTimeout(() => setShareNote(""), 2000);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const words = editor?.storage.characterCount?.words?.() || 0;
  const chars = editor?.storage.characterCount?.characters?.() || 0;

  return (
    <div
      className="editor-shell"
      onDragOver={(e) => {
        e.preventDefault();
        setDropActive(true);
      }}
      onDragLeave={() => setDropActive(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDropActive(false);
        const file = e.dataTransfer.files?.[0];
        if (file) importDocx(file);
      }}
    >
      <header className="editor-top word-titlebar">
        <span className="word-mark" title="Word">
          W
        </span>
        <div className="qat">
          <button type="button" className="qat-btn" title="Save (Ctrl+S)" onClick={saveToast}>
            <Save size={14} />
          </button>
          <button type="button" className="qat-btn" title="Undo" onClick={() => editor?.chain().focus().undo().run()}>
            <Undo2 size={14} />
          </button>
          <button type="button" className="qat-btn" title="Redo" onClick={() => editor?.chain().focus().redo().run()}>
            <Redo2 size={14} />
          </button>
        </div>
        <input className="title-input" value={title} onChange={(e) => setTitle(e.target.value)} />
        <span className="word-ext">.docx - Word</span>
        <span className="autosave">Autosave On</span>
        <label className="tell-me">
          <Search size={14} />
          <input
            placeholder="Tell me what you want to do"
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              const q = e.target.value.toLowerCase();
              if (q.includes("find")) setFindOpen(true);
              else if (q.includes("print")) window.print();
              else if (q.includes("open")) {
                openFileMenu();
                setFileSection("open");
              } else if (q.includes("extract") || q.includes("insight") || q.includes("scrap")) extract();
              else setFindQuery(e.target.value);
            }}
          />
        </label>
        <div className="peer-row">
          {peers.map((peer, i) => (
            <span key={`${peer.name}-${i}`} className="avatar" style={{ background: peer.color }} title={peer.name}>
              {peer.name.slice(0, 1).toUpperCase()}
            </span>
          ))}
        </div>
        <button className="btn ghost light" onClick={share}>
          <Share2 size={16} /> Share
        </button>
        <button className="btn primary" onClick={extract} disabled={extracting} title="Scrap name, category, and other fields">
          <ScanSearch size={16} className={extracting ? "spin" : ""} /> {extracting ? "Scrapping…" : "Scrap"}
        </button>
      </header>
      <input
        ref={fileRef}
        type="file"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          importDocx(file);
        }}
      />
      {fileOpen ? (
        <FileBackstage
          section={fileSection}
          onSection={setFileSection}
          documents={documents}
          current={meta}
          busy={busy}
          error={fileError}
          onBack={() => setFileOpen(false)}
          onNew={createDoc}
          onOpenComputer={() => fileRef.current?.click()}
          onOpenDocument={(docId) => {
            setFileOpen(false);
            if (docId !== id) navigate(`/d/${docId}`);
          }}
          onPrint={() => window.print()}
          onShare={share}
          onClose={() => navigate("/")}
        />
      ) : (
        <>
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
          <Toolbar
            editor={editor}
            tab={tab}
            onTab={setTab}
            onFile={openFileMenu}
            zoom={zoom}
            onZoom={setZoom}
            viewMode={viewMode}
            onViewMode={setViewMode}
            showRuler={showRuler}
            onToggleRuler={() => setShowRuler((v) => !v)}
            showNav={showNav}
            onToggleNav={() => setShowNav((v) => !v)}
            margins={margins}
            onMargins={setMargins}
            onFind={() => setFindOpen(true)}
            onExtract={extract}
            onPrint={() => window.print()}
            extracting={extracting}
          />
          <div className="editor-body">
            {showNav && <NavPane editor={editor} onClose={() => setShowNav(false)} />}
            <div className={`page-wrap ${viewMode}`}>
              <div
                className="page-stage"
                style={
                  viewMode === "print"
                    ? {
                        transform: `scale(${zoom / 100})`,
                        height: `${Math.round((1076 * zoom) / 100)}px`,
                      }
                    : undefined
                }
              >
                {showRuler && viewMode === "print" && (
                  <div className="ruler" aria-hidden="true">
                    {Array.from({ length: 9 }, (_, inch) => (
                      <span key={inch} className="ruler-inch" style={{ left: `${inch * 96}px` }}>
                        {inch}
                        <i />
                      </span>
                    ))}
                  </div>
                )}
                <div className={`page ${viewMode}`}>
                  {editor ? <EditorContent editor={editor} /> : <div className="boot">Connecting…</div>}
                </div>
              </div>
            </div>
            {extractOpen && (
              <ExtractPanel
                data={extraction}
                loading={extracting}
                error={extractError}
                onScrap={extract}
                mysql={mysqlInfo}
                onClose={() => setExtractOpen(false)}
              />
            )}
          </div>
          <footer className="status-bar word-status">
            <span>Page 1 of 1</span>
            <span>{words} words</span>
            <span>{chars} characters</span>
            <span>English (United States)</span>
            <span className={extracting ? "status-live" : ""}>
              {extracting
                ? "Scrapping…"
                : extraction
                  ? `${["name", "category", "summary", "description", "author", "tags"].filter((key) => extraction[key]).length} fields scraped`
                  : "Ready"}
            </span>
            <span>{peers.length} editing</span>
            <label className="zoom-control">
              <span>{zoom}%</span>
              <input type="range" min="75" max="150" step="5" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
            </label>
          </footer>
        </>
      )}
      {dropActive && <div className="drop-overlay">Drop a Word document (.docx) to open it</div>}
    </div>
  );
}
