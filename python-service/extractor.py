"""Extract structured fields from DOCX files and editor HTML.

DOCX is a ZIP of XML. Parsing is done with the standard library so this
runs on Windows/Python 3.14 without compiling lxml or python-docx.
"""

from __future__ import annotations

import base64
import io
import re
import zipfile
from typing import Any
from xml.etree import ElementTree as ET

from bs4 import BeautifulSoup

NS = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    "dc": "http://purl.org/dc/elements/1.1/",
    "cp": "http://schemas.openxmlformats.org/package/2006/metadata/core-properties",
    "dcterms": "http://purl.org/dc/terms/",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}

LABEL_PATTERNS = [
    ("name", re.compile(r"^(name|full\s*name|document\s*name|title)\s*[:\-]\s*(.+)$", re.I)),
    ("category", re.compile(r"^(category|type|classification|topic|subject)\s*[:\-]\s*(.+)$", re.I)),
    ("author", re.compile(r"^(author|writer|prepared\s*by|created\s*by)\s*[:\-]\s*(.+)$", re.I)),
    ("date", re.compile(r"^(date|created|issued)\s*[:\-]\s*(.+)$", re.I)),
]
KV_PATTERN = re.compile(r"^(.{2,40}?)\s*[:\-]\s*(.{1,200})$")
EMAIL_PATTERN = re.compile(r"[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}", re.I)
PHONE_PATTERN = re.compile(r"(?:\+?\d{1,3}[\s.\-]?)?(?:\(?\d{2,4}\)?[\s.\-]?)?\d{3,4}[\s.\-]?\d{3,4}")
DATE_PATTERN = re.compile(
    r"\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2})\b",
    re.I,
)


def _text(el: ET.Element | None) -> str:
    if el is None or el.text is None:
        return ""
    return el.text.strip()


def _qn(prefix: str, tag: str) -> str:
    return f"{{{NS[prefix]}}}{tag}"


