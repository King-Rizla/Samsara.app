"""
Base parser interface and document type detection.

Provides parse_document() dispatcher that routes to appropriate parser
based on file extension.
"""
import os
import time
from enum import Enum
from typing import TypedDict, List, Optional, Tuple, Any


class DocumentType(Enum):
    """Supported document types."""
    PDF = "pdf"
    DOCX = "docx"
    DOC = "doc"
    UNKNOWN = "unknown"


class TextBlock(TypedDict, total=False):
    """A block of text with position information."""
    text: str
    bbox: Tuple[float, float, float, float]  # (x0, y0, x1, y1)
    font: Optional[str]
    size: Optional[float]
    page: int


class TableData(TypedDict):
    """Extracted table data."""
    rows: List[List[str]]
    page: int


class ParseResult(TypedDict):
    """Result of document parsing."""
    raw_text: str
    blocks: List[TextBlock]
    tables: List[TableData]
    warnings: List[str]
    parse_time_ms: int
    document_type: str
    page_count: int


def detect_document_type(file_path: str) -> DocumentType:
    """Detect document type from file extension."""
    ext = os.path.splitext(file_path)[1].lower()

    if ext == '.pdf':
        return DocumentType.PDF
    elif ext == '.docx':
        return DocumentType.DOCX
    elif ext == '.doc':
        return DocumentType.DOC
    else:
        return DocumentType.UNKNOWN


def parse_document(file_path: str) -> ParseResult:
    """
    Parse a document and return structured text with layout information.

    Detects file type by extension and routes to appropriate parser.

    Args:
        file_path: Path to the document to parse

    Returns:
        ParseResult with raw_text, blocks, tables, warnings, timing

    Raises:
        FileNotFoundError: If file does not exist
        ValueError: If file type is unsupported or DOC format
        RuntimeError: If parsing fails (encrypted, corrupted, etc.)
    """
    start_time = time.perf_counter()

    # Check file exists
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")

    doc_type = detect_document_type(file_path)

    if doc_type == DocumentType.UNKNOWN:
        ext = os.path.splitext(file_path)[1]
        raise ValueError(f"Unsupported file type: {ext}. Supported: PDF, DOCX")

    if doc_type == DocumentType.DOC:
        raise ValueError(
            "Legacy .doc format is not supported. "
            "Please save the document as .docx (Word 2007+ format) and try again."
        )

    # Route to appropriate parser
    if doc_type == DocumentType.PDF:
        from parsers.pdf_parser import parse_pdf
        result = parse_pdf(file_path)
    elif doc_type == DocumentType.DOCX:
        from parsers.docx_parser import parse_docx
        result = parse_docx(file_path)
    else:
        raise ValueError(f"Parser not implemented for: {doc_type}")

    # Update timing with total time including routing
    elapsed_ms = int((time.perf_counter() - start_time) * 1000)
    result['parse_time_ms'] = elapsed_ms

    return result
