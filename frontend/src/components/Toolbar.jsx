import { useEffect, useState } from "react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  ClipboardPaste,
  Columns3,
  Copy,
  Eraser,
  Highlighter,
  ImagePlus,
  Indent,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Outdent,
  Plus,
  Printer,
  Redo2,
  Rows3,
  Scissors,
  Search,
  ScanSearch,
  Strikethrough,
  Subscript,
  Superscript,
  Table as TableIcon,
  Trash2,
  Underline,
  Undo2,
} from "lucide-react";
import { api } from "../api.js";

const FONTS = [
  "Calibri",
  "Cambria",
  "Arial",
  "Times New Roman",
  "Georgia",
  "Verdana",
  "Trebuchet MS",
  "Courier New",
  "Comic Sans MS",
  "Consolas",
];
const SIZES = ["8pt", "9pt", "10pt", "11pt", "12pt", "14pt", "16pt", "18pt", "20pt", "22pt", "24pt", "28pt", "36pt", "48pt", "72pt"];
const LINE_HEIGHTS = [
  { label: "1.0", value: "1" },
  { label: "1.15", value: "1.15" },
  { label: "1.5", value: "1.5" },
  { label: "2.0", value: "2" },
];
const TABS = [
  { id: "file", label: "File" },
  { id: "home", label: "Home" },
  { id: "insert", label: "Insert" },
  { id: "layout", label: "Layout" },
  { id: "review", label: "Review" },
  { id: "view", label: "View" },
];

