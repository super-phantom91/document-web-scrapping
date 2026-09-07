import fs from "fs";

const PYTHON_URL = process.env.PYTHON_URL || "http://127.0.0.1:8000";

export async function extractDocument({ html, docxPath, filename }) {
  const form = new FormData();
  if (html) form.append("html", html);
  if (filename) form.append("filename", filename);
  if (docxPath && fs.existsSync(docxPath)) {
    const buf = fs.readFileSync(docxPath);
    form.append("file", new Blob([buf]), filename || "document.docx");
  }

  const response = await fetch(`${PYTHON_URL}/extract`, {
    method: "POST",
    body: form,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = Array.isArray(payload.detail) ? payload.detail[0]?.msg : payload.detail;
    throw new Error(detail || "Python extractor returned an error.");
  }
  return payload;
}
