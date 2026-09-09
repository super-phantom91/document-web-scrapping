"""Extraction must work across irregular DOCX layouts, not a single template."""

from __future__ import annotations

import io
import sys
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from extractor import extract_from_docx, extract_from_html  # noqa: E402

W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"


def _p(text: str, *, heading: int | None = None, tabs: list[str] | None = None, br: bool = False) -> str:
    style = ""
    if heading:
        style = f'<w:pPr><w:pStyle w:val="Heading{heading}"/></w:pPr>'
    if tabs:
        runs = (
            f"<w:r><w:t>{escape(tabs[0])}</w:t></w:r>"
            "<w:r><w:tab/></w:r>"
            f"<w:r><w:t>{escape(tabs[1])}</w:t></w:r>"
        )
        return f"<w:p>{style}{runs}</w:p>"
    if br:
        label, _, value = text.partition("\n")
        runs = (
            f"<w:r><w:t>{escape(label)}</w:t></w:r>"
            "<w:r><w:br/></w:r>"
            f"<w:r><w:t>{escape(value)}</w:t></w:r>"
        )
        return f"<w:p>{style}{runs}</w:p>"
    return f"<w:p>{style}<w:r><w:t>{escape(text)}</w:t></w:r></w:p>"


def _sdt(label: str, value: str, tag: str | None = None) -> str:
    tag_xml = f'<w:tag w:val="{escape(tag or label)}"/>'
    return (
        "<w:sdt>"
        f"<w:sdtPr>{tag_xml}<w:alias w:val=\"{escape(label)}\"/></w:sdtPr>"
        f"<w:sdtContent>{_p(value)}</w:sdtContent>"
        "</w:sdt>"
    )


def _table(rows: list[list[str]]) -> str:
    xml_rows = []
    for row in rows:
        cells = "".join(f"<w:tc>{_p(cell)}</w:tc>" for cell in row)
        xml_rows.append(f"<w:tr>{cells}</w:tr>")
    return f"<w:tbl>{''.join(xml_rows)}</w:tbl>"


def _textbox(inner: str) -> str:
    return (
        "<w:p><w:r><w:pict><v:shape><v:textbox>"
        f"<w:txbxContent>{inner}</w:txbxContent>"
        "</v:textbox></v:shape></w:pict></w:r></w:p>"
    )


def _docx(body: str, *, header: str = "", core: str = "") -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr(
            "word/document.xml",
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            f'<w:document xmlns:w="{W}"><w:body>{body}<w:sectPr/></w:body></w:document>',
        )
        if header:
            zf.writestr(
                "word/header1.xml",
                '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                f'<w:hdr xmlns:w="{W}">{header}</w:hdr>',
            )
        if core:
            zf.writestr("docProps/core.xml", core)
        zf.writestr("word/media/photo.png", b"\x89PNG\r\n\x1a\n" + b"\x00" * 24)
    return buf.getvalue()


def test_inline_labels():
    body = "".join(
        [
            _p("Product Sheet", heading=1),
            _p("Name: Aurora Desk Lamp"),
            _p("Category - Home & Office"),
            _p("Author = Jane Carter"),
            _p("Tags: lighting, desk, LED"),
            _p("Summary: A compact LED desk lamp with adjustable brightness."),
            _p(
                "Description: The Aurora Desk Lamp includes three brightness levels, "
                "a USB charging port, and a flexible neck for precise lighting."
            ),
        ]
    )
    data = extract_from_docx(_docx(body), "inline.docx")
    assert data["name"] == "Aurora Desk Lamp"
    assert data["category"] == "Home & Office"
    assert data["author"] == "Jane Carter"
    assert data["tags"] == "lighting, desk, LED"
    assert "compact LED" in data["summary"]
    assert "USB charging" in data["description"]
    assert data["images"]


