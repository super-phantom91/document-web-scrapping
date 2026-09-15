"""Document extraction package."""

from extractors.docx_extractor import extract_docx_bytes
from extractors.html_extractor import extract_html
from extractors.scraping import (
    necessary_information,
    scrap_author,
    scrap_category,
    scrap_contacts,
    scrap_description,
    scrap_docx,
    scrap_fields_from_text,
    scrap_html,
    scrap_name,
    scrap_summary,
    scrap_tags,
)

__all__ = [
    "extract_docx_bytes",
    "extract_html",
    "necessary_information",
    "scrap_author",
    "scrap_category",
    "scrap_contacts",
    "scrap_description",
    "scrap_docx",
    "scrap_fields_from_text",
    "scrap_html",
    "scrap_name",
    "scrap_summary",
    "scrap_tags",
]
