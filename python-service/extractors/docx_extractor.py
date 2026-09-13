"""Extract structured fields and images from irregular .docx files.

Walks paragraphs, tables, content controls, text boxes, headers, and
footers so mixed Word layouts still yield name, category, and related fields.
Uses the standard library so it runs on Python 3.14 without compiling lxml.
"""

from __future__ import annotations

import base64
import io
import re
import zipfile
from typing import Any, Iterator
from xml.etree import ElementTree as ET

from extractors.field_patterns import looks_like_label, match_canonical_field
from extractors.logic import apply_field, consume_text_blocks, fill_from_full_text, fill_heuristics

NS = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    "dc": "http://purl.org/dc/elements/1.1/",
    "cp": "http://schemas.openxmlformats.org/package/2006/metadata/core-properties",
    "dcterms": "http://purl.org/dc/terms/",
}

W_P = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p"
W_TBL = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}tbl"
W_SDT = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}sdt"
W_SDT_CONTENT = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}sdtContent"
W_TXBX = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}txbxContent"
W_DEL = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}del"


def _qn(prefix: str, tag: str) -> str:
    return f"{{{NS[prefix]}}}{tag}"


def _text(el: ET.Element | None) -> str:
    if el is None or el.text is None:
        return ""
    return el.text.strip()


def _paragraph_text(paragraph: ET.Element) -> str:
    """Collect visible text, including tabs and line breaks, skipping nested tables/text boxes."""
    parts: list[str] = []

    def rec(node: ET.Element) -> None:
        tag = node.tag
        if node is not paragraph and tag in {W_TBL, W_TXBX}:
            return
        if tag == W_DEL:
            return
        if tag == _qn("w", "t") and node.text:
            parts.append(node.text)
        elif tag == _qn("w", "tab"):
            parts.append("\t")
        elif tag in {_qn("w", "br"), _qn("w", "cr")}:
            parts.append("\n")
        elif tag == _qn("w", "instrText"):
            return
        for child in list(node):
            rec(child)

    rec(paragraph)
    text = "".join(parts)
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n[ \t]+", "\n", text)
    text = text.strip()
    labeled = _labeled_line_from_runs(paragraph)
    return labeled or text


def _is_bold_run(run: ET.Element) -> bool:
    props = run.find(_qn("w", "rPr"))
    if props is None:
        return False
    bold = props.find(_qn("w", "b"))
    if bold is None:
        bold = props.find(_qn("w", "bCs"))
    if bold is not None:
        val = (bold.get(_qn("w", "val")) or "true").lower()
        if val not in {"0", "false", "off"}:
            return True
    underline = props.find(_qn("w", "u"))
    if underline is not None:
        val = (underline.get(_qn("w", "val")) or "single").lower()
        if val not in {"none", "0"}:
            return True
    style = props.find(_qn("w", "rStyle"))
    if style is not None:
        sid = (style.get(_qn("w", "val")) or "").lower()
        if sid in {"strong", "bold", "intenseemphasis", "emphasis"}:
            return True
    return False


def _labeled_line_from_runs(paragraph: ET.Element) -> str | None:
    """Turn a bold label + plain value (common in Word forms) into 'Label: value'."""
    runs: list[tuple[str, bool]] = []
    for run in paragraph.iter(_qn("w", "r")):
        text = "".join(node.text or "" for node in run.findall(_qn("w", "t")))
        if not text:
            continue
        runs.append((text, _is_bold_run(run)))
    if len(runs) < 2 or not runs[0][1]:
        return None
    index = 0
    label_parts: list[str] = []
    while index < len(runs) and runs[index][1]:
        label_parts.append(runs[index][0])
        index += 1
    if index == 0 or index == len(runs):
        return None
    label = "".join(label_parts).strip(" \t:-–—=")
    value = "".join(text for text, _ in runs[index:]).strip()
    if not label or not value:
        return None
    if match_canonical_field(label) or looks_like_label(label):
        return f"{label}: {value}"
    return None