def test_label_then_value_blocks():
    body = "".join(
        [
            _p("Title"),
            _p("Forest Hiking Guide"),
            _p("Type"),
            _p("Outdoor / Travel"),
            _p("Overview"),
            _p("A short guide covering trail safety, packing tips, and weather checks."),
            _p("Details"),
            _p(
                "This guide is intended for beginners. It covers footwear, hydration, "
                "navigation tools, and how to read trail markers in dense forest areas."
            ),
            _p("Prepared by"),
            _p("Sam Rivera"),
        ]
    )
    data = extract_from_docx(_docx(body), "blocks.docx")
    assert data["name"] == "Forest Hiking Guide"
    assert data["category"] == "Outdoor / Travel"
    assert data["author"] == "Sam Rivera"
    assert "trail safety" in data["summary"]
    assert "beginners" in data["description"]


def test_vertical_table():
    body = _p("Inventory Record", heading=1) + _table(
        [
            ["Product Name", "Nimbus Wireless Mouse"],
            ["Classification", "Electronics"],
            ["Brief", "Ergonomic mouse with silent clicks and long battery life."],
            ["Keywords", "mouse, wireless, office"],
            ["Created by", "Ops Team"],
        ]
    )
    data = extract_from_docx(_docx(body), "table.docx")
    assert data["name"] == "Nimbus Wireless Mouse"
    assert data["category"] == "Electronics"
    assert data["author"] == "Ops Team"
    assert "Ergonomic mouse" in data["summary"]
    assert data["tags"] == "mouse, wireless, office"


def test_horizontal_table():
    body = _table(
        [
            ["Product Name", "Classification", "Brief", "Created by"],
            ["Nimbus Mouse", "Electronics", "Silent wireless mouse.", "Ops Team"],
        ]
    )
    data = extract_from_docx(_docx(body), "horizontal.docx")
    assert data["name"] == "Nimbus Mouse"
    assert data["category"] == "Electronics"
    assert data["author"] == "Ops Team"
    assert "Silent wireless" in data["summary"]


def test_pairwise_row():
    body = _table([["Name", "Cedar Journal", "Category", "Stationery", "Author", "Lee Park"]])
    data = extract_from_docx(_docx(body), "pairs.docx")
    assert data["name"] == "Cedar Journal"
    assert data["category"] == "Stationery"
    assert data["author"] == "Lee Park"


def test_content_controls_and_wrapper():
    inner = "".join(
        [
            _sdt("Product Name", "Form Lamp", "name"),
            _sdt("Type", "Lighting", "category"),
            _sdt("Overview", "A form-controlled product sheet.", "summary"),
            _p("Author: Riley Ng"),
        ]
    )
    body = f"<w:sdt><w:sdtPr/><w:sdtContent>{inner}</w:sdtContent></w:sdt>"
    data = extract_from_docx(_docx(body), "form.docx")
    assert data["name"] == "Form Lamp"
    assert data["category"] == "Lighting"
    assert data["author"] == "Riley Ng"
    assert "form-controlled" in data["summary"]


def test_tab_separated_and_line_break():
    body = "".join(
        [
            _p("", tabs=["Name", "Tabbed Title"]),
            _p("Category:\nOutdoor Gear", br=True),
            _p("Prepared by: Alex Kim"),
        ]
    )
    data = extract_from_docx(_docx(body), "tabs.docx")
    assert data["name"] == "Tabbed Title"
    assert data["category"] == "Outdoor Gear"
    assert data["author"] == "Alex Kim"


def test_multiple_fields_on_one_line():
    body = _p("Name: Aurora Lamp  Category: Home  Author: Jane Carter  Tags: lamp, led")
    data = extract_from_docx(_docx(body), "multi.docx")
    assert data["name"] == "Aurora Lamp"
    assert data["category"] == "Home"
    assert data["author"] == "Jane Carter"
    assert data["tags"] == "lamp, led"


def test_textbox_and_header_and_extra_fields():
    body = "".join(
        [
            _textbox(_p("Name: Boxed Compass")),
            _p("SKU: ABC-99"),
            _p("Contact: 555-123-4567  ops@example.com  2024-03-15"),
        ]
    )
    header = _p("Author: Header Writer")
    data = extract_from_docx(_docx(body, header=header), "box.docx")
    assert data["name"] == "Boxed Compass"
    assert data["author"] == "Header Writer"
    assert data["extra"].get("sku") == "ABC-99"
    assert "ops@example.com" in data["emails"]
    assert data["dates"]


