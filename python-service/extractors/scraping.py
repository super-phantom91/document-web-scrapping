"""Scrap name, category, and other stored fields from document text."""

from __future__ import annotations

from typing import Any

from extractors.field_patterns import extract_contacts, parse_all_labeled_fields

NECESSARY_FIELDS = ("name", "category", "summary", "description", "author", "tags")


def scrap_fields_from_text(text: str) -> dict[str, Any]:
    """Pull labeled fields from plain text (Name:, Categoría:, 名称：, …)."""
    necessary: dict[str, str] = {}
    extra: dict[str, str] = {}
    blobs = [text or ""]
    blobs.extend(line.strip() for line in (text or "").splitlines() if line.strip())
    for blob in blobs:
        for key, value in parse_all_labeled_fields(blob):
            if key in NECESSARY_FIELDS:
                necessary.setdefault(key, value)
            else:
                extra.setdefault(key, value)
    contacts = extract_contacts(text or "")
    return {
        **{field: necessary.get(field) for field in NECESSARY_FIELDS},
        "extra": extra,
        **contacts,
    }


def necessary_information(data: dict[str, Any] | None) -> dict[str, Any]:
    """Keep the fields this app stores for a document."""
    data = data or {}
    extra = data.get("extra") or {}
    emails = list(data.get("emails") or [])
    if not emails and extra.get("email"):
        emails = [str(extra["email"])]
    return {
        "name": data.get("name"),
        "category": data.get("category"),
        "summary": data.get("summary"),
        "description": data.get("description"),
        "author": data.get("author"),
        "tags": data.get("tags"),
        "extra": extra,
        "emails": emails,
        "phones": list(data.get("phones") or []),
        "dates": list(data.get("dates") or []),
        "images": data.get("images") or [],
        "tables": data.get("tables") or [],
        "headings": data.get("headings") or [],
        "key_values": data.get("key_values") or {},
        "source": data.get("source"),
        "filename": data.get("filename"),
    }
