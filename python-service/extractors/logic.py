"""Shared field-fill logic used for DOCX and editor HTML."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from extractors.field_patterns import (
    KNOWN_FIELDS,
    is_mostly_empty,
    longest_paragraph,
    match_canonical_field,
    parse_extra_inline,
    parse_inline_field,
    parse_label_only,
)


def apply_field(target: dict[str, Any], key: str, value: str) -> None:
    value = value.strip()
    if not value:
        return
    if key in KNOWN_FIELDS:
        if is_mostly_empty(target.get(key)):
            target[key] = value
        elif key in {"summary", "description"} and value not in str(target.get(key)):
            target[key] = f"{target[key]}\n\n{value}".strip()
        return
    extra = target.setdefault("extra", {})
    if key not in extra:
        extra[key] = value


def extract_from_table_cells(rows: list[list[str]], result: dict[str, Any]) -> None:
    for cells in rows:
        cells = [c.strip() for c in cells]
        if not cells:
            continue
        if len(cells) >= 2 and cells[0] and cells[1]:
            canonical = match_canonical_field(cells[0])
            if canonical:
                apply_field(result, canonical, cells[1])
                continue
            inline = parse_inline_field(f"{cells[0]}: {cells[1]}")
            if inline:
                apply_field(result, inline[0], inline[1])
                continue
            apply_field(result, cells[0], cells[1])
            continue
        if len(cells) == 1 and cells[0]:
            inline = parse_inline_field(cells[0])
            if inline:
                apply_field(result, inline[0], inline[1])


def consume_text_blocks(blocks: list[tuple[str, Any]], result: dict[str, Any]) -> None:
    """blocks: ('p', text) or ('heading', text) or ('table', rows)."""
    pending_field: str | None = None
    paragraphs: list[str] = []

    for kind, payload in blocks:
        if kind == "table":
            extract_from_table_cells(payload, result)
            pending_field = None
            continue

        text = str(payload).strip()
        if not text:
            continue
        paragraphs.append(text)

        inline = parse_inline_field(text)
        if inline:
            apply_field(result, inline[0], inline[1])
            pending_field = None
            continue

        extra_inline = parse_extra_inline(text)
        if extra_inline:
            apply_field(result, extra_inline[0], extra_inline[1])
            pending_field = None
            continue

        label = parse_label_only(text)
        if label:
            pending_field = label
            continue

        if pending_field:
            apply_field(result, pending_field, text)
            pending_field = None
            continue

        if kind == "heading" and "_heading_name" not in result and not match_canonical_field(text):
            result["_heading_name"] = text

    result["_paragraphs"] = paragraphs


def guess_name_from_filename(filename: str) -> str:
    stem = Path(filename).stem
    cleaned = re.sub(r"[_\-]+", " ", stem).strip()
    return cleaned or stem


def fill_heuristics(result: dict[str, Any], filename: str) -> None:
    paragraphs: list[str] = result.pop("_paragraphs", [])
    heading_name = result.pop("_heading_name", None)

    if is_mostly_empty(result.get("name")):
        result["name"] = heading_name or guess_name_from_filename(filename)

    if is_mostly_empty(result.get("summary")):
        mid = [p for p in paragraphs if 40 <= len(p) <= 400]
        result["summary"] = mid[0] if mid else longest_paragraph(paragraphs)

    if is_mostly_empty(result.get("description")):
        long_text = longest_paragraph(paragraphs, min_length=80)
        if long_text and long_text != result.get("summary"):
            result["description"] = long_text
        elif len(paragraphs) > 1:
            used = {result.get("name"), result.get("summary")}
            leftovers = [p for p in paragraphs if p not in used and len(p) > 20]
            if leftovers:
                result["description"] = "\n\n".join(leftovers[:5])
