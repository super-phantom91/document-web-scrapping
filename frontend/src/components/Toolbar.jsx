import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Highlighter,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Redo2,
  Strikethrough,
  Subscript,
  Superscript,
  Table as TableIcon,
  Underline,
  Undo2,
} from "lucide-react";
import { api } from "../api.js";

const FONTS = ["Arial", "Calibri", "Times New Roman", "Georgia", "Verdana", "Courier New", "Trebuchet MS"];
const SIZES = ["11px", "12px", "14px", "16px", "18px", "20px", "24px", "28px", "36px", "48px"];

function Tool({ active, onClick, title, children, disabled }) {
  return (
    <button type="button" className={`ribbon-btn ${active ? "active" : ""}`} title={title} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export default function Toolbar({ editor }) {
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

  return (
    <div className="ribbon">
      <div className="ribbon-group">
        <Tool title="Undo" onClick={() => editor.chain().focus().undo().run()}>
          <Undo2 size={16} />
        </Tool>
        <Tool title="Redo" onClick={() => editor.chain().focus().redo().run()}>
          <Redo2 size={16} />
        </Tool>
      </div>

      <div className="ribbon-group">
        <select
          className="ribbon-select"
          value={editor.getAttributes("textStyle").fontFamily || "Arial"}
          onChange={(e) => editor.chain().focus().setFontFamily(e.target.value).run()}
        >
          {FONTS.map((font) => (
            <option key={font} value={font} style={{ fontFamily: font }}>
              {font}
            </option>
          ))}
        </select>
        <select
          className="ribbon-select sm"
          value={editor.getAttributes("textStyle").fontSize || "16px"}
          onChange={(e) => editor.chain().focus().setFontSize(e.target.value).run()}
        >
          {SIZES.map((size) => (
            <option key={size} value={size}>
              {size.replace("px", "")}
            </option>
          ))}
        </select>
      </div>

      <div className="ribbon-group">
        <Tool title="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold size={16} />
        </Tool>
        <Tool title="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic size={16} />
        </Tool>
        <Tool title="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
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
      </div>

      <div className="ribbon-group">
        <label className="color-wrap" title="Text color">
          <input
            type="color"
            value={editor.getAttributes("textStyle").color || "#111827"}
            onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
          />
          A
        </label>
        <label className="color-wrap" title="Highlight">
          <Highlighter size={14} />
          <input
            type="color"
            value={editor.getAttributes("highlight").color || "#fde68a"}
            onChange={(e) => editor.chain().focus().toggleHighlight({ color: e.target.value }).run()}
          />
        </label>
      </div>

      <div className="ribbon-group">
        <Tool title="Align left" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}>
          <AlignLeft size={16} />
        </Tool>
        <Tool title="Align center" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}>
          <AlignCenter size={16} />
        </Tool>
        <Tool title="Align right" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()}>
          <AlignRight size={16} />
        </Tool>
        <Tool title="Justify" active={editor.isActive({ textAlign: "justify" })} onClick={() => editor.chain().focus().setTextAlign("justify").run()}>
          <AlignJustify size={16} />
        </Tool>
      </div>

      <div className="ribbon-group">
        <select
          className="ribbon-select"
          value={
            editor.isActive("heading", { level: 1 })
              ? "h1"
              : editor.isActive("heading", { level: 2 })
                ? "h2"
                : editor.isActive("heading", { level: 3 })
                  ? "h3"
                  : "p"
          }
          onChange={(e) => {
            const value = e.target.value;
            if (value === "p") editor.chain().focus().setParagraph().run();
            else editor.chain().focus().toggleHeading({ level: Number(value.slice(1)) }).run();
          }}
        >
          <option value="p">Normal</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
        </select>
        <Tool title="Bullets" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List size={16} />
        </Tool>
        <Tool title="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered size={16} />
        </Tool>
      </div>

      <div className="ribbon-group">
        <Tool title="Insert table" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
          <TableIcon size={16} />
        </Tool>
        <Tool title="Insert image" onClick={addImage}>
          <ImagePlus size={16} />
        </Tool>
        <Tool title="Insert link" active={editor.isActive("link")} onClick={addLink}>
          <Link2 size={16} />
        </Tool>
      </div>
    </div>
  );
}
