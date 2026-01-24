"""
PDF parser with cascading extraction strategy.

Uses PyMuPDF (pymupdf) for fast extraction with pdfplumber fallback
for complex tables.

Strategy:
1. Fast extraction with PyMuPDF get_text("dict", sort=True)
2. Detect multi-column layout by analyzing block X positions
3. For multi-column: process columns separately, merge in reading order
4. Detect tables with page.find_tables()
5. If tables found, use pdfplumber for accurate table extraction
"""
import io
import os
import sys
import time
from contextlib import contextmanager
from typing import List, Tuple, Optional

import pymupdf
import pdfplumber


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

from parsers.base import ParseResult, TextBlock, TableData


# Multi-column detection threshold (pixels)
COLUMN_GAP_THRESHOLD = 100


def check_pdf_readable(file_path: str) -> Tuple[bool, str]:
    """
    Check if PDF is readable and not encrypted/secured.

    Returns:
        Tuple of (is_readable, message)
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
                    # Could be image-only or permissions restricted
                    # Try to check permissions
                    metadata = doc.metadata
                    doc.close()
                    return False, "PDF appears to be image-only or has no extractable text"
            except Exception as e:
                doc.close()
                return False, f"Cannot extract text from PDF: {str(e)}"

        doc.close()
        return True, "OK"
    except Exception as e:
        try:
            doc.close()
        except:
            pass
        return False, f"Error checking PDF: {str(e)}"


def is_multi_column(blocks: List[dict], page_width: float) -> bool:
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


def find_column_boundary(blocks: List[dict], page_width: float) -> Optional[float]:
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


def extract_text_from_blocks(blocks: List[dict]) -> str:
    """Extract concatenated text from blocks."""
    lines = []
    for block in blocks:
        if block.get("type") == 0:  # Text block
            for line in block.get("lines", []):
                line_text = "".join(span["text"] for span in line.get("spans", []))
                if line_text.strip():
                    lines.append(line_text)
    return "\n".join(lines)


def process_multi_column_page(page: pymupdf.Page, page_dict: dict) -> Tuple[str, List[TextBlock]]:
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


def convert_to_text_blocks(blocks: List[dict], page_num: int) -> List[TextBlock]:
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


def extract_tables_with_pdfplumber(file_path: str, pages_with_tables: List[int]) -> List[TableData]:
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
        pass

    return tables


def parse_pdf(file_path: str) -> ParseResult:
    """
    Parse PDF with cascading strategy.

    1. Check if PDF is readable
    2. Extract with PyMuPDF (fast)
    3. Detect multi-column layouts
    4. Use pdfplumber for tables if detected
    """
    start_time = time.perf_counter()
    warnings: List[str] = []

    # Check if PDF is readable
    readable, msg = check_pdf_readable(file_path)
    if not readable:
        raise RuntimeError(msg)

    # Open with PyMuPDF
    doc = pymupdf.open(file_path)

    try:
        all_raw_text = []
        all_blocks: List[TextBlock] = []
        pages_with_tables: List[int] = []

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
            # Note: suppress_stdout to prevent PyMuPDF's informational messages
            # from breaking our JSON lines IPC protocol
            try:
                with suppress_stdout():
                    tables = page.find_tables()
                if tables.tables:
                    pages_with_tables.append(page_num)
            except Exception:
                pass  # Table detection is optional

        page_count = doc.page_count
        doc.close()

        # Extract tables with pdfplumber if any were detected
        all_tables: List[TableData] = []
        if pages_with_tables:
            all_tables = extract_tables_with_pdfplumber(file_path, pages_with_tables)
            if all_tables:
                warnings.append(f"Extracted {len(all_tables)} table(s) from pages: {[p+1 for p in pages_with_tables]}")

        elapsed_ms = int((time.perf_counter() - start_time) * 1000)

        return ParseResult(
            raw_text="\n\n".join(all_raw_text),
            blocks=all_blocks,
            tables=all_tables,
            warnings=warnings,
            parse_time_ms=elapsed_ms,
            document_type="pdf",
            page_count=page_count
        )

    except Exception as e:
        try:
            doc.close()
        except:
            pass
        raise RuntimeError(f"Failed to parse PDF: {str(e)}")
