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

# Colon (but not ://), spaced dash/equals, pipe, or tab.
_SEP = r"(?:\t+|\s*:(?!//)\s*|\s+[-–—=]\s+|\s*\|\s+)"

_LABEL = r"[A-Za-z][A-Za-z0-9 &\-/]{1,40}?"

_LABEL_ONLY = re.compile(
    rf"^\s*(?P<label>{_LABEL})\s*[:\-–—|]?\s*$",
    re.IGNORECASE,
)

_INLINE = re.compile(
    rf"^\s*(?P<label>{_LABEL})\s*{_SEP}(?P<value>.+?)\s*$",
    re.IGNORECASE,
)

_TAB_PAIR = re.compile(
    rf"^\s*(?P<label>{_LABEL})\s*\t+\s*(?P<value>.+?)\s*$",
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


def _alias_alternation() -> str:
    aliases: list[str] = []
    for variants in FIELD_ALIASES.values():
        aliases.extend(variants)
    unique = sorted(set(aliases), key=len, reverse=True)
    return "|".join(re.escape(a) for a in unique)


_ALIAS_ALT = _alias_alternation()
_KNOWN_LABELED = re.compile(
    rf"(?i)(?:^|(?<=[\s;|/]))(?P<label>{_ALIAS_ALT})\s*{_SEP}(?P<value>.+?)(?=\s+(?:{_ALIAS_ALT})\s*{_SEP}|$)"
)
_EXTRA_LABELED = re.compile(
    r"(?i)(?:^|(?<=\s))(?P<label>[A-Za-z][A-Za-z0-9_\-/]{1,24})\s*:\s+(?P<value>.+?)"
    r"(?=\s+[A-Za-z][A-Za-z0-9_\-/]{1,24}\s*:|$)"
)


def strip_list_prefix(text: str) -> str:
    return _LIST_PREFIX.sub("", (text or "").strip())


def normalize_label(text: str) -> str:
    cleaned = re.sub(r"\s+", " ", text.strip().lower())
    return cleaned.rstrip(":-–—|= ")


def match_canonical_field(label: str) -> str | None:
    normalized = normalize_label(label)
    for canonical, aliases in FIELD_ALIASES.items():
        if normalized in aliases:
            return canonical
    return None


def looks_like_label(text: str) -> bool:
    text = text.strip()
    if not text or len(text) > 48:
        return False
    if match_canonical_field(text):
        return True
    if re.search(r"[.!?]$", text):
        return False
    if len(text.split()) > 4:
        return False
    return bool(_LABEL_ONLY.match(text))


def parse_inline_field(line: str) -> tuple[str, str] | None:
    line = strip_list_prefix(line)
    match = _INLINE.match(line) or _TAB_PAIR.match(line)
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
    line = strip_list_prefix(line)
    match = _INLINE.match(line) or _TAB_PAIR.match(line)
    if not match:
        return None
    if match_canonical_field(match.group("label")):
        return None
    value = match.group("value").strip()
    if not value:
        return None
    return normalize_label(match.group("label")), value


def parse_all_labeled_fields(text: str) -> list[tuple[str, str]]:
    """Find one or more Label: value pairs anywhere in the text."""
    found: list[tuple[str, str]] = []
    occupied: list[tuple[int, int]] = []

    def _take(match: re.Match[str], key: str) -> None:
        value = match.group("value").strip(" \t;|")
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
        inline = parse_inline_field(text)
        if inline:
            return [inline]
        extra = parse_extra_inline(text)
        if extra:
            return [extra]
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
    text = strip_list_prefix(text or "")
    if parse_inline_field(text) or parse_extra_inline(text):
        return True
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
