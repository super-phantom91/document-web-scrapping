"""Field label synonyms and regex patterns for irregular .docx layouts.

Ported from https://github.com/super-phantom91/document-scrapping
"""

from __future__ import annotations

import re
from typing import Iterable

FIELD_ALIASES: dict[str, tuple[str, ...]] = {
    "name": (
        "name",
        "title",
        "product name",
        "item name",
        "document name",
        "full name",
        "subject",
    ),
    "category": (
        "category",
        "type",
        "genre",
        "classification",
        "group",
        "section",
        "department",
    ),
    "summary": (
        "summary",
        "overview",
        "abstract",
        "brief",
        "synopsis",
        "short description",
        "tl;dr",
        "tldr",
    ),
    "description": (
        "description",
        "details",
        "detail",
        "content",
        "body",
        "notes",
        "about",
        "information",
    ),
    "author": (
        "author",
        "writer",
        "created by",
        "prepared by",
        "owner",
        "contributor",
    ),
    "tags": (
        "tags",
        "keywords",
        "labels",
        "topics",
        "key words",
    ),
}

KNOWN_FIELDS = tuple(FIELD_ALIASES.keys())

_SEP = r"[\s]*[:\-–—|=]\s*"

_LABEL_ONLY = re.compile(
    r"^\s*(?P<label>[A-Za-z][A-Za-z0-9 &\-/]{1,40}?)\s*[:\-–—|]?\s*$",
    re.IGNORECASE,
)

_INLINE = re.compile(
    r"^\s*(?P<label>[A-Za-z][A-Za-z0-9 &\-/]{1,40}?)\s*"
    + _SEP
    + r"(?P<value>.+?)\s*$",
    re.IGNORECASE,
)


def normalize_label(text: str) -> str:
    cleaned = re.sub(r"\s+", " ", text.strip().lower())
    return cleaned.rstrip(":-–—|= ")


def match_canonical_field(label: str) -> str | None:
    normalized = normalize_label(label)
    for canonical, aliases in FIELD_ALIASES.items():
        if normalized in aliases:
            return canonical
    return None


def parse_inline_field(line: str) -> tuple[str, str] | None:
    match = _INLINE.match(line)
    if not match:
        return None
    canonical = match_canonical_field(match.group("label"))
    if not canonical:
        return None
    value = match.group("value").strip()
    if not value:
        return None
    return canonical, value


def parse_extra_inline(line: str) -> tuple[str, str] | None:
    match = _INLINE.match(line)
    if not match:
        return None
    if match_canonical_field(match.group("label")):
        return None
    value = match.group("value").strip()
    if not value:
        return None
    return normalize_label(match.group("label")), value


def parse_label_only(line: str) -> str | None:
    match = _LABEL_ONLY.match(line)
    if not match:
        return None
    return match_canonical_field(match.group("label"))


def is_mostly_empty(text: str | None) -> bool:
    return not text or not str(text).strip()


def longest_paragraph(paragraphs: Iterable[str], *, min_length: int = 40) -> str | None:
    candidates = [p.strip() for p in paragraphs if p and len(p.strip()) >= min_length]
    if not candidates:
        return None
    return max(candidates, key=len)
