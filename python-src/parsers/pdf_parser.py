"""
PDF parser with cascading extraction strategy.

Uses PyMuPDF (pymupdf) for fast extraction with pdfplumber fallback
for complex tables AND full text extraction when PyMuPDF fails.

Strategy:
1. Pre-clean PDF with garbage collection to repair malformed files
2. Fast extraction with PyMuPDF get_text("dict", sort=True)
3. Detect multi-column layout by analyzing block X positions
4. For multi-column: process columns separately, merge in reading order
5. Detect tables with page.find_tables()
6. If tables found, use pdfplumber for accurate table extraction
7. If PyMuPDF text is empty/short, fall back to pdfplumber full text
8. If PyMuPDF crashes entirely, fall back to pdfplumber-only extraction
"""
import contextlib
import io
import logging
import sys
import time
from contextlib import contextmanager

import pdfplumber
import pymupdf

from parsers.base import ParseResult, TableData, TextBlock

logger = logging.getLogger(__name__)


@contextmanager
def suppress_stdout():
    """
    Context manager to suppress stdout.

    PyMuPDF prints informational messages to stdout which breaks
    our JSON lines IPC protocol.
    """
    # Save the original stdout
    old_stdout = sys.stdout
    # Replace stdout with a null device
    sys.stdout = io.StringIO()
    try:
        yield
    finally:
        # Restore original stdout
        sys.stdout = old_stdout

# Multi-column detection threshold (pixels)
COLUMN_GAP_THRESHOLD = 100

# Minimum chars expected per page for a valid extraction
MIN_CHARS_PER_PAGE = 50


def check_pdf_readable(file_path: str) -> tuple[bool, str]:
    """
    Check if PDF is readable and not encrypted/secured.

    Returns:
        Tuple of (is_readable, message).
        For image-only PDFs, returns (False, "image-only-pdf").
    """
    try:
        doc = pymupdf.open(file_path)
    except Exception as e:
        return False, f"Failed to open PDF: {str(e)}"

    try:
        if doc.is_encrypted:
            doc.close()
            return False, "PDF is encrypted - please provide an unlocked version"

        # Check if we can read text from first page
        if doc.page_count > 0:
            try:
                text = doc[0].get_text()
                if not text.strip():
                    doc.close()
                    return False, "image-only-pdf"
            except Exception as e:
                doc.close()
                return False, f"Cannot extract text from PDF: {str(e)}"

        doc.close()
        return True, "OK"
    except Exception as e:
        with contextlib.suppress(Exception):
            doc.close()
        return False, f"Error checking PDF: {str(e)}"


def pre_clean_pdf(file_path: str) -> bytes | None:
    """
    Attempt to clean/repair a malformed PDF.

    Uses PyMuPDF's garbage collection and cleaning to fix common issues.
    Returns cleaned bytes on success, None on failure.
    """
    try:
        doc = pymupdf.open(file_path)
        cleaned_bytes = doc.tobytes(garbage=3, clean=True)
        doc.close()
        return cleaned_bytes
    except Exception as e:
        logger.debug("PDF pre-cleaning failed: %s — continuing with original", e)
        return None


def is_multi_column(blocks: list[dict], page_width: float) -> bool:
    """
    Detect if page has multi-column layout.

    Analyzes X positions of text blocks to find significant gaps
    that indicate column boundaries.
    """
    # Get X positions of text blocks
    x_positions = []
    for block in blocks:
        if block.get("type") == 0:  # Text block
            x0 = block["bbox"][0]
            x_positions.append(x0)

    if len(x_positions) < 2:
        return False

    # Sort and deduplicate X positions (within tolerance)
    x_sorted = sorted(set(round(x, -1) for x in x_positions))

    # Check if there's a significant gap in X positions
    for i in range(1, len(x_sorted)):
        gap = x_sorted[i] - x_sorted[i - 1]
        # Gap should be significant but not span entire page
        if gap > COLUMN_GAP_THRESHOLD and gap < page_width * 0.7:
            return True

    return False


def find_column_boundary(blocks: list[dict], page_width: float) -> float | None:
    """
    Find the X coordinate that separates left and right columns.

    Returns None if no clear boundary found.
    """
    x_positions = []
    for block in blocks:
        if block.get("type") == 0:
            x0 = block["bbox"][0]
            x1 = block["bbox"][2]
            x_positions.append((x0, x1))

    if not x_positions:
        return None

    # Find the largest gap in X positions
    all_x = sorted(set([x for x0, x1 in x_positions for x in [x0, x1]]))

    max_gap = 0
    boundary = None

    for i in range(1, len(all_x)):
        gap = all_x[i] - all_x[i - 1]
        if gap > max_gap and gap > COLUMN_GAP_THRESHOLD:
            max_gap = gap
            # Boundary is middle of the gap
            boundary = (all_x[i - 1] + all_x[i]) / 2

    return boundary


def extract_text_from_blocks(blocks: list[dict]) -> str:
    """Extract concatenated text from blocks."""
    lines = []
    for block in blocks:
        if block.get("type") == 0:  # Text block
            for line in block.get("lines", []):
                line_text = "".join(span["text"] for span in line.get("spans", []))
                if line_text.strip():
                    lines.append(line_text)
    return "\n".join(lines)


