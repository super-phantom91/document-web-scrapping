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


def scrap_name(text: str) -> str | None:
    return scrap_fields_from_text(text).get("name")


def scrap_category(text: str) -> str | None:
    return scrap_fields_from_text(text).get("category")


def scrap_summary(text: str) -> str | None:
    return scrap_fields_from_text(text).get("summary")


def scrap_description(text: str) -> str | None:
    return scrap_fields_from_text(text).get("description")


def scrap_author(text: str) -> str | None:
    return scrap_fields_from_text(text).get("author")


def scrap_tags(text: str) -> str | None:
    return scrap_fields_from_text(text).get("tags")


def scrap_contacts(text: str) -> dict[str, list[str]]:
    return extract_contacts(text or "")


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


def scrap_docx(file_bytes: bytes, filename: str = "document.docx") -> dict[str, Any]:
    from extractors.docx_extractor import extract_docx_bytes

    return extract_docx_bytes(file_bytes, filename)


def scrap_html(html: str, filename: str = "document") -> dict[str, Any]:
    from extractors.html_extractor import extract_html

    return extract_html(html, filename)
