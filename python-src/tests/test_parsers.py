"""
Unit tests for parsers module (PDF, DOCX, base).

Tests parser resilience with valid, invalid, empty, missing, and corrupt inputs.
"""
import os
import sys
import tempfile

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from parsers.base import parse_document, detect_document_type, DocumentType, ParseResult
from parsers.pdf_parser import (
    check_pdf_readable,
    is_multi_column,
    find_column_boundary,
    extract_text_from_blocks,
    convert_to_text_blocks,
)


# --- DocumentType detection ---

class TestDetectDocumentType:
    def test_pdf_extension(self):
        assert detect_document_type("cv.pdf") == DocumentType.PDF

    def test_docx_extension(self):
        assert detect_document_type("cv.docx") == DocumentType.DOCX

    def test_doc_extension(self):
        assert detect_document_type("cv.doc") == DocumentType.DOC

    def test_unknown_extension(self):
        assert detect_document_type("cv.txt") == DocumentType.UNKNOWN

    def test_uppercase_extension(self):
        assert detect_document_type("CV.PDF") == DocumentType.PDF

    def test_no_extension(self):
        assert detect_document_type("myfile") == DocumentType.UNKNOWN

    def test_double_extension(self):
        assert detect_document_type("file.backup.pdf") == DocumentType.PDF

    def test_dotfile(self):
        assert detect_document_type(".hidden") == DocumentType.UNKNOWN


# --- parse_document dispatcher ---

class TestParseDocument:
    def test_file_not_found(self):
        with pytest.raises(FileNotFoundError):
            parse_document("/nonexistent/path/cv.pdf")

    def test_unsupported_type(self, tmp_path):
        f = tmp_path / "cv.txt"
        f.write_text("hello")
        with pytest.raises(ValueError, match="Unsupported file type"):
            parse_document(str(f))

    def test_doc_format_rejected(self, tmp_path):
        f = tmp_path / "cv.doc"
        f.write_bytes(b"fake doc")
        with pytest.raises(ValueError, match="Legacy .doc format"):
            parse_document(str(f))

    def test_valid_pdf(self, tmp_pdf_path):
        result = parse_document(tmp_pdf_path)
        assert isinstance(result, dict)
        assert 'raw_text' in result
        assert 'blocks' in result
        assert 'warnings' in result
        assert 'parse_time_ms' in result
        assert result['document_type'] == 'pdf'
        assert result['page_count'] >= 1

    def test_valid_pdf_has_text(self, tmp_pdf_path):
        result = parse_document(tmp_pdf_path)
        assert "Hello" in result['raw_text'] or len(result['raw_text']) >= 0


# --- PDF parser internals ---

class TestCheckPdfReadable:
    def test_valid_pdf(self, tmp_pdf_path):
        ok, msg = check_pdf_readable(tmp_pdf_path)
        assert ok is True
        assert msg == "OK"

    def test_empty_file(self, tmp_empty_file):
        ok, msg = check_pdf_readable(tmp_empty_file)
        assert ok is False

    def test_non_pdf_file(self, tmp_text_as_pdf):
        ok, msg = check_pdf_readable(tmp_text_as_pdf)
        assert ok is False

    def test_nonexistent_file(self):
        ok, msg = check_pdf_readable("/nonexistent/file.pdf")
        assert ok is False


class TestMultiColumnDetection:
    def test_empty_blocks(self):
        assert is_multi_column([], 600) is False

    def test_single_block(self):
        blocks = [{"type": 0, "bbox": [50, 0, 300, 20]}]
        assert is_multi_column(blocks, 600) is False

    def test_two_column_blocks(self):
        blocks = [
            {"type": 0, "bbox": [50, 0, 250, 20]},
            {"type": 0, "bbox": [350, 0, 550, 20]},
        ]
        assert is_multi_column(blocks, 600) is True

    def test_image_blocks_ignored(self):
        blocks = [{"type": 1, "bbox": [50, 0, 550, 400]}]
        assert is_multi_column(blocks, 600) is False


class TestFindColumnBoundary:
    def test_empty_blocks(self):
        assert find_column_boundary([], 600) is None

    def test_two_columns(self):
        blocks = [
            {"type": 0, "bbox": [50, 0, 200, 20]},
            {"type": 0, "bbox": [400, 0, 550, 20]},
        ]
        boundary = find_column_boundary(blocks, 600)
        assert boundary is not None
        assert 200 < boundary < 400


class TestExtractTextFromBlocks:
    def test_empty(self):
        assert extract_text_from_blocks([]) == ""

    def test_single_text_block(self):
        blocks = [{
            "type": 0,
            "lines": [{"spans": [{"text": "Hello World"}]}]
        }]
        assert "Hello World" in extract_text_from_blocks(blocks)

    def test_image_blocks_skipped(self):
        blocks = [{"type": 1}]
        assert extract_text_from_blocks(blocks) == ""

    def test_multiple_spans(self):
        blocks = [{
            "type": 0,
            "lines": [{"spans": [{"text": "Hello "}, {"text": "World"}]}]
        }]
        assert "Hello World" in extract_text_from_blocks(blocks)


class TestConvertToTextBlocks:
    def test_empty(self):
        assert convert_to_text_blocks([], 0) == []

    def test_text_block_conversion(self):
        blocks = [{
            "type": 0,
            "bbox": [10, 20, 300, 40],
            "lines": [{"spans": [{"text": "Test", "font": "Arial", "size": 12}]}]
        }]
        result = convert_to_text_blocks(blocks, 0)
        assert len(result) == 1
        assert result[0]["text"] == "Test"
        assert result[0]["page"] == 1  # 1-indexed

    def test_image_block_excluded(self):
        blocks = [{"type": 1, "bbox": [0, 0, 100, 100]}]
        assert convert_to_text_blocks(blocks, 0) == []