def process_multi_column_page(page: pymupdf.Page, page_dict: dict) -> tuple[str, list[TextBlock]]:
    """
    Process a multi-column page by splitting into columns and merging.

    Returns:
        Tuple of (raw_text, text_blocks)
    """
    blocks = page_dict.get("blocks", [])
    page_width = page.rect.width

    boundary = find_column_boundary(blocks, page_width)

    if boundary is None:
        # Fall back to simple extraction
        text = extract_text_from_blocks(blocks)
        text_blocks = convert_to_text_blocks(blocks, page.number)
        return text, text_blocks

    # Separate blocks into left and right columns
    left_blocks = []
    right_blocks = []

    for block in blocks:
        if block.get("type") == 0:
            x_center = (block["bbox"][0] + block["bbox"][2]) / 2
            if x_center < boundary:
                left_blocks.append(block)
            else:
                right_blocks.append(block)

    # Sort each column by Y position (top to bottom)
    left_blocks.sort(key=lambda b: b["bbox"][1])
    right_blocks.sort(key=lambda b: b["bbox"][1])

    # Extract text from each column
    left_text = extract_text_from_blocks(left_blocks)
    right_text = extract_text_from_blocks(right_blocks)

    # Merge: left column first, then right column
    raw_text = left_text + "\n\n" + right_text if right_text else left_text

    # Create text blocks preserving original positions
    text_blocks = convert_to_text_blocks(left_blocks + right_blocks, page.number)

    return raw_text, text_blocks


def convert_to_text_blocks(blocks: list[dict], page_num: int) -> list[TextBlock]:
    """Convert PyMuPDF blocks to TextBlock format."""
    result = []

    for block in blocks:
        if block.get("type") != 0:
            continue

        # Get first line's font info
        font = None
        size = None
        lines = block.get("lines", [])
        if lines and lines[0].get("spans"):
            first_span = lines[0]["spans"][0]
            font = first_span.get("font")
            size = first_span.get("size")

        # Concatenate all text in block
        text_parts = []
        for line in lines:
            line_text = "".join(span["text"] for span in line.get("spans", []))
            text_parts.append(line_text)

        text_block: TextBlock = {
            "text": "\n".join(text_parts),
            "bbox": tuple(block["bbox"]),
            "font": font,
            "size": size,
            "page": page_num + 1  # 1-indexed for user display
        }
        result.append(text_block)

    return result


def extract_tables_with_pdfplumber(file_path: str, pages_with_tables: list[int]) -> list[TableData]:
    """
    Extract tables using pdfplumber for higher accuracy.

    Args:
        file_path: Path to PDF
        pages_with_tables: List of page numbers (0-indexed) that have tables
    """
    tables = []

    try:
        with pdfplumber.open(file_path) as pdf:
            for page_num in pages_with_tables:
                if page_num >= len(pdf.pages):
                    continue

                page = pdf.pages[page_num]
                page_tables = page.extract_tables()

                for table in page_tables:
                    if table:
                        # Clean table: replace None with empty string
                        cleaned_rows = [
                            [cell if cell else "" for cell in row]
                            for row in table
                        ]
                        tables.append(TableData(
                            rows=cleaned_rows,
                            page=page_num + 1  # 1-indexed
                        ))
    except Exception as e:
        # Tables are optional, don't fail parsing
        logger.warning("Table extraction warning: %s", e)

    return tables


def _extract_text_with_pdfplumber(file_path: str) -> tuple[str, int]:
    """
    Full text extraction using pdfplumber as fallback.

    Returns:
        Tuple of (extracted_text, page_count)
    """
    page_texts = []
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            page_texts.append(text)
        return "\n\n".join(page_texts), len(pdf.pages)


def _pdfplumber_only_parse(file_path: str, start_time: float, warnings: list[str]) -> ParseResult:
    """
    Parse PDF using only pdfplumber (when PyMuPDF fails entirely).
    """
    try:
        raw_text, page_count = _extract_text_with_pdfplumber(file_path)
        warnings.append("Used pdfplumber-only extraction (PyMuPDF unavailable)")

        # Also extract tables
        all_tables: list[TableData] = []
        try:
            with pdfplumber.open(file_path) as pdf:
                for i, page in enumerate(pdf.pages):
                    page_tables = page.extract_tables()
                    for table in page_tables:
                        if table:
                            cleaned_rows = [
                                [cell if cell else "" for cell in row]
                                for row in table
                            ]
                            all_tables.append(TableData(rows=cleaned_rows, page=i + 1))
        except Exception as e:
            logger.debug("Table extraction in pdfplumber fallback failed: %s", e)

        elapsed_ms = int((time.perf_counter() - start_time) * 1000)
        return ParseResult(
            raw_text=raw_text,
            blocks=[],
            tables=all_tables,
            warnings=warnings,
            parse_time_ms=elapsed_ms,
            document_type="pdf",
            page_count=page_count,
        )
    except Exception as e:
        elapsed_ms = int((time.perf_counter() - start_time) * 1000)
        return ParseResult(
            raw_text="",
            blocks=[],
            tables=[],
            warnings=warnings,
            parse_time_ms=elapsed_ms,
            document_type="pdf",
            page_count=0,
            error=f"Both PyMuPDF and pdfplumber failed: {e}",
        )


