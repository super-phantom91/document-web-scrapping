"""Shared field-fill logic used for DOCX and editor HTML."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from extractors.field_patterns import (
    BLOCK_FIELDS,
    KNOWN_FIELDS,
    clean_value,
    extract_contacts,
    is_compact_script,
    is_mostly_empty,
    is_untitled_filename,
    is_weak_heading,
    longest_paragraph,
    looks_like_field_line,
    looks_like_label,
    match_canonical_field,
    normalize_label,
    parse_all_labeled_fields,
    parse_label_only,
    strip_list_prefix,
    value_quality,
)


def apply_field(target: dict[str, Any], key: str, value: str) -> None:
    value = value.strip() if key in {"summary", "description"} else clean_value(value)
    if not value:
        return
    quality = value_quality(key, value)
    if not quality:
        return
    scores = target.setdefault("_quality", {})
    if key in KNOWN_FIELDS:
        current = target.get(key)
        if is_mostly_empty(current) or quality >= scores.get(key, 0) + 4:
            target[key] = value
            scores[key] = quality
        elif key in {"summary", "description"} and value not in str(current):
            target[key] = f"{current}\n\n{value}".strip()
            scores[key] = max(scores.get(key, 0), quality)
        return
    extra = target.setdefault("extra", {})
    extra_key = normalize_label(key)
    if extra_key not in extra:
        extra[extra_key] = value


def _apply_cell_pair(result: dict[str, Any], left: str, right: str) -> bool:
    if not left or not right:
        return False
    canonical = match_canonical_field(left)
    if canonical:
        apply_field(result, canonical, right)
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

    pending: str | None = None
    for cells in rows:
        cells = [c.strip() for c in cells]
        if not cells:
            continue

        nonempty = [c for c in cells if c]
        if pending and nonempty and not match_canonical_field(nonempty[0]) and not parse_label_only(nonempty[0], extra=True):
            apply_field(result, pending, " ".join(nonempty))
            pending = None
            continue

        if len(nonempty) == 1 and "\n" in nonempty[0]:
            first, _, rest = nonempty[0].partition("\n")
            if _apply_cell_pair(result, first.strip(), rest.strip()):
                pending = None
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
            pending = None
            continue

        for cell in nonempty:
            fields = parse_all_labeled_fields(cell)
            if fields:
                for key, value in fields:
                    apply_field(result, key, value)
                pending = None
                continue
            label = parse_label_only(cell, extra=True)
            if label:
                pending = label


def _consume_line(text: str, result: dict[str, Any], pending_field: str | None) -> str | None:
    text = strip_list_prefix(text)
    fields = parse_all_labeled_fields(text)
    if fields:
        for key, value in fields:
            apply_field(result, key, value)
        return None

    label = parse_label_only(text, extra=True)
    if label:
        return label

    if pending_field:
        apply_field(result, pending_field, text)
        if pending_field in BLOCK_FIELDS:
            return pending_field
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

        if kind == "heading" and "_heading_name" not in result:
            heading = strip_list_prefix(text.split("\n", 1)[0])
            if heading and not match_canonical_field(heading) and not is_weak_heading(heading):
                result["_heading_name"] = heading

    if collect_paragraphs:
        result["_paragraphs"] = paragraphs


def guess_name_from_filename(filename: str) -> str | None:
    stem = Path(filename).stem
    cleaned = re.sub(r"[_\-]+", " ", stem).strip()
    if not cleaned or is_untitled_filename(cleaned):
        return None
    return cleaned


def fill_from_full_text(result: dict[str, Any], text: str) -> None:
    for key, value in parse_all_labeled_fields(text or ""):
        apply_field(result, key, value)
    blobs = [text or ""]
    extra = result.get("extra") or {}
    if extra:
        blobs.append(" ".join(str(value) for value in extra.values()))
    contacts = extract_contacts("\n".join(blobs))
    result["emails"] = contacts["emails"]
    result["phones"] = contacts["phones"]
    result["dates"] = contacts["dates"]
    if contacts["emails"]:
        extra = result.setdefault("extra", {})
        extra.setdefault("email", contacts["emails"][0])


def fill_heuristics(result: dict[str, Any], filename: str, *, fallback_name: str | None = None) -> None:
    paragraphs: list[str] = result.pop("_paragraphs", [])
    heading_name = result.pop("_heading_name", None)
    prose = [
        p
        for p in paragraphs
        if not looks_like_field_line(p) and not match_canonical_field(strip_list_prefix(p))
    ]
    compact = any(is_compact_script(p) for p in prose) or is_compact_script(heading_name or "")
    summary_min = 12 if compact else 40
    description_min = 24 if compact else 80
    leftover_min = 8 if compact else 20

    if is_mostly_empty(result.get("name")):
        result["name"] = heading_name or fallback_name or guess_name_from_filename(filename)

    if is_mostly_empty(result.get("summary")):
        mid = [p for p in prose if summary_min <= len(p) <= 400]
        result["summary"] = mid[0] if mid else longest_paragraph(prose, min_length=summary_min)

    if is_mostly_empty(result.get("description")):
        long_text = longest_paragraph(prose, min_length=description_min)
        if long_text and long_text != result.get("summary"):
            result["description"] = long_text
        elif len(prose) > 1:
            used = {result.get("name"), result.get("summary")}
            leftovers = [p for p in prose if p not in used and len(p) > leftover_min]
            if leftovers:
                result["description"] = "\n\n".join(leftovers[:5])
    result.pop("_quality", None)
