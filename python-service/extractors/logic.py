"""Shared field-fill logic used for DOCX and editor HTML."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from extractors.field_patterns import (
    KNOWN_FIELDS,
    extract_contacts,
    is_mostly_empty,
    longest_paragraph,
    looks_like_label,
    match_canonical_field,
    normalize_label,
    parse_all_labeled_fields,
    parse_extra_inline,
    parse_inline_field,
    parse_label_only,
)


def apply_field(target: dict[str, Any], key: str, value: str) -> None:
    value = re.sub(r"\s+", " ", value).strip() if key not in {"summary", "description"} else value.strip()
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


def _apply_cell_pair(result: dict[str, Any], left: str, right: str) -> bool:
    if not left or not right:
        return False
    canonical = match_canonical_field(left)
    if canonical:
        apply_field(result, canonical, right)
        return True
    inline = parse_inline_field(f"{left}: {right}")
    if inline:
        apply_field(result, inline[0], inline[1])
        return True
    labeled = parse_all_labeled_fields(f"{left}: {right}")
    if labeled:
        for key, value in labeled:
            apply_field(result, key, value)
        return True
    if looks_like_label(left):
        apply_field(result, normalize_label(left), right)
        return True
    return False


def _extract_header_row_table(rows: list[list[str]], result: dict[str, Any]) -> bool:
    if len(rows) < 2 or len(rows[0]) < 2:
        return False
    headers = [c.strip() for c in rows[0]]
    col0_known = sum(1 for row in rows if row and match_canonical_field(row[0]))
    if col0_known >= 2:
        return False
    mapped = [match_canonical_field(h) or (normalize_label(h) if looks_like_label(h) else None) for h in headers]
    known_count = sum(1 for item in mapped if item in KNOWN_FIELDS)
    if known_count < 1:
        return False
    label_count = sum(1 for item in mapped if item)
    if label_count < 2 and known_count < 2:
        return False
    for row in rows[1:]:
        for key, raw in zip(mapped, row):
            if key and str(raw).strip():
                apply_field(result, key, str(raw).strip())
    return True


def extract_from_table_cells(rows: list[list[str]], result: dict[str, Any]) -> None:
    if _extract_header_row_table(rows, result):
        return

    for cells in rows:
        cells = [c.strip() for c in cells]
        if not cells:
            continue

        i = 0
        paired = False
        while i < len(cells) - 1:
            if _apply_cell_pair(result, cells[i], cells[i + 1]):
                paired = True
                i += 2
                continue
            i += 1
        if paired:
            continue

        for cell in cells:
            if not cell:
                continue
            fields = parse_all_labeled_fields(cell)
            if fields:
                for key, value in fields:
                    apply_field(result, key, value)
                continue
            inline = parse_inline_field(cell)
            if inline:
                apply_field(result, inline[0], inline[1])
                continue
            extra_inline = parse_extra_inline(cell)
            if extra_inline:
                apply_field(result, extra_inline[0], extra_inline[1])


def _consume_line(text: str, result: dict[str, Any], pending_field: str | None) -> str | None:
    fields = parse_all_labeled_fields(text)
    if len(fields) > 1 or (len(fields) == 1 and (parse_inline_field(text) or parse_extra_inline(text) or ":" in text or "\t" in text)):
        for key, value in fields:
            apply_field(result, key, value)
        return None

    inline = parse_inline_field(text)
    if inline:
        apply_field(result, inline[0], inline[1])
        return None

    extra_inline = parse_extra_inline(text)
    if extra_inline:
        apply_field(result, extra_inline[0], extra_inline[1])
        return None

    label = parse_label_only(text, extra=True)
    if label:
        return label

    if pending_field:
        apply_field(result, pending_field, text)
        return None

    return pending_field


def consume_text_blocks(
    blocks: list[tuple[str, Any]],
    result: dict[str, Any],
    *,
    collect_paragraphs: bool = True,
) -> None:
    """blocks: ('p'|'heading', text), ('table', rows), or ('sdt', (label, value))."""
    pending_field: str | None = None
    paragraphs: list[str] = result.setdefault("_paragraphs", [])

    for kind, payload in blocks:
        if kind == "table":
            extract_from_table_cells(payload, result)
            pending_field = None
            continue

        if kind == "sdt":
            label, value = payload
            key = match_canonical_field(str(label)) or normalize_label(str(label))
            apply_field(result, key, str(value))
            pending_field = None
            continue

        text = str(payload).strip()
        if not text:
            continue
        if collect_paragraphs:
            paragraphs.append(text)

        lines = [part.strip() for part in re.split(r"[\r\n]+", text) if part.strip()]
        if not lines:
            continue

        for line in lines:
            pending_field = _consume_line(line, result, pending_field)

        if kind == "heading" and "_heading_name" not in result and not match_canonical_field(text):
            result["_heading_name"] = text.split("\n", 1)[0].strip()

    if collect_paragraphs:
        result["_paragraphs"] = paragraphs


def guess_name_from_filename(filename: str) -> str:
    stem = Path(filename).stem
    cleaned = re.sub(r"[_\-]+", " ", stem).strip()
    return cleaned or stem


def fill_from_full_text(result: dict[str, Any], text: str) -> None:
    for key, value in parse_all_labeled_fields(text or ""):
        apply_field(result, key, value)
    contacts = extract_contacts(text or "")
    result["emails"] = contacts["emails"]
    result["phones"] = contacts["phones"]
    result["dates"] = contacts["dates"]
    if contacts["emails"]:
        extra = result.setdefault("extra", {})
        extra.setdefault("email", contacts["emails"][0])


def fill_heuristics(result: dict[str, Any], filename: str, *, fallback_name: str | None = None) -> None:
    paragraphs: list[str] = result.pop("_paragraphs", [])
    heading_name = result.pop("_heading_name", None)

    if is_mostly_empty(result.get("name")):
        result["name"] = heading_name or fallback_name or guess_name_from_filename(filename)

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
