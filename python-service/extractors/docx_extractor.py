"""Extract structured fields and images from irregular .docx files.

Same strategies as https://github.com/super-phantom91/document-scrapping
(inline labels, label-then-value blocks, tables), implemented with the
standard library so it runs on Python 3.14 without compiling lxml.
"""

from __future__ import annotations

import base64
import io
import re
import zipfile
from typing import Any
from xml.etree import ElementTree as ET

from extractors.logic import consume_text_blocks, fill_heuristics

NS = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    "dc": "http://purl.org/dc/elements/1.1/",
    "cp": "http://schemas.openxmlformats.org/package/2006/metadata/core-properties",
    "dcterms": "http://purl.org/dc/terms/",
}


def _qn(prefix: str, tag: str) -> str:
    return f"{{{NS[prefix]}}}{tag}"


def _text(el: ET.Element | None) -> str:
    if el is None or el.text is None:
        return ""
    return el.text.strip()


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
        "created": created.text if created is not None else None,
        "modified": modified.text if modified is not None else None,
    }


def _extract_images(zf: zipfile.ZipFile) -> list[dict[str, Any]]:
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


def extract_docx_bytes(file_bytes: bytes, filename: str = "document.docx") -> dict[str, Any]:
    try:
        zf = zipfile.ZipFile(io.BytesIO(file_bytes))
    except zipfile.BadZipFile as exc:
        raise ValueError("File is not a valid .docx (ZIP) package.") from exc

    props = _core_properties(zf)
    headings: list[dict[str, Any]] = []
    tables: list[list[list[str]]] = []
    blocks: list[tuple[str, Any]] = []

    if "word/document.xml" in zf.namelist():
        body = ET.parse(io.BytesIO(zf.read("word/document.xml"))).getroot().find("w:body", NS)
        if body is not None:
            for child in list(body):
                if child.tag == _qn("w", "p"):
                    text = _paragraph_text(child)
                    if not text:
                        continue
                    level = _heading_level(child)
                    if level:
                        headings.append({"level": level, "text": text})
                        blocks.append(("heading", text))
                    else:
                        blocks.append(("p", text))
                elif child.tag == _qn("w", "tbl"):
                    rows = _table_rows(child)
                    if rows:
                        tables.append(rows)
                        blocks.append(("table", rows))

    parsed: dict[str, Any] = {"extra": {}}
    consume_text_blocks(blocks, parsed)
    fill_heuristics(parsed, filename)

    if not parsed.get("author") and props.get("author"):
        parsed["author"] = props["author"]
    if not parsed.get("category") and (props.get("category") or props.get("subject")):
        parsed["category"] = props.get("category") or props.get("subject")
    if not parsed.get("tags") and props.get("keywords"):
        parsed["tags"] = props["keywords"]
    if not parsed.get("name") and props.get("title"):
        parsed["name"] = props["title"]

    paragraphs = [payload for kind, payload in blocks if kind in {"p", "heading"}]
    full_text = "\n".join(paragraphs)

    parsed.update(
        {
            "source": "docx",
            "filename": filename,
            "title": parsed.get("name") or props.get("title"),
            "subject": props.get("subject"),
            "keywords": parsed.get("tags") or props.get("keywords"),
            "last_modified_by": props.get("last_modified_by"),
            "created": props.get("created"),
            "modified": props.get("modified"),
            "headings": headings,
            "paragraphs": paragraphs,
            "tables": tables,
            "images": _extract_images(zf),
            "key_values": {**(parsed.get("extra") or {}), **{k: parsed[k] for k in ("name", "category", "summary", "description", "author", "tags") if parsed.get(k)}},
            "word_count": len(re.findall(r"\b\w+\b", full_text)),
            "character_count": len(full_text),
        }
    )
    return parsed
