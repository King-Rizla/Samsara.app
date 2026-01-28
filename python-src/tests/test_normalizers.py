"""
Unit tests for normalizers module (dates, text).

Tests date normalization, date range extraction, text cleaning,
bullet normalization, and edge cases.
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from normalizers.dates import normalize_date, extract_date_range, _is_partial_date
from normalizers.text import normalize_text, clean_whitespace, extract_lines, normalize_bullets


# --- Date normalization ---

class TestNormalizeDate:
    def test_iso_format(self):
        assert normalize_date("2020-01-15") == "15/01/2020"

    def test_month_year_full(self):
        result = normalize_date("January 2020")
        assert result == "01/01/2020"

    def test_month_year_abbreviated(self):
        result = normalize_date("Jan 2020")
        assert result == "01/01/2020"

    def test_slash_month_year(self):
        result = normalize_date("01/2020")
        assert result == "01/01/2020"

    def test_year_only(self):
        result = normalize_date("2020")
        assert result == "01/01/2020"

    def test_british_dayfirst(self):
        # 3/2/2020 should be 3rd Feb (dayfirst=True)
        result = normalize_date("3/2/2020")
        assert result == "03/02/2020"

    def test_present(self):
        assert normalize_date("Present") == "Present"

    def test_current(self):
        assert normalize_date("Current") == "Present"

    def test_ongoing(self):
        assert normalize_date("Ongoing") == "Present"

    def test_now(self):
        assert normalize_date("Now") == "Present"

    def test_none_input(self):
        assert normalize_date(None) is None

    def test_empty_string(self):
        assert normalize_date("") is None

    def test_whitespace_only(self):
        assert normalize_date("   ") is None

    def test_garbage_input(self):
        result = normalize_date("not a date at all xyz")
        # Should return original stripped or attempt fuzzy parse
        assert result is not None

    def test_en_dash_cleaned(self):
        result = normalize_date("\u2013Jan 2020\u2013")
        # Should handle en-dash stripping
        assert result is not None

    def test_non_string_input(self):
        assert normalize_date(12345) is None

    def test_present_with_whitespace(self):
        assert normalize_date("  Present  ") == "Present"

    def test_full_date_british(self):
        result = normalize_date("15/01/2020")
        assert result == "15/01/2020"

    def test_december_2022(self):
        result = normalize_date("December 2022")
        assert result == "01/12/2022"


class TestIsPartialDate:
    def test_month_year(self):
        assert _is_partial_date("January 2020") is True

    def test_abbreviated_month_year(self):
        assert _is_partial_date("Jan 2020") is True

    def test_year_only(self):
        assert _is_partial_date("2020") is True

    def test_iso_partial(self):
        assert _is_partial_date("2020-01") is True

    def test_slash_partial(self):
        assert _is_partial_date("01/2020") is True

    def test_full_date(self):
        assert _is_partial_date("15/01/2020") is False


class TestExtractDateRange:
    def test_hyphen_range(self):
        start, end = extract_date_range("Jan 2020 - Dec 2022")
        assert start is not None
        assert end is not None

    def test_to_present(self):
        start, end = extract_date_range("January 2020 to Present")
        assert start is not None
        assert end == "Present"

    def test_year_range(self):
        start, end = extract_date_range("2020 - 2022")
        assert start is not None
        assert end is not None

    def test_empty_input(self):
        assert extract_date_range("") == (None, None)

    def test_none_input(self):
        assert extract_date_range(None) == (None, None)

    def test_single_date(self):
        start, end = extract_date_range("Jan 2020")
        assert start is not None

    def test_en_dash_range(self):
        start, end = extract_date_range("Jan 2020\u2013Dec 2022")
        assert start is not None


# --- Text normalization ---

class TestNormalizeText:
    def test_basic_text(self):
        assert normalize_text("hello") == "hello"

    def test_empty(self):
        assert normalize_text("") == ""

    def test_none(self):
        assert normalize_text(None) == ""

    def test_unicode_normalization(self):
        # fi ligature should decompose
        result = normalize_text("\ufb01")
        assert result == "fi"

    def test_fullwidth(self):
        result = normalize_text("\uff21")  # fullwidth A
        assert result == "A"


class TestCleanWhitespace:
    def test_multiple_spaces(self):
        assert clean_whitespace("hello   world") == "hello world"

    def test_newlines(self):
        assert clean_whitespace("hello\n\nworld") == "hello world"

    def test_tabs(self):
        assert clean_whitespace("hello\t\tworld") == "hello world"

    def test_empty(self):
        assert clean_whitespace("") == ""

    def test_none(self):
        assert clean_whitespace(None) == ""

    def test_leading_trailing(self):
        assert clean_whitespace("  hello  ") == "hello"


class TestExtractLines:
    def test_basic(self):
        result = extract_lines("line1\nline2\nline3")
        assert result == ["line1", "line2", "line3"]

    def test_empty(self):
        assert extract_lines("") == []

    def test_none(self):
        assert extract_lines(None) == []

    def test_strips_lines(self):
        result = extract_lines("  hello  \n  world  ")
        assert result == ["hello", "world"]

    def test_preserves_empty_lines(self):
        result = extract_lines("a\n\nb")
        assert result == ["a", "", "b"]


class TestNormalizeBullets:
    def test_unicode_bullet(self):
        result = normalize_bullets("\u2022 Item")
        assert result == "- Item"

    def test_asterisk_bullet(self):
        result = normalize_bullets("* Item")
        assert result == "- Item"

    def test_em_dash_bullet(self):
        result = normalize_bullets("\u2014 Item")
        assert result == "- Item"

    def test_no_bullet(self):
        result = normalize_bullets("Normal text")
        assert result == "Normal text"

    def test_empty(self):
        assert normalize_bullets("") == ""

    def test_none(self):
        assert normalize_bullets(None) == ""

    def test_multiple_lines(self):
        text = "\u2022 Item 1\n\u2022 Item 2"
        result = normalize_bullets(text)
        assert "- Item 1" in result
        assert "- Item 2" in result
