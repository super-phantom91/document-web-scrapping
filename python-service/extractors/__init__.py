"""Document extraction package."""

from extractors.docx_extractor import extract_docx_bytes
from extractors.html_extractor import extract_html

__all__ = ["extract_docx_bytes", "extract_html"]
