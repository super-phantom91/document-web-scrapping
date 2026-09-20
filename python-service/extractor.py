"""Public extraction API used by the FastAPI service."""

from __future__ import annotations

from typing import Any

from extractors.docx_extractor import extract_docx_bytes
from extractors.field_patterns import is_mostly_empty, value_quality
from extractors.html_extractor import extract_html

KNOWN = ("name", "category", "summary", "description", "author", "tags")


def _pick_field(key: str, left: Any, right: Any) -> Any:
    if is_mostly_empty(left):
        return right
    if is_mostly_empty(right):
        return left
    left_text, right_text = str(left), str(right)
    left_q, right_q = value_quality(key, left_text), value_quality(key, right_text)
    if key in {"summary", "description"} and right_q >= left_q and len(right_text) > len(left_text) + 20:
        return right
    return left if left_q >= right_q else right


def extract_from_docx(file_bytes: bytes, filename: str = "document.docx") -> dict[str, Any]:
    return extract_docx_bytes(file_bytes, filename)


def extract_from_html(html: str, filename: str = "document") -> dict[str, Any]:
    return extract_html(html, filename)


def merge_extractions(docx_data: dict[str, Any] | None, html_data: dict[str, Any] | None) -> dict[str, Any]:
    if docx_data and not html_data:
        return docx_data
    if html_data and not docx_data:
        return html_data
    if not docx_data and not html_data:
        return extract_from_html("")

    merged = dict(html_data)
    for key in KNOWN:
        merged[key] = _pick_field(key, docx_data.get(key), html_data.get(key))
    for key in ("title", "subject", "keywords", "created", "modified", "last_modified_by"):
        merged[key] = docx_data.get(key) or merged.get(key)
    if docx_data.get("images"):
        merged["images"] = docx_data["images"]
    if docx_data.get("tables") and not merged.get("tables"):
        merged["tables"] = docx_data["tables"]
    if docx_data.get("headings") and not merged.get("headings"):
        merged["headings"] = docx_data["headings"]
    merged["extra"] = {**(html_data.get("extra") or {}), **(docx_data.get("extra") or {})}
    merged["key_values"] = {**(html_data.get("key_values") or {}), **(docx_data.get("key_values") or {})}
    for key in ("emails", "phones", "dates"):
        merged[key] = list(dict.fromkeys((docx_data.get(key) or []) + (html_data.get(key) or [])))
    merged["source"] = "docx+html"
    merged["filename"] = docx_data.get("filename") or html_data.get("filename")
    return merged


def scrap_document(
    *,
    html: str | None = None,
    docx_bytes: bytes | None = None,
    filename: str = "document",
) -> dict[str, Any]:
    """Scrap a Word file, editor HTML, or both."""
    docx_data = extract_from_docx(docx_bytes, filename) if docx_bytes else None
    html_data = extract_from_html(html, filename) if html else None
    return merge_extractions(docx_data, html_data)
