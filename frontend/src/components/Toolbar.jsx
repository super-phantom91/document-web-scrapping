import { useEffect, useState } from "react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Columns3,
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
  Redo2,
  Rows3,
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

export default function Toolbar({ editor }) {
  const [, setTick] = useState(0);
  const [tab, setTab] = useState("home");

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

  const inTable = editor.isActive("table");
  const font = editor.getAttributes("textStyle").fontFamily || "Calibri";
  const size = editor.getAttributes("textStyle").fontSize || "11pt";
  const lineHeight =
    editor.getAttributes("paragraph").lineHeight || editor.getAttributes("heading").lineHeight || "1.15";

  return (
    <div className="word-ribbon">
      <div className="ribbon-tabs" role="tablist">
        {["home", "insert", "layout"].map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            className={`ribbon-tab ${tab === id ? "active" : ""}`}
            onClick={() => setTab(id)}
          >
            {id[0].toUpperCase() + id.slice(1)}
          </button>
        ))}
      </div>

      {tab === "home" && (
        <div className="ribbon">
          <div className="ribbon-group labeled">
            <span className="group-label">Clipboard</span>
            <div className="group-row">
              <Tool title="Undo (Ctrl+Z)" onClick={() => editor.chain().focus().undo().run()}>
                <Undo2 size={16} />
              </Tool>
              <Tool title="Redo (Ctrl+Y)" onClick={() => editor.chain().focus().redo().run()}>
                <Redo2 size={16} />
              </Tool>
              <Tool
                title="Clear formatting"
                onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
              >
                <Eraser size={16} />
              </Tool>
            </div>
          </div>

          <div className="ribbon-group labeled">
            <span className="group-label">Font</span>
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
            </div>
          </div>

          <div className="ribbon-group labeled">
            <span className="group-label">Paragraph</span>
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
          </div>

          <div className="ribbon-group labeled">
            <span className="group-label">Styles</span>
            <div className="group-row">
              <select className="ribbon-select style" value={currentStyle(editor)} onChange={(e) => applyStyle(editor, e.target.value)}>
                <option value="p">Normal</option>
                <option value="h1">Heading 1</option>
                <option value="h2">Heading 2</option>
                <option value="h3">Heading 3</option>
                <option value="h4">Heading 4</option>
                <option value="quote">Quote</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {tab === "insert" && (
        <div className="ribbon">
          <div className="ribbon-group labeled">
            <span className="group-label">Tables</span>
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
          </div>
          <div className="ribbon-group labeled">
            <span className="group-label">Illustrations</span>
            <div className="group-row">
              <Tool wide title="Pictures" onClick={addImage}>
                <ImagePlus size={16} /> Pictures
              </Tool>
            </div>
          </div>
          <div className="ribbon-group labeled">
            <span className="group-label">Links</span>
            <div className="group-row">
              <Tool wide title="Link" active={editor.isActive("link")} onClick={addLink}>
                <Link2 size={16} /> Link
              </Tool>
            </div>
          </div>
          <div className="ribbon-group labeled">
            <span className="group-label">Pages</span>
            <div className="group-row">
              <Tool wide title="Horizontal line" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
                <Minus size={16} /> Line
              </Tool>
              <Tool wide title="Page break" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
                <Plus size={16} /> Page break
              </Tool>
            </div>
          </div>
        </div>
      )}

      {tab === "layout" && (
        <div className="ribbon">
          <div className="ribbon-group labeled">
            <span className="group-label">Paragraph</span>
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
          </div>
          <div className="ribbon-group labeled">
            <span className="group-label">Alignment</span>
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
          </div>
        </div>
      )}
    </div>
  );
}
