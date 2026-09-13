"""Field label synonyms and regex patterns for irregular .docx layouts."""

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
        "document title",
        "full name",
        "subject",
        "project name",
        "report title",
        "report name",
    ),
    "category": (
        "category",
        "type",
        "genre",
        "classification",
        "department",
        "topic",
        "product type",
        "document type",
    ),
    "summary": (
        "summary",
        "overview",
        "abstract",
        "brief",
        "synopsis",
        "short description",
        "executive summary",
        "highlights",
        "tl;dr",
        "tldr",
    ),
    "description": (
        "description",
        "details",
        "detail",
        "notes",
        "about",
        "information",
        "full description",
        "long description",
        "purpose",
        "background",
        "narrative",
        "additional notes",
        "additional information",
    ),
    "author": (
        "author",
        "writer",
        "created by",
        "prepared by",
        "written by",
        "submitted by",
        "reported by",
        "owner",
        "contributor",
        "analyst",
    ),
    "tags": (
        "tags",
        "keywords",
        "labels",
        "topics",
        "key words",
        "key-words",
        "hashtags",
    ),
}

KNOWN_FIELDS = tuple(FIELD_ALIASES.keys())
BLOCK_FIELDS = {"summary", "description"}
WEAK_HEADINGS = {
    "introduction",
    "conclusion",
    "references",
    "appendix",
    "contents",
    "table of contents",
    "index",
    "abstract",
    "overview",
    "summary",
    "acknowledgements",
    "acknowledgments",
}

_LIST_PREFIX = re.compile(
    r"""^\s*(?:(?:[\(\[]?\d+[\)\].:-])|(?:[\(\[]?[ivxlcdm]+[\)\].:-])|[-*•●▪◦])\s+""",
    re.IGNORECASE,
)
_TRAILING_HINT = re.compile(r"(?:\s*[\*＊]+\s*|\s*\([^)]*\)\s*|\s*\[[^\]]*\]\s*)+$")

# Colon (including fullwidth), spaced dash/equals, pipe, or tab.
_SEP = r"(?:\t+|\s*[:：](?!//)\s*|\s+[-–—=]\s+|\s*\|\s*)"
_LABEL_HINT = r"(?:\s*[\*＊]+|\s*\([^)]*\)|\s*\[[^\]]*\])*"

_LABEL = r"[A-Za-z][A-Za-z0-9 &\-/]{1,40}?"

_LABEL_ONLY = re.compile(
    rf"^\s*(?P<label>{_LABEL}){_LABEL_HINT}\s*[:：\-–—|]?\s*$",
    re.IGNORECASE,
)

_INLINE = re.compile(
    rf"^\s*(?P<label>{_LABEL}){_LABEL_HINT}\s*{_SEP}(?P<value>.+?)\s*$",
    re.IGNORECASE,
)