function Tool({ active, onClick, title, children, disabled, wide }) {
  return (
    <button
      type="button"
      className={`ribbon-btn ${active ? "active" : ""} ${wide ? "wide" : ""}`}
      title={title}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function currentStyle(editor) {
  if (editor.isActive("heading", { level: 1 })) return "h1";
  if (editor.isActive("heading", { level: 2 })) return "h2";
  if (editor.isActive("heading", { level: 3 })) return "h3";
  if (editor.isActive("heading", { level: 4 })) return "h4";
  if (editor.isActive("blockquote")) return "quote";
  return "p";
}

function applyStyle(editor, value) {
  if (value === "p") editor.chain().focus().setParagraph().run();
  else if (value === "quote") editor.chain().focus().toggleBlockquote().run();
  else editor.chain().focus().toggleHeading({ level: Number(value.slice(1)) }).run();
}

function bumpFont(editor, size, dir) {
  const index = SIZES.indexOf(size);
  const next = SIZES[Math.min(SIZES.length - 1, Math.max(0, (index < 0 ? 4 : index) + dir))];
  editor.chain().focus().setFontSize(next).run();
}

export default function Toolbar({
  editor,
  tab,
  onTab,
  onFile,
  zoom,
  onZoom,
  viewMode,
  onViewMode,
  showRuler,
  onToggleRuler,
  showNav,
  onToggleNav,
  margins,
  onMargins,
  onFind,
  onExtract,
  onPrint,
  extracting,
}) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!editor) return undefined;
    const bump = () => setTick((n) => n + 1);
    editor.on("selectionUpdate", bump);
    editor.on("transaction", bump);
    return () => {
      editor.off("selectionUpdate", bump);
      editor.off("transaction", bump);
    };
  }, [editor]);

  if (!editor) return null;

  async function addImage() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const form = new FormData();
      form.append("file", file);
      const data = await api("/documents/upload-image", { method: "POST", body: form });
      editor.chain().focus().setImage({ src: data.url, alt: file.name }).run();
    };
    input.click();
  }

  function addLink() {
    const previous = editor.getAttributes("link").href || "";
    const url = window.prompt("Link URL", previous);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  async function paste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) editor.chain().focus().insertContent(text.replace(/\n/g, "<br>")).run();
    } catch {
      editor.chain().focus().run();
    }
  }

  const inTable = editor.isActive("table");
  const font = editor.getAttributes("textStyle").fontFamily || "Calibri";
  const size = editor.getAttributes("textStyle").fontSize || "11pt";
  const lineHeight =
    editor.getAttributes("paragraph").lineHeight || editor.getAttributes("heading").lineHeight || "1.15";
  const style = currentStyle(editor);

  return (
    <div className="word-ribbon">
      <div className="ribbon-tabs" role="tablist">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            className={`ribbon-tab ${item.id === "file" ? "file" : ""} ${tab === item.id ? "active" : ""}`}
            onClick={() => (item.id === "file" ? onFile() : onTab(item.id))}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "home" && (
        <div className="ribbon">
          <div className="ribbon-group labeled">
            <div className="group-row">
              <button type="button" className="ribbon-stack" title="Paste (Ctrl+V)" onClick={paste}>
                <ClipboardPaste size={22} />
                Paste
              </button>
              <div className="group-col">
                <Tool title="Cut (Ctrl+X)" onClick={() => document.execCommand("cut")}>
                  <Scissors size={14} />
                </Tool>
                <Tool title="Copy (Ctrl+C)" onClick={() => document.execCommand("copy")}>
                  <Copy size={14} />
                </Tool>
              </div>
            </div>
            <span className="group-label">Clipboard</span>
          </div>

          <div className="ribbon-group labeled">
            <div className="group-row wrap">
              <select
                className="ribbon-select font"
                value={FONTS.includes(font) ? font : "Calibri"}
                onChange={(e) => editor.chain().focus().setFontFamily(e.target.value).run()}
              >
                {FONTS.map((name) => (
                  <option key={name} value={name} style={{ fontFamily: name }}>
                    {name}
                  </option>
                ))}
              </select>
              <select
                className="ribbon-select sm"
                value={size}
                onChange={(e) => editor.chain().focus().setFontSize(e.target.value).run()}
              >
                {SIZES.map((pt) => (
                  <option key={pt} value={pt}>
                    {pt.replace("pt", "")}
                  </option>
                ))}
              </select>
              <Tool title="Grow font" onClick={() => bumpFont(editor, size, 1)}>
                A+
              </Tool>
              <Tool title="Shrink font" onClick={() => bumpFont(editor, size, -1)}>
                A-
              </Tool>
              <Tool title="Bold (Ctrl+B)" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
                <Bold size={16} />
              </Tool>
              <Tool title="Italic (Ctrl+I)" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
                <Italic size={16} />
              </Tool>
              <Tool title="Underline (Ctrl+U)" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
                <Underline size={16} />
              </Tool>
              <Tool title="Strikethrough" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
                <Strikethrough size={16} />
              </Tool>
              <Tool title="Subscript" active={editor.isActive("subscript")} onClick={() => editor.chain().focus().toggleSubscript().run()}>
                <Subscript size={16} />
              </Tool>
              <Tool title="Superscript" active={editor.isActive("superscript")} onClick={() => editor.chain().focus().toggleSuperscript().run()}>
                <Superscript size={16} />
              </Tool>
              <label className="color-wrap" title="Font color">
                <input
                  type="color"
                  value={editor.getAttributes("textStyle").color || "#000000"}
                  onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
                />
                <span className="color-letter">A</span>
                <i style={{ background: editor.getAttributes("textStyle").color || "#000000" }} />
              </label>
              <label className="color-wrap" title="Text highlight color">
                <Highlighter size={14} />
                <input
                  type="color"
                  value={editor.getAttributes("highlight").color || "#ffff00"}
                  onChange={(e) => editor.chain().focus().toggleHighlight({ color: e.target.value }).run()}
                />
                <i style={{ background: editor.getAttributes("highlight").color || "#ffff00" }} />
              </label>
              <Tool title="Clear formatting" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>
                <Eraser size={16} />
              </Tool>
            </div>
            <span className="group-label">Font</span>
          </div>

          <div className="ribbon-group labeled">
            <div className="group-row">
              <Tool title="Bullets" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
                <List size={16} />
              </Tool>
              <Tool title="Numbering" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
                <ListOrdered size={16} />
              </Tool>
              <Tool title="Decrease indent" onClick={() => editor.chain().focus().decreaseIndent().run()}>
                <Outdent size={16} />
              </Tool>
              <Tool title="Increase indent" onClick={() => editor.chain().focus().increaseIndent().run()}>
                <Indent size={16} />
              </Tool>
              <Tool title="Align left" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}>
                <AlignLeft size={16} />
              </Tool>
              <Tool title="Center" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}>
                <AlignCenter size={16} />
              </Tool>
              <Tool title="Align right" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()}>
                <AlignRight size={16} />
              </Tool>
              <Tool title="Justify" active={editor.isActive({ textAlign: "justify" })} onClick={() => editor.chain().focus().setTextAlign("justify").run()}>
                <AlignJustify size={16} />
              </Tool>
              <select
                className="ribbon-select sm"
                title="Line and paragraph spacing"
                value={lineHeight}
                onChange={(e) => editor.chain().focus().setLineHeight(e.target.value).run()}
              >
                {LINE_HEIGHTS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <span className="group-label">Paragraph</span>
          </div>

          <div className="ribbon-group labeled">
            <div className="style-gallery">
              {[
                ["p", "Normal"],
                ["h1", "Heading 1"],
                ["h2", "Heading 2"],
                ["h3", "Heading 3"],
                ["quote", "Quote"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`style-chip ${id} ${style === id ? "active" : ""}`}
                  onClick={() => applyStyle(editor, id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="group-label">Styles</span>
          </div>

          <div className="ribbon-group labeled">
            <div className="group-row">
              <Tool wide title="Find (Ctrl+F)" onClick={onFind}>
                <Search size={16} /> Find
              </Tool>
            </div>
            <span className="group-label">Editing</span>
          </div>
          <div className="ribbon-group labeled">
            <div className="group-row">
              <button
                type="button"
                className={`ribbon-stack ${extracting ? "is-busy" : ""}`}
                title="Scrap name, category, and other fields"
                onClick={onExtract}
                disabled={extracting}
              >
                <ScanSearch size={22} className={extracting ? "spin" : ""} />
                {extracting ? "Scrapping" : "Scrap"}
              </button>
            </div>
            <span className="group-label">Scraping</span>
          </div>
        </div>
      )}

      {tab === "insert" && (
        <div className="ribbon">
          <div className="ribbon-group labeled">
            <div className="group-row">
              <Tool wide title="Insert table" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
                <TableIcon size={16} /> Table
              </Tool>
              <Tool title="Add row" disabled={!inTable} onClick={() => editor.chain().focus().addRowAfter().run()}>
                <Rows3 size={16} />
              </Tool>
              <Tool title="Add column" disabled={!inTable} onClick={() => editor.chain().focus().addColumnAfter().run()}>
                <Columns3 size={16} />
              </Tool>
              <Tool title="Delete row" disabled={!inTable} onClick={() => editor.chain().focus().deleteRow().run()}>
                <Minus size={16} />
              </Tool>
              <Tool title="Delete table" disabled={!inTable} onClick={() => editor.chain().focus().deleteTable().run()}>
                <Trash2 size={16} />
              </Tool>
            </div>
            <span className="group-label">Tables</span>
          </div>
          <div className="ribbon-group labeled">
            <div className="group-row">
              <Tool wide title="Pictures" onClick={addImage}>
                <ImagePlus size={16} /> Pictures
              </Tool>
            </div>
            <span className="group-label">Illustrations</span>
          </div>
          <div className="ribbon-group labeled">
            <div className="group-row">
              <Tool wide title="Link" active={editor.isActive("link")} onClick={addLink}>
                <Link2 size={16} /> Link
              </Tool>
            </div>
            <span className="group-label">Links</span>
          </div>
          <div className="ribbon-group labeled">
            <div className="group-row">
              <Tool wide title="Horizontal line" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
                <Minus size={16} /> Line
              </Tool>
              <Tool wide title="Page break" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
                <Plus size={16} /> Page break
              </Tool>
            </div>
            <span className="group-label">Pages</span>
          </div>
        </div>
      )}

      {tab === "layout" && (
        <div className="ribbon">
          <div className="ribbon-group labeled">
            <div className="group-row">
              {[
                ["narrow", "Narrow"],
                ["normal", "Normal"],
                ["wide", "Wide"],
              ].map(([id, label]) => (
                <Tool key={id} wide title={`${label} margins`} active={margins === id} onClick={() => onMargins(id)}>
                  {label}
                </Tool>
              ))}
            </div>
            <span className="group-label">Page Setup</span>
          </div>
          <div className="ribbon-group labeled">
            <div className="group-row">
              <Tool title="Decrease indent" onClick={() => editor.chain().focus().decreaseIndent().run()}>
                <Outdent size={16} />
              </Tool>
              <Tool title="Increase indent" onClick={() => editor.chain().focus().increaseIndent().run()}>
                <Indent size={16} />
              </Tool>
              <select
                className="ribbon-select"
                title="Line spacing"
                value={lineHeight}
                onChange={(e) => editor.chain().focus().setLineHeight(e.target.value).run()}
              >
                {LINE_HEIGHTS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    Line spacing {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <span className="group-label">Paragraph</span>
          </div>
          <div className="ribbon-group labeled">
            <div className="group-row">
              <Tool title="Align left" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}>
                <AlignLeft size={16} />
              </Tool>
              <Tool title="Center" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}>
                <AlignCenter size={16} />
              </Tool>
              <Tool title="Align right" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()}>
                <AlignRight size={16} />
              </Tool>
              <Tool title="Justify" active={editor.isActive({ textAlign: "justify" })} onClick={() => editor.chain().focus().setTextAlign("justify").run()}>
                <AlignJustify size={16} />
              </Tool>
            </div>
            <span className="group-label">Alignment</span>
          </div>
        </div>
      )}

      {tab === "review" && (
        <div className="ribbon">
          <div className="ribbon-group labeled">
            <div className="group-row">
              <Tool wide title="Find (Ctrl+F)" onClick={onFind}>
                <Search size={16} /> Find
              </Tool>
            </div>
            <span className="group-label">Proofing</span>
          </div>
          <div className="ribbon-group labeled">
            <div className="group-row">
              <button
                type="button"
                className={`ribbon-stack ${extracting ? "is-busy" : ""}`}
                title="Scrap name, category, summary, description, author, tags, and images"
                onClick={onExtract}
                disabled={extracting}
              >
                <ScanSearch size={22} className={extracting ? "spin" : ""} />
                {extracting ? "Scrapping" : "Scrap"}
              </button>
            </div>
            <span className="group-label">Scraping</span>
          </div>
        </div>
      )}

      {tab === "view" && (
        <div className="ribbon">
          <div className="ribbon-group labeled">
            <div className="group-row">
              <Tool wide active={viewMode === "print"} onClick={() => onViewMode("print")} title="Print Layout">
                Print Layout
              </Tool>
              <Tool wide active={viewMode === "web"} onClick={() => onViewMode("web")} title="Web Layout">
                Web Layout
              </Tool>
            </div>
            <span className="group-label">Views</span>
          </div>
          <div className="ribbon-group labeled">
            <div className="group-row">
              <Tool wide active={showNav} onClick={onToggleNav} title="Navigation Pane">
                Navigation Pane
              </Tool>
              <Tool wide active={showRuler} onClick={onToggleRuler} title="Ruler">
                Ruler
              </Tool>
            </div>
            <span className="group-label">Show</span>
          </div>
          <div className="ribbon-group labeled">
            <div className="group-row">
              <Tool title="Undo" onClick={() => editor.chain().focus().undo().run()}>
                <Undo2 size={16} />
              </Tool>
              <Tool title="Redo" onClick={() => editor.chain().focus().redo().run()}>
                <Redo2 size={16} />
              </Tool>
              <Tool title="Print (Ctrl+P)" onClick={onPrint}>
                <Printer size={16} />
              </Tool>
              <select className="ribbon-select sm" value={String(zoom)} onChange={(e) => onZoom(Number(e.target.value))}>
                {[75, 100, 120, 150].map((n) => (
                  <option key={n} value={n}>
                    {n}%
                  </option>
                ))}
              </select>
            </div>
            <span className="group-label">Zoom</span>
          </div>
        </div>
      )}
    </div>
  );
}