def parse_pdf(file_path: str) -> ParseResult:
    """
    Parse PDF with cascading strategy.

    1. Pre-clean PDF to repair malformed files
    2. Check if PDF is readable
    3. Extract with PyMuPDF (fast)
    4. Detect multi-column layouts
    5. Use pdfplumber for tables if detected
    6. Fall back to pdfplumber for text if PyMuPDF result is empty/short
    7. If PyMuPDF crashes, fall back to pdfplumber-only extraction
    """
    start_time = time.perf_counter()
    warnings: list[str] = []

    # Step 1: Pre-clean PDF
    cleaned_bytes = pre_clean_pdf(file_path)
    if cleaned_bytes is not None:
        warnings.append("PDF pre-cleaned with garbage collection")

    # Step 2: Check if PDF is readable
    readable, msg = check_pdf_readable(file_path)
    if not readable:
        if msg == "image-only-pdf":
            elapsed_ms = int((time.perf_counter() - start_time) * 1000)
            return ParseResult(
                raw_text="",
                blocks=[],
                tables=[],
                warnings=["PDF appears to be image-only (scanned document)"],
                parse_time_ms=elapsed_ms,
                document_type="pdf",
                page_count=0,
                error="image-only-pdf: This PDF contains only scanned images. "
                      "OCR is not currently supported. Please provide a text-based PDF.",
            )
        # Other readability failures
        elapsed_ms = int((time.perf_counter() - start_time) * 1000)
        return ParseResult(
            raw_text="",
            blocks=[],
            tables=[],
            warnings=[],
            parse_time_ms=elapsed_ms,
            document_type="pdf",
            page_count=0,
            error=msg,
        )

    # Step 3: Try PyMuPDF extraction (wrapped in crash recovery)
    try:
        # Open from cleaned bytes if available, otherwise from file
        if cleaned_bytes is not None:
            doc = pymupdf.open(stream=cleaned_bytes, filetype="pdf")
        else:
            doc = pymupdf.open(file_path)

        all_raw_text = []
        all_blocks: list[TextBlock] = []
        pages_with_tables: list[int] = []

        for page_num, page in enumerate(doc):
            # Get structured text with position info
            page_dict = page.get_text("dict", sort=True)
            blocks = page_dict.get("blocks", [])

            # Check for multi-column layout
            if is_multi_column(blocks, page.rect.width):
                raw_text, text_blocks = process_multi_column_page(page, page_dict)
                warnings.append(f"Page {page_num + 1}: Multi-column layout detected and processed")
            else:
                raw_text = extract_text_from_blocks(blocks)
                text_blocks = convert_to_text_blocks(blocks, page_num)

            all_raw_text.append(raw_text)
            all_blocks.extend(text_blocks)

            # Check for tables using PyMuPDF
            try:
                with suppress_stdout():
                    tables = page.find_tables()
                if tables.tables:
                    pages_with_tables.append(page_num)
            except Exception:  # noqa: S110
                pass

        page_count = doc.page_count
        doc.close()

        combined_text = "\n\n".join(all_raw_text)

        # Step 4: Check if PyMuPDF extraction was sufficient
        if len(combined_text.strip()) < MIN_CHARS_PER_PAGE * max(page_count, 1):
            # PyMuPDF got very little text — try pdfplumber fallback
            try:
                plumber_text, _ = _extract_text_with_pdfplumber(file_path)
                if len(plumber_text.strip()) > len(combined_text.strip()):
                    combined_text = plumber_text
                    all_blocks = []  # Can't preserve block info from pdfplumber
                    warnings.append("Used pdfplumber text fallback (PyMuPDF extraction was insufficient)")
                    logger.info("pdfplumber fallback produced %d chars vs PyMuPDF %d chars",
                                len(plumber_text.strip()), len(combined_text.strip()))
            except Exception as e:
                logger.debug("pdfplumber text fallback also failed: %s", e)

        # Step 5: Extract tables with pdfplumber if any were detected
        all_tables: list[TableData] = []
        if pages_with_tables:
            all_tables = extract_tables_with_pdfplumber(file_path, pages_with_tables)
            if all_tables:
                warnings.append(f"Extracted {len(all_tables)} table(s) from pages: {[p+1 for p in pages_with_tables]}")

        elapsed_ms = int((time.perf_counter() - start_time) * 1000)

        return ParseResult(
            raw_text=combined_text,
            blocks=all_blocks,
            tables=all_tables,
            warnings=warnings,
            parse_time_ms=elapsed_ms,
            document_type="pdf",
            page_count=page_count,
        )

    except Exception as e:
        # PyMuPDF crashed — fall back to pdfplumber-only
        logger.warning("PyMuPDF extraction failed: %s — falling back to pdfplumber", e)
        warnings.append(f"PyMuPDF failed ({type(e).__name__}: {e})")
        return _pdfplumber_only_parse(file_path, start_time, warnings)
