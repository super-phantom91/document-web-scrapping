"""Apply the same field strategies to collaborative editor HTML."""

from __future__ import annotations

import re
from typing import Any

from bs4 import BeautifulSoup

from extractors.logic import consume_text_blocks, fill_heuristics


def extract_html(html: str, filename: str = "document") -> dict[str, Any]:
    soup = BeautifulSoup(html or "", "html.parser")
    for tag in soup(["script", "style"]):
        tag.decompose()

    blocks: list[tuple[str, Any]] = []
    headings: list[dict[str, Any]] = []
    tables: list[list[list[str]]] = []

    body = soup.body or soup
    for node in body.find_all(["h1", "h2", "h3", "h4", "h5", "h6", "p", "table"]):
        if node.name == "p" and node.find_parent("table"):
            continue
        if node.name in {"h1", "h2", "h3", "h4", "h5", "h6"}:
            text = node.get_text(" ", strip=True)
            if text:
                level = int(node.name[1])
                headings.append({"level": level, "text": text})
                blocks.append(("heading", text))
        elif node.name == "p":
            text = node.get_text(" ", strip=True)
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

    paragraphs = [payload for kind, payload in blocks if kind in {"p", "heading"}]
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