def _heading_level(paragraph: ET.Element) -> int | None:
    style = paragraph.find(f".//{_qn('w', 'pStyle')}")
    if style is None:
        outline = paragraph.find(f".//{_qn('w', 'outlineLvl')}")
        if outline is not None:
            val = outline.get(_qn("w", "val"))
            if val is not None and val.isdigit():
                return int(val) + 1
        return None
    val = style.get(_qn("w", "val")) or ""
    match = re.match(r"(?:Heading|heading|TITLE)(\d+)$", val)
    if match:
        return int(match.group(1))
    if val.lower() in {"title", "heading", "titlechar"}:
        return 1
    if val.lower() in {"subtitle", "subtitle2"}:
        return 2
    return None


def _cell_text(cell: ET.Element) -> str:
    parts: list[str] = []
    for child in list(cell):
        if child.tag == W_P:
            text = _paragraph_text(child)
            if text:
                parts.append(text)
        elif child.tag == W_SDT:
            content = child.find(W_SDT_CONTENT)
            if content is not None:
                nested = _cell_text(content)
                if nested:
                    parts.append(nested)
        elif child.tag == W_TBL:
            continue
    return "\n".join(parts).strip()


def _table_rows(table: ET.Element) -> list[list[str]]:
    rows: list[list[str]] = []
    for row in table.findall(_qn("w", "tr")):
        cells = []
        for cell in row.findall(_qn("w", "tc")):
            cells.append(_cell_text(cell))
        if any(cells):
            rows.append(cells)
    return rows


def _iter_nested_tables(table: ET.Element) -> Iterator[ET.Element]:
    for row in table.findall(_qn("w", "tr")):
        for cell in row.findall(_qn("w", "tc")):
            for nested in cell.findall(W_TBL):
                yield nested
                yield from _iter_nested_tables(nested)


def _sdt_label(sdt: ET.Element) -> str | None:
    props = sdt.find(_qn("w", "sdtPr"))
    if props is None:
        return None
    for tag in ("tag", "alias"):
        el = props.find(_qn("w", tag))
        if el is not None:
            val = (el.get(_qn("w", "val")) or "").strip()
            if val:
                return val
    return None


def _sdt_value(sdt: ET.Element) -> str:
    content = sdt.find(W_SDT_CONTENT)
    if content is None:
        content = sdt
    parts = [_paragraph_text(p) for p in content.iter(W_P)]
    return "\n".join(p for p in parts if p).strip()


def _walk_blocks(parent: ET.Element) -> Iterator[tuple[str, Any]]:
    """Yield paragraphs, tables, and content-control fields in document order."""
    for child in list(parent):
        tag = child.tag
        if tag == W_P:
            yield ("p", child)
            for nested in child.iter():
                if nested is child:
                    continue
                if nested.tag == W_TXBX:
                    yield from _walk_blocks(nested)
                elif nested.tag == W_TBL:
                    yield ("table", nested)
                    for deeper in _iter_nested_tables(nested):
                        yield ("table", deeper)
        elif tag == W_TBL:
            yield ("table", child)
            for nested in _iter_nested_tables(child):
                yield ("table", nested)
        elif tag == W_SDT:
            label = _sdt_label(child)
            value = _sdt_value(child)
            if label and value:
                yield ("sdt", (label, value))
            content = child.find(W_SDT_CONTENT)
            if content is not None:
                yield from _walk_blocks(content)
            else:
                yield from _walk_blocks(child)
        elif list(child):
            yield from _walk_blocks(child)


def _load_style_map(zf: zipfile.ZipFile) -> dict[str, str]:
    if "word/styles.xml" not in zf.namelist():
        return {}
    root = _parse_xml(zf.read("word/styles.xml"))
    if root is None:
        return {}
    mapping: dict[str, str] = {}
    for style in root.iter(_qn("w", "style")):
        style_id = style.get(_qn("w", "styleId")) or ""
        name_el = style.find(_qn("w", "name"))
        name = (name_el.get(_qn("w", "val")) if name_el is not None else "") or style_id
        if style_id:
            mapping[style_id] = name
    return mapping