_EMAIL = re.compile(r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b")
_PHONE = re.compile(
    r"\b(?:\+?\d{1,3}[\s.\-])?(?:\(?\d{3}\)?[\s.\-])\d{3}[\s.\-]\d{4}\b"
)
_DATE = re.compile(
    r"\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|"
    r"(?:January|February|March|April|May|June|July|August|September|October|November|December|"
    r"Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+\d{1,2},?\s+\d{4})\b",
    re.IGNORECASE,
)


_ALIAS_ALT = "|".join(
    re.escape(alias)
    for alias in sorted({a for variants in FIELD_ALIASES.values() for a in variants}, key=len, reverse=True)
)
_KNOWN_LABELED = re.compile(
    rf"(?i)(?:^|(?<=[\s;|/；]))(?P<label>{_ALIAS_ALT}){_LABEL_HINT}\s*{_SEP}(?P<value>.+?)(?=\s+(?:{_ALIAS_ALT}){_LABEL_HINT}\s*{_SEP}|$)"
)
_EXTRA_LABELED = re.compile(
    r"(?i)(?:^|(?<=\s))(?P<label>[A-Za-z][A-Za-z0-9_\-/]{1,24})\s*:\s+(?P<value>.+?)"
    r"(?=\s+[A-Za-z][A-Za-z0-9_\-/]{1,24}\s*:|$)"
)


def strip_list_prefix(text: str) -> str:
    text = (text or "").replace("\u00a0", " ").replace("\u202f", " ")
    return _LIST_PREFIX.sub("", text.strip())


def peel_label(text: str) -> str:
    return _TRAILING_HINT.sub("", strip_list_prefix(text)).strip()


def normalize_label(text: str) -> str:
    cleaned = re.sub(r"\s+", " ", peel_label(text).lower())
    return cleaned.rstrip(":-–—|=?？： ")


def match_canonical_field(label: str) -> str | None:
    normalized = normalize_label(label)
    for canonical, aliases in FIELD_ALIASES.items():
        if normalized in aliases:
            return canonical
    return None


def clean_value(value: str) -> str:
    value = (value or "").replace("\u00a0", " ").replace("\u202f", " ")
    value = value.strip(" \t;|")
    value = re.sub(r"^[:：\-–—=]+\s*", "", value)
    return re.sub(r"[ \t]+", " ", value).strip()


def looks_like_label(text: str) -> bool:
    text = peel_label(text)
    if not text or len(text) > 48:
        return False
    if match_canonical_field(text):
        return True
    if re.search(r"[.!?]$", text):
        return False
    if len(text.split()) > 4:
        return False
    return bool(_LABEL_ONLY.match(text))


def parse_labeled_line(line: str) -> tuple[str, str] | None:
    line = strip_list_prefix(line)
    match = _INLINE.match(line)
    if not match:
        return None
    value = clean_value(match.group("value"))
    if not value:
        return None
    key = match_canonical_field(match.group("label")) or normalize_label(match.group("label"))
    return key, value


def parse_all_labeled_fields(text: str) -> list[tuple[str, str]]:
    """Find one or more Label: value pairs anywhere in the text."""
    found: list[tuple[str, str]] = []
    occupied: list[tuple[int, int]] = []

    def _take(match: re.Match[str], key: str) -> None:
        value = clean_value(match.group("value"))
        if not value:
            return
        span = match.span()
        if any(span[0] < end and span[1] > start for start, end in occupied):
            return
        found.append((key, value))
        occupied.append(span)

    for match in _KNOWN_LABELED.finditer(strip_list_prefix(text or "")):
        canonical = match_canonical_field(match.group("label"))
        if canonical:
            _take(match, canonical)

    if not found:
        single = parse_labeled_line(text)
        if single:
            return [single]
        for match in _EXTRA_LABELED.finditer(text or ""):
            label = match.group("label")
            if match_canonical_field(label):
                continue
            _take(match, normalize_label(label))
    return found


def parse_label_only(line: str, *, extra: bool = False) -> str | None:
    line = strip_list_prefix(line)
    match = _LABEL_ONLY.match(line)
    if not match:
        return None
    canonical = match_canonical_field(match.group("label"))
    if canonical:
        return canonical
    if extra and line.rstrip().endswith((":", "-", "–", "—", "=")):
        return normalize_label(match.group("label"))
    return None


def looks_like_field_line(text: str) -> bool:
    return bool(parse_all_labeled_fields(text))


def is_plausible_value(key: str, value: str) -> bool:
    value = (value or "").strip()
    if not value:
        return False
    if match_canonical_field(value) and key not in {"category", "tags"}:
        return False
    if key == "name":
        return 1 <= len(value) <= 160 and value.count("\n") <= 2
    if key == "author":
        return 2 <= len(value) <= 80 and not _EMAIL.search(value) and len(value.split()) <= 8
    if key == "category":
        return 1 <= len(value) <= 80
    if key == "tags":
        return 1 <= len(value) <= 240
    return True


def value_quality(key: str, value: str) -> int:
    value = (value or "").strip()
    if not is_plausible_value(key, value):
        return 0
    words = value.split()
    lowered = value.lower()
    if key == "name":
        if value.isdigit() or len(value) < 3:
            return 3
        if lowered in WEAK_HEADINGS or lowered in {"product sheet", "inventory record", "fact sheet", "cover page"}:
            return 6
        if 2 <= len(words) <= 8 and sum(c.isalpha() for c in value) >= 6:
            return 22
        if 8 <= len(value) <= 80:
            return 16
        return 12
    if key == "author":
        if 2 <= len(words) <= 4:
            return 20
        return 12
    if key == "category":
        return 18 if 1 <= len(words) <= 6 else 10
    if key in {"summary", "description"}:
        return 14 if len(value) >= 40 else 10
    return 10


def is_mostly_empty(text: str | None) -> bool:
    return not text or not str(text).strip()


def longest_paragraph(paragraphs: Iterable[str], *, min_length: int = 40) -> str | None:
    candidates = [p.strip() for p in paragraphs if p and len(p.strip()) >= min_length]
    if not candidates:
        return None
    return max(candidates, key=len)


def extract_contacts(text: str) -> dict[str, list[str]]:
    emails = list(dict.fromkeys(_EMAIL.findall(text or "")))
    phones = list(dict.fromkeys(m.strip() for m in _PHONE.findall(text or "")))
    dates = list(dict.fromkeys(m.strip() for m in _DATE.findall(text or "")))
    return {"emails": emails, "phones": phones, "dates": dates}