def _unique(items: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for item in items:
        value = item.strip()
        if not value:
            continue
        key = value.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(value)
    return out


def _collect_key_values(texts: list[str]) -> dict[str, str]:
    found: dict[str, str] = {}
    for text in texts:
        for key, pattern in LABEL_PATTERNS:
            match = pattern.match(text)
            if match:
                found.setdefault(key, match.group(2).strip())
        kv = KV_PATTERN.match(text)
        if kv:
            label, value = kv.group(1).strip(), kv.group(2).strip()
            if 2 <= len(label) <= 40 and value:
                found.setdefault(label, value)
    return found


def _paragraph_text(paragraph: ET.Element) -> str:
    parts = [node.text for node in paragraph.iter(_qn("w", "t")) if node.text]
    return "".join(parts).strip()


def _heading_level(paragraph: ET.Element) -> int | None:
    style = paragraph.find(f".//{_qn('w', 'pStyle')}")
    if style is None:
        return None
    val = style.get(_qn("w", "val")) or ""
    match = re.match(r"(?:Heading|heading|TITLE)(\d+)$", val)
    if match:
        return int(match.group(1))
    if val.lower() in {"title", "heading"}:
        return 1
    return None


def _table_rows(table: ET.Element) -> list[list[str]]:
    rows: list[list[str]] = []
    for row in table.findall(_qn("w", "tr")):
        cells = []
        for cell in row.findall(_qn("w", "tc")):
            text = " ".join(_paragraph_text(p) for p in cell.findall(_qn("w", "p"))).strip()
            cells.append(text)
        if cells:
            rows.append(cells)
    return rows


def _core_properties(zf: zipfile.ZipFile) -> dict[str, str | None]:
    if "docProps/core.xml" not in zf.namelist():
        return {}
    root = ET.parse(io.BytesIO(zf.read("docProps/core.xml"))).getroot()
    created = root.find("dcterms:created", NS)
    modified = root.find("dcterms:modified", NS)
    return {
        "title": _text(root.find("dc:title", NS)),
        "subject": _text(root.find("dc:subject", NS)),
        "author": _text(root.find("dc:creator", NS)),
        "keywords": _text(root.find("cp:keywords", NS)),
        "category": _text(root.find("cp:category", NS)),
        "last_modified_by": _text(root.find("cp:lastModifiedBy", NS)),
        "created": (created.text if created is not None else None),
        "modified": (modified.text if modified is not None else None),
    }


def _extract_images_from_zip(zf: zipfile.ZipFile) -> list[dict[str, Any]]:
    images: list[dict[str, Any]] = []
    for name in zf.namelist():
        lower = name.lower()
        if not lower.startswith("word/media/"):
            continue
        if not lower.endswith((".png", ".jpg", ".jpeg", ".gif", ".bmp", ".tif", ".tiff", ".webp", ".emf", ".wmf")):
            continue
        blob = zf.read(name)
        ext = name.rsplit(".", 1)[-1].lower().replace("jpg", "jpeg")
        content_type = f"image/{ext}" if ext not in {"emf", "wmf"} else "application/octet-stream"
        images.append(
            {
                "name": name.split("/")[-1],
                "content_type": content_type,
                "width": None,
                "height": None,
                "size_bytes": len(blob),
                "data": base64.b64encode(blob).decode("ascii"),
            }
        )
    return images


def extract_from_docx(file_bytes: bytes, filename: str = "document.docx") -> dict[str, Any]:
    try:
        zf = zipfile.ZipFile(io.BytesIO(file_bytes))
    except zipfile.BadZipFile as exc:
        raise ValueError("File is not a valid .docx (ZIP) package.") from exc

    props = _core_properties(zf)
    headings: list[dict[str, Any]] = []
    paragraphs: list[str] = []
    tables: list[list[list[str]]] = []

    if "word/document.xml" in zf.namelist():
        body = ET.parse(io.BytesIO(zf.read("word/document.xml"))).getroot().find("w:body", NS)
        if body is not None:
            for child in list(body):
                tag = child.tag
                if tag == _qn("w", "p"):
                    text = _paragraph_text(child)
                    if not text:
                        continue
                    level = _heading_level(child)
                    if level:
                        headings.append({"level": level, "text": text})
                    paragraphs.append(text)
                elif tag == _qn("w", "tbl"):
                    rows = _table_rows(child)
                    if rows:
                        tables.append(rows)

    full_text = "\n".join(paragraphs)
    key_values = _collect_key_values(paragraphs)
    name = (
        key_values.get("name")
        or props.get("title")
        or (headings[0]["text"] if headings else None)
        or filename.rsplit(".", 1)[0]
    )
    category = (
        key_values.get("category")
        or props.get("category")
        or props.get("subject")
        or (headings[0]["text"] if headings else None)
    )

    return {
        "source": "docx",
        "filename": filename,
        "name": name,
        "title": props.get("title") or name,
        "category": category,
        "author": key_values.get("author") or props.get("author"),
        "last_modified_by": props.get("last_modified_by"),
        "subject": props.get("subject"),
        "keywords": props.get("keywords"),
        "created": props.get("created"),
        "modified": props.get("modified"),
        "headings": headings,
        "paragraphs": paragraphs,
        "tables": tables,
        "images": _extract_images_from_zip(zf),
        "key_values": key_values,
        "emails": _unique(EMAIL_PATTERN.findall(full_text)),
        "phones": _unique([p for p in PHONE_PATTERN.findall(full_text) if len(re.sub(r"\D", "", p)) >= 7]),
        "dates": _unique(DATE_PATTERN.findall(full_text)),
        "word_count": len(re.findall(r"\b\w+\b", full_text)),
        "character_count": len(full_text),
    }


def _extract_images_from_html(soup: BeautifulSoup) -> list[dict[str, Any]]:
    images: list[dict[str, Any]] = []
    for index, img in enumerate(soup.find_all("img"), start=1):
        src = img.get("src") or ""
        alt = img.get("alt") or f"image-{index}"
        data = None
        content_type = "image/png"
        if src.startswith("data:"):
            header, _, b64 = src.partition(",")
            content_type = header.replace("data:", "").split(";")[0] or "image/png"
            data = b64
        images.append(
            {
                "name": alt,
                "content_type": content_type,
                "width": None,
                "height": None,
                "size_bytes": None,
                "src": src if not src.startswith("data:") else None,
                "data": data,
            }
        )
    return images


def extract_from_html(html: str, filename: str = "document") -> dict[str, Any]:
    soup = BeautifulSoup(html or "", "html.parser")
    for tag in soup(["script", "style"]):
        tag.decompose()

    headings: list[dict[str, Any]] = []
    for level in range(1, 7):
        for node in soup.find_all(f"h{level}"):
            text = node.get_text(" ", strip=True)
            if text:
                headings.append({"level": level, "text": text})

    paragraphs = [p.get_text(" ", strip=True) for p in soup.find_all("p") if p.get_text(strip=True)]
    if not paragraphs:
        text = soup.get_text("\n", strip=True)
        paragraphs = [line.strip() for line in text.splitlines() if line.strip()]

    tables: list[list[list[str]]] = []
    for table in soup.find_all("table"):
        rows: list[list[str]] = []
        for tr in table.find_all("tr"):
            cells = [cell.get_text(" ", strip=True) for cell in tr.find_all(["th", "td"])]
            if cells:
                rows.append(cells)
        if rows:
            tables.append(rows)

    full_text = "\n".join(paragraphs)
    key_values = _collect_key_values(paragraphs)
    name = key_values.get("name") or (headings[0]["text"] if headings else None) or filename
    category = key_values.get("category") or (headings[0]["text"] if headings else None)

    return {
        "source": "html",
        "filename": filename,
        "name": name,
        "title": name,
        "category": category,
        "author": key_values.get("author"),
        "last_modified_by": None,
        "subject": None,
        "keywords": None,
        "created": None,
        "modified": None,
        "headings": headings,
        "paragraphs": paragraphs,
        "tables": tables,
        "images": _extract_images_from_html(soup),
        "key_values": key_values,
        "emails": _unique(EMAIL_PATTERN.findall(full_text)),
        "phones": _unique([p for p in PHONE_PATTERN.findall(full_text) if len(re.sub(r"\D", "", p)) >= 7]),
        "dates": _unique(DATE_PATTERN.findall(full_text)),
        "word_count": len(re.findall(r"\b\w+\b", full_text)),
        "character_count": len(full_text),
    }


def merge_extractions(docx_data: dict[str, Any] | None, html_data: dict[str, Any] | None) -> dict[str, Any]:
    if docx_data and not html_data:
        return docx_data
    if html_data and not docx_data:
        return html_data
    if not docx_data and not html_data:
        return extract_from_html("")

    merged = dict(html_data)
    for key in ("name", "title", "category", "author", "subject", "keywords", "created", "modified", "last_modified_by"):
        merged[key] = docx_data.get(key) or merged.get(key)
    if docx_data.get("images"):
        merged["images"] = docx_data["images"]
    if docx_data.get("tables") and not merged.get("tables"):
        merged["tables"] = docx_data["tables"]
    if docx_data.get("headings") and not merged.get("headings"):
        merged["headings"] = docx_data["headings"]
    merged["key_values"] = {**html_data.get("key_values", {}), **docx_data.get("key_values", {})}
    merged["source"] = "docx+html"
    merged["filename"] = docx_data.get("filename") or html_data.get("filename")
    return merged