def _paragraph_style_field(paragraph: ET.Element, style_map: dict[str, str]) -> str | None:
    style = paragraph.find(f".//{_qn('w', 'pStyle')}")
    if style is None:
        return None
    style_id = style.get(_qn("w", "val")) or ""
    name = style_map.get(style_id, style_id)
    spaced = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", name).replace("_", " ")
    if re.match(r"(?i)heading\s*\d+$", spaced.strip()):
        return None
    return match_canonical_field(spaced)


def _custom_properties(zf: zipfile.ZipFile) -> dict[str, str]:
    if "docProps/custom.xml" not in zf.namelist():
        return {}
    root = _parse_xml(zf.read("docProps/custom.xml"))
    if root is None:
        return {}
    found: dict[str, str] = {}
    for prop in root:
        name = (prop.get("name") or "").strip()
        if not name:
            continue
        text = " ".join(prop.itertext()).strip()
        if text:
            found[name] = text
    return found


def _core_properties(zf: zipfile.ZipFile) -> dict[str, str | None]:
    if "docProps/core.xml" not in zf.namelist():
        return {}
    root = _parse_xml(zf.read("docProps/core.xml"))
    if root is None:
        return {}
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
    seen: set[str] = set()
    for name in zf.namelist():
        lower = name.lower()
        if not (lower.startswith("word/media/") or "/media/" in lower):
            continue
        if not lower.endswith((".png", ".jpg", ".jpeg", ".gif", ".bmp", ".tif", ".tiff", ".webp", ".emf", ".wmf")):
            continue
        blob = zf.read(name)
        digest = str(len(blob)) + ":" + name
        if digest in seen:
            continue
        seen.add(digest)
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


def _element_to_blocks(
    element: ET.Element,
    headings: list[dict[str, Any]],
    tables: list[list[list[str]]],
    *,
    collect_headings: bool,
    style_map: dict[str, str] | None = None,
) -> list[tuple[str, Any]]:
    style_map = style_map or {}
    blocks: list[tuple[str, Any]] = []
    seen_tables: set[int] = set()
    for kind, payload in _walk_blocks(element):
        if kind == "table":
            ident = id(payload)
            if ident in seen_tables:
                continue
            seen_tables.add(ident)
            rows = _table_rows(payload)
            if rows:
                tables.append(rows)
                blocks.append(("table", rows))
            continue
        if kind == "sdt":
            blocks.append(("sdt", payload))
            continue
        paragraph = payload
        text = _paragraph_text(paragraph)
        if not text:
            continue
        style_field = _paragraph_style_field(paragraph, style_map)
        if style_field and not match_canonical_field(text.split("\n", 1)[0]):
            blocks.append(("sdt", (style_field, text)))
        level = _heading_level(paragraph) if collect_headings else None
        if level:
            headings.append({"level": level, "text": text.split("\n", 1)[0]})
            blocks.append(("heading", text))
        else:
            blocks.append(("p", text))
    return blocks


def _parse_xml(data: bytes) -> ET.Element | None:
    for candidate in (data, _with_missing_namespaces(data)):
        try:
            return ET.fromstring(candidate)
        except ET.ParseError:
            continue
    return None


_COMMON_NS = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "v": "urn:schemas-microsoft-com:vml",
    "o": "urn:schemas-microsoft-com:office:office",
    "wp": "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "wps": "http://schemas.microsoft.com/office/word/2010/wordprocessingShape",
    "wpg": "http://schemas.microsoft.com/office/word/2010/wordprocessingGroup",
    "mc": "http://schemas.openxmlformats.org/markup-compatibility/2006",
    "m": "http://schemas.openxmlformats.org/officeDocument/2006/math",
    "w14": "http://schemas.microsoft.com/office/word/2010/wordml",
    "w15": "http://schemas.microsoft.com/office/word/2012/wordml",
    "dc": "http://purl.org/dc/elements/1.1/",
    "cp": "http://schemas.openxmlformats.org/package/2006/metadata/core-properties",
    "dcterms": "http://purl.org/dc/terms/",
}


