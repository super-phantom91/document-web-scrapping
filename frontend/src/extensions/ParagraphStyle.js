import { Extension } from "@tiptap/core";

export const ParagraphStyle = Extension.create({
  name: "paragraphStyle",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading"],
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element) => {
              const raw = element.style.marginLeft || element.getAttribute("data-indent");
              if (!raw) return 0;
              const px = parseFloat(raw);
              return Number.isFinite(px) ? Math.round(px / 36) : 0;
            },
            renderHTML: (attributes) => {
              const steps = Number(attributes.indent) || 0;
              if (steps <= 0) return {};
              return { style: `margin-left: ${steps * 36}px`, "data-indent": String(steps) };
            },
          },
          lineHeight: {
            default: null,
            parseHTML: (element) => element.style.lineHeight || null,
            renderHTML: (attributes) => {
              if (!attributes.lineHeight) return {};
              return { style: `line-height: ${attributes.lineHeight}` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      increaseIndent:
        () =>
        ({ editor, commands }) => {
          if (editor.can().sinkListItem("listItem")) return commands.sinkListItem("listItem");
          const current = Number(editor.getAttributes("paragraph").indent || editor.getAttributes("heading").indent || 0);
          return commands.updateAttributes(editor.isActive("heading") ? "heading" : "paragraph", {
            indent: Math.min(current + 1, 8),
          });
        },
      decreaseIndent:
        () =>
        ({ editor, commands }) => {
          if (editor.can().liftListItem("listItem")) return commands.liftListItem("listItem");
          const current = Number(editor.getAttributes("paragraph").indent || editor.getAttributes("heading").indent || 0);
          return commands.updateAttributes(editor.isActive("heading") ? "heading" : "paragraph", {
            indent: Math.max(current - 1, 0),
          });
        },
      setLineHeight:
        (lineHeight) =>
        ({ editor, commands }) => {
          const type = editor.isActive("heading") ? "heading" : "paragraph";
          return commands.updateAttributes(type, { lineHeight });
        },
    };
  },
});
