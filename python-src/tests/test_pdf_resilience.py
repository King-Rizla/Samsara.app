"""Tests for PDF parser resilience: fallback, pre-cleaning, error handling."""
import time
from unittest.mock import patch, MagicMock

import pytest

from parsers.base import ParseResult
from parsers.pdf_parser import (
    check_pdf_readable,
    parse_pdf,
    pre_clean_pdf,
    _extract_text_with_pdfplumber,
    _pdfplumber_only_parse,
)


class TestPreCleanPdf:
    """Test PDF pre-cleaning with garbage collection."""

    @patch("parsers.pdf_parser.pymupdf")
    def test_pre_clean_returns_bytes_on_success(self, mock_pymupdf):
        mock_doc = MagicMock()
        mock_doc.tobytes.return_value = b"%PDF-cleaned"
        mock_pymupdf.open.return_value = mock_doc

        result = pre_clean_pdf("test.pdf")

        assert result == b"%PDF-cleaned"
        mock_doc.tobytes.assert_called_once_with(garbage=3, clean=True)
        mock_doc.close.assert_called_once()

    @patch("parsers.pdf_parser.pymupdf")
    def test_pre_clean_returns_none_on_failure(self, mock_pymupdf):
        mock_pymupdf.open.side_effect = RuntimeError("corrupt")

        result = pre_clean_pdf("bad.pdf")

        assert result is None


class TestCheckPdfReadable:
    """Test improved check_pdf_readable with image-only detection."""

    @patch("parsers.pdf_parser.pymupdf")
    def test_image_only_pdf_returns_specific_error(self, mock_pymupdf):
        mock_doc = MagicMock()
        mock_doc.is_encrypted = False
        mock_doc.page_count = 1
        mock_page = MagicMock()
        mock_page.get_text.return_value = "   "  # whitespace only
        mock_doc.__getitem__ = MagicMock(return_value=mock_page)
        mock_pymupdf.open.return_value = mock_doc

        readable, msg = check_pdf_readable("image.pdf")

        assert readable is False
        assert msg == "image-only-pdf"


class TestPdfplumberFallback:
    """Test pdfplumber text fallback when PyMuPDF returns insufficient text."""

    @patch("parsers.pdf_parser.pre_clean_pdf", return_value=None)
    @patch("parsers.pdf_parser.check_pdf_readable", return_value=(True, "OK"))
    @patch("parsers.pdf_parser._extract_text_with_pdfplumber")
    @patch("parsers.pdf_parser.pymupdf")
    def test_fallback_when_pymupdf_returns_empty(
        self, mock_pymupdf, mock_plumber_extract, mock_check, mock_clean
    ):
        """When PyMuPDF returns empty text, pdfplumber should be used."""
        # Setup PyMuPDF to return empty text
        mock_doc = MagicMock()
        mock_doc.page_count = 2
        mock_page = MagicMock()
        mock_page.rect.width = 612
        mock_page.number = 0
        # Return empty dict (no blocks)
        mock_page.get_text.return_value = {"blocks": []}
        mock_doc.__iter__ = MagicMock(return_value=iter([mock_page, mock_page]))
        mock_pymupdf.open.return_value = mock_doc

        # Setup pdfplumber to return good text
        mock_plumber_extract.return_value = ("John Doe\nSoftware Engineer\nExperience..." + "x" * 200, 2)

        result = parse_pdf("test.pdf")

        assert "pdfplumber" in " ".join(result.get("warnings", []))
        mock_plumber_extract.assert_called_once()


class TestPyMuPDFCrashRecovery:
    """Test that PyMuPDF crashes fall back to pdfplumber."""

    @patch("parsers.pdf_parser.pre_clean_pdf", return_value=None)
    @patch("parsers.pdf_parser.check_pdf_readable", return_value=(True, "OK"))
    @patch("parsers.pdf_parser._pdfplumber_only_parse")
    @patch("parsers.pdf_parser.pymupdf")
    def test_pymupdf_crash_falls_back_to_pdfplumber(
        self, mock_pymupdf, mock_plumber_parse, mock_check, mock_clean
    ):
        """When PyMuPDF raises an exception, pdfplumber-only parse is used."""
        mock_pymupdf.open.side_effect = RuntimeError("segfault simulation")

        expected_result = ParseResult(
            raw_text="fallback text",
            blocks=[],
            tables=[],
            warnings=["PyMuPDF failed (RuntimeError: segfault simulation)",
                       "Used pdfplumber-only extraction (PyMuPDF unavailable)"],
            parse_time_ms=10,
            document_type="pdf",
            page_count=1,
        )
        mock_plumber_parse.return_value = expected_result

        result = parse_pdf("test.pdf")

        mock_plumber_parse.assert_called_once()
        assert result["raw_text"] == "fallback text"


class TestImageOnlyPdfError:
    """Test that image-only PDFs return ParseResult with error."""

    @patch("parsers.pdf_parser.pre_clean_pdf", return_value=None)
    @patch("parsers.pdf_parser.check_pdf_readable", return_value=(False, "image-only-pdf"))
    def test_image_only_returns_error_in_result(self, mock_check, mock_clean):
        result = parse_pdf("scanned.pdf")

        assert result.get("error") is not None
        assert "image-only-pdf" in result["error"]
        assert result["raw_text"] == ""


class TestParseErrorsReturnResult:
    """Test that parse errors return ParseResult with error field."""

    @patch("parsers.pdf_parser.pre_clean_pdf", return_value=None)
    @patch("parsers.pdf_parser.check_pdf_readable", return_value=(False, "PDF is encrypted - please provide an unlocked version"))
    def test_encrypted_pdf_returns_error_result(self, mock_check, mock_clean):
        result = parse_pdf("encrypted.pdf")

        assert result.get("error") is not None
        assert "encrypted" in result["error"]
        assert result["raw_text"] == ""
        assert result["page_count"] == 0