def _with_missing_namespaces(data: bytes) -> bytes:
    text = data.decode("utf-8", errors="replace")
    used = set(re.findall(r"<(?:([A-Za-z0-9]+):)[A-Za-z]", text))
    decls: list[str] = []
    for prefix in sorted(used):
        if prefix == "xml":
            continue
        if re.search(rf"xmlns:{re.escape(prefix)}=", text):
            continue
        uri = _COMMON_NS.get(prefix, f"http://unknown/{prefix}")
        decls.append(f'xmlns:{prefix}="{uri}"')
    if not decls:
        return data
    extra = " ".join(decls)
    patched = re.sub(r"<([A-Za-z0-9]+:?[A-Za-z0-9]*)(\s|>|/)", rf"<\1 {extra}\2", text, count=1)
    return patched.encode("utf-8")


def _xml_root(zf: zipfile.ZipFile, name: str) -> ET.Element | None:
    try:
        return _parse_xml(zf.read(name))
    except KeyError:
        return None


def extract_docx_bytes(file_bytes: bytes, filename: str = "document.docx") -> dict[str, Any]:
    try:
        zf = zipfile.ZipFile(io.BytesIO(file_bytes))
    except zipfile.BadZipFile as exc:
        raise ValueError("File is not a valid .docx (ZIP) package.") from exc

    props = _core_properties(zf)
    style_map = _load_style_map(zf)
    headings: list[dict[str, Any]] = []
    tables: list[list[list[str]]] = []
    blocks: list[tuple[str, Any]] = []
    header_blocks: list[tuple[str, Any]] = []

    if "word/document.xml" in zf.namelist():
        root = _xml_root(zf, "word/document.xml")
        body = None if root is None else root.find("w:body", NS)
        if body is not None:
            blocks.extend(_element_to_blocks(body, headings, tables, collect_headings=True, style_map=style_map))

    for name in sorted(zf.namelist()):
        lower = name.replace("\\", "/").lower()
        if not lower.endswith(".xml"):
            continue
        if not any(part in lower for part in ("word/header", "word/footer", "word/footnotes", "word/endnotes")):
            continue
        root = _xml_root(zf, name)
        if root is None:
            continue
        header_blocks.extend(_element_to_blocks(root, headings, tables, collect_headings=False, style_map=style_map))

    parsed: dict[str, Any] = {"extra": {}}
    consume_text_blocks(blocks, parsed)
    if header_blocks:
        consume_text_blocks(header_blocks, parsed, collect_paragraphs=False)

    for label, value in _custom_properties(zf).items():
        key = match_canonical_field(label) or label
        apply_field(parsed, key, value)

    paragraphs = [payload for kind, payload in blocks if kind in {"p", "heading"}]
    table_lines: list[str] = []
    for table in tables:
        for row in table:
            table_lines.append(" | ".join(cell for cell in row if cell))
    full_text = "\n".join(paragraphs + table_lines)
    fill_from_full_text(parsed, full_text)

    if not parsed.get("author") and props.get("author"):
        parsed["author"] = props["author"]
    if not parsed.get("category") and (props.get("category") or props.get("subject")):
        parsed["category"] = props.get("category") or props.get("subject")
    if not parsed.get("tags") and props.get("keywords"):
        parsed["tags"] = props["keywords"]
    if not parsed.get("name") and props.get("title"):
        parsed["name"] = props["title"]

    fill_heuristics(parsed, filename, fallback_name=props.get("title"))

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
            "key_values": {
                **(parsed.get("extra") or {}),
                **{k: parsed[k] for k in ("name", "category", "summary", "description", "author", "tags") if parsed.get(k)},
            },
            "word_count": len(re.findall(r"\b\w+\b", full_text)),
            "character_count": len(full_text),
        }
    )
    return parsed
