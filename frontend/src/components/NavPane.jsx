import { useEffect, useState } from "react";

export default function NavPane({ editor, onClose }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!editor) return undefined;
    const bump = () => setTick((n) => n + 1);
    editor.on("update", bump);
    editor.on("selectionUpdate", bump);
    return () => {
      editor.off("update", bump);
      editor.off("selectionUpdate", bump);
    };
  }, [editor]);

  if (!editor) return null;

  const headings = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "heading") {
      headings.push({ level: node.attrs.level, text: node.textContent || "Heading", pos });
    }
  });

  return (
    <aside className="nav-pane">
      <header>
        <h2>Navigation</h2>
        <button type="button" className="icon-btn" onClick={onClose} title="Close">
          ×
        </button>
      </header>
      <p className="nav-hint">Headings</p>
      {headings.length === 0 ? (
        <p className="muted">Headings you add in the document appear here.</p>
      ) : (
        <ul className="nav-headings">
          {headings.map((h, i) => (
            <li key={`${h.pos}-${i}`}>
              <button
                type="button"
                className={`nav-h nav-h${h.level}`}
                onClick={() => editor.chain().focus().setTextSelection(h.pos + 1).scrollIntoView().run()}
              >
                {h.text}
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