def test_nested_table():
    nested = _table([["Category", "Books"], ["Author", "Ada West"]])
    outer = (
        "<w:tbl><w:tr><w:tc>"
        f"{_p('Name: Nested Atlas')}{nested}"
        "</w:tc></w:tr></w:tbl>"
    )
    data = extract_from_docx(_docx(outer), "nested.docx")
    assert data["name"] == "Nested Atlas"
    assert data["category"] == "Books"
    assert data["author"] == "Ada West"


def test_core_properties_fallback():
    core = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" '
        'xmlns:dc="http://purl.org/dc/elements/1.1/">'
        "<dc:title>Meta Title</dc:title>"
        "<dc:creator>Meta Author</dc:creator>"
        "<cp:category>Meta Category</cp:category>"
        "<cp:keywords>meta, tags</cp:keywords>"
        "</cp:coreProperties>"
    )
    data = extract_from_docx(_docx(_p("Unlabeled paragraph about the product in enough words."), core=core), "meta.docx")
    assert data["name"] == "Meta Title"
    assert data["author"] == "Meta Author"
    assert data["category"] == "Meta Category"
    assert data["tags"] == "meta, tags"


def test_html_mixed_layout():
    html = """
    <h1>Team Notes</h1>
    <p>Name: Maya Chen<br/>Category: Operations</p>
    <ul><li>Author: Casey</li></ul>
    <table>
      <tr><th>Keywords</th><td>ops, notes</td></tr>
    </table>
    """
    data = extract_from_html(html, "notes")
    assert data["name"] == "Maya Chen"
    assert data["category"] == "Operations"
    assert data["author"] == "Casey"
    assert data["tags"] == "ops, notes"


def test_bold_run_label():
    body = (
        "<w:p>"
        "<w:r><w:rPr><w:b/></w:rPr><w:t>Name</w:t></w:r>"
        "<w:r><w:t> Boldface Lamp</w:t></w:r>"
        "</w:p>"
        "<w:p>"
        "<w:r><w:rPr><w:b/></w:rPr><w:t>Category</w:t></w:r>"
        "<w:r><w:t> Lighting</w:t></w:r>"
        "</w:p>"
    )
    data = extract_from_docx(_docx(body), "bold.docx")
    assert data["name"] == "Boldface Lamp"
    assert data["category"] == "Lighting"


def test_numbered_label_and_multiline_description():
    body = "".join(
        [
            _p("1. Name: Numbered Compass"),
            _p("2. Type: Outdoor"),
            _p("Details"),
            _p("First paragraph of the long description for beginners on the trail."),
            _p("Second paragraph continues the description with packing and weather notes."),
        ]
    )
    data = extract_from_docx(_docx(body), "numbered.docx")
    assert data["name"] == "Numbered Compass"
    assert data["category"] == "Outdoor"
    assert "First paragraph" in data["description"]
    assert "Second paragraph" in data["description"]


def test_heuristics_skip_labeled_lines():
    body = "".join(
        [
            _p("Name: Quiet Kettle"),
            _p("Category: Kitchen"),
            _p("A mid-length unlabeled sentence used as the summary for this kettle."),
        ]
    )
    data = extract_from_docx(_docx(body), "skip.docx")
    assert data["name"] == "Quiet Kettle"
    assert data["summary"] == "A mid-length unlabeled sentence used as the summary for this kettle."


def test_html_bold_label():
    html = "<p><strong>Name</strong> Harbor Mug</p><p><b>Category:</b> Kitchen</p>"
    data = extract_from_html(html, "mug")
    assert data["name"] == "Harbor Mug"
    assert data["category"] == "Kitchen"


if __name__ == "__main__":
    tests = [fn for name, fn in list(globals().items()) if name.startswith("test_") and callable(fn)]
    failed = 0
    for test in tests:
        try:
            test()
            print(f"ok  {test.__name__}")
        except Exception as exc:
            failed += 1
            print(f"FAIL {test.__name__}: {exc}")
    if failed:
        raise SystemExit(failed)
    print(f"{len(tests)} tests passed")
