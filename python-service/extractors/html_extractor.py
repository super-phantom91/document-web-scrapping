"""Apply the same field strategies to collaborative editor HTML."""

from __future__ import annotations

import re
from typing import Any

from bs4 import BeautifulSoup

from extractors.field_patterns import looks_like_label, match_canonical_field
from extractors.logic import consume_text_blocks, fill_from_full_text, fill_heuristics


def _html_block_text(node) -> str:
    first = None
    for child in node.children:
        name = getattr(child, "name", None)
        if name in {"strong", "b"}:
            first = child
            break
        if name == "span":
            style = (child.get("style") or "").lower()
            if "bold" in style or "font-weight:700" in style.replace(" ", "") or "font-weight:bold" in style.replace(" ", ""):
                first = child
                break
        if isinstance(child, str) and child.strip():
            break
        if name == "br":
            continue
    raw = node.get_text("\n", strip=True)
    if first is None:
        return raw
    label = first.get_text(" ", strip=True).rstrip(":-–—=")
    rest: list[str] = []
    seen = False
    for child in node.children:
        if child is first:
            seen = True
            continue
        if not seen:
            continue
        piece = child.get_text(" ", strip=True) if getattr(child, "get_text", None) else str(child).strip()
        if piece:
            rest.append(piece)
    value = " ".join(rest).strip()
    if label and value and (match_canonical_field(label) or looks_like_label(label)):
        return f"{label}: {value}"
    return raw


def extract_html(html: str, filename: str = "document") -> dict[str, Any]:
    soup = BeautifulSoup(html or "", "html.parser")
    for tag in soup(["script", "style"]):
        tag.decompose()

    blocks: list[tuple[str, Any]] = []
    headings: list[dict[str, Any]] = []
    tables: list[list[list[str]]] = []

    body = soup.body or soup
    for node in body.find_all(["h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "dt", "dd", "blockquote", "table"]):
        if node.find_parent("table") and node.name != "table":
            continue
        if node.name in {"h1", "h2", "h3", "h4", "h5", "h6"}:
            text = _html_block_text(node)
            if text:
                level = int(node.name[1])
                headings.append({"level": level, "text": text.split("\n", 1)[0]})
                blocks.append(("heading", text))
        elif node.name in {"p", "li", "dt", "dd", "blockquote"}:
            text = _html_block_text(node)
            if text:
                blocks.append(("p", text))
        elif node.name == "table":
            rows: list[list[str]] = []
            for tr in node.find_all("tr"):
                cells = [cell.get_text(" ", strip=True) for cell in tr.find_all(["th", "td"])]
                if cells:
                    rows.append(cells)
            if rows:
                tables.append(rows)
                blocks.append(("table", rows))

    if not blocks:
        text = soup.get_text("\n", strip=True)
        for line in text.splitlines():
            if line.strip():
                blocks.append(("p", line.strip()))

    parsed: dict[str, Any] = {"extra": {}}
    consume_text_blocks(blocks, parsed)
    paragraphs = [payload for kind, payload in blocks if kind in {"p", "heading"}]
    table_lines = [" | ".join(cell for cell in row if cell) for table in tables for row in table]
    fill_from_full_text(parsed, "\n".join(paragraphs + table_lines))
    fill_heuristics(parsed, filename)

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

    full_text = "\n".join(paragraphs)
    parsed.update(
        {
            "source": "html",
            "filename": filename,
            "title": parsed.get("name"),
            "subject": None,
            "keywords": parsed.get("tags"),
            "last_modified_by": None,
            "created": None,
            "modified": None,
            "headings": headings,
            "paragraphs": paragraphs,
            "tables": tables,
            "images": images,
            "key_values": {
                **(parsed.get("extra") or {}),
                **{k: parsed[k] for k in ("name", "category", "summary", "description", "author", "tags") if parsed.get(k)},
            },
            "word_count": len(re.findall(r"\b\w+\b", full_text)),
            "character_count": len(full_text),
        }
    )
    return parsed
