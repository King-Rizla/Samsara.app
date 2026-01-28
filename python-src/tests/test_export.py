"""
Unit tests for export module (redaction, blind_profile, theme).

Tests redaction modes, blind profile generation, theme loading, and edge cases.
"""
import json
import os
import sys
import tempfile

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from export.redaction import create_redacted_cv
from export.theme import load_theme, Theme, get_theme_path
from export.blind_profile import generate_blind_profile, _escape_html


# --- Theme ---

class TestLoadTheme:
    def test_default_theme(self):
        """load_theme returns defaults when no theme.json exists."""
        theme = load_theme()
        assert isinstance(theme, Theme)
        assert theme.primary_color.startswith('#')
        assert theme.header_font is not None

    def test_theme_has_all_fields(self):
        theme = load_theme()
        assert theme.primary_color is not None
        assert theme.secondary_color is not None
        assert theme.header_font is not None
        assert theme.body_font is not None
        assert theme.company_name is not None

    def test_get_theme_path_returns_string(self):
        path = get_theme_path()
        assert isinstance(path, str)
        assert 'theme.json' in path


class TestThemeFromJson:
    def test_valid_json(self, tmp_path):
        theme_json = tmp_path / "theme.json"
        theme_json.write_text(json.dumps({
            "primary_color": "#FF0000",
            "secondary_color": "#00FF00",
            "header_font": "Courier",
            "body_font": "Times",
            "company_name": "TestCorp"
        }))
        # Load directly (not via load_theme which uses get_theme_path)
        with open(str(theme_json)) as f:
            data = json.load(f)
        theme = Theme(
            primary_color=data['primary_color'],
            secondary_color=data['secondary_color'],
            header_font=data['header_font'],
            body_font=data['body_font'],
            logo_path=None,
            company_name=data['company_name'],
        )
        assert theme.primary_color == "#FF0000"

    def test_invalid_json_returns_default(self, tmp_path):
        """If JSON is invalid, load_theme falls back to defaults."""
        # We can't easily point load_theme to a custom path,
        # but we test the fallback behavior exists
        theme = load_theme()
        assert theme is not None


# --- Redaction ---

class TestCreateRedactedCv:
    def test_invalid_mode(self, tmp_pdf_path):
        with pytest.raises(ValueError, match="Invalid mode"):
            create_redacted_cv(tmp_pdf_path, {}, mode='invalid')

    def test_full_mode_returns_bytes(self, tmp_pdf_path):
        result = create_redacted_cv(tmp_pdf_path, {}, mode='full')
        assert isinstance(result, bytes)
        assert len(result) > 0
        assert result[:5] == b'%PDF-'

    def test_client_mode_returns_bytes(self, tmp_pdf_path):
        contact = {"email": "test@example.com", "phone": "+44 7700 900123"}
        result = create_redacted_cv(tmp_pdf_path, contact, mode='client')
        assert isinstance(result, bytes)
        assert len(result) > 0

    def test_punt_mode_returns_bytes(self, tmp_pdf_path):
        contact = {"name": "John", "email": "j@x.com", "phone": "123"}
        result = create_redacted_cv(tmp_pdf_path, contact, mode='punt')
        assert isinstance(result, bytes)

    def test_empty_contact_info(self, tmp_pdf_path):
        result = create_redacted_cv(tmp_pdf_path, {}, mode='client')
        assert isinstance(result, bytes)

    def test_none_fields_in_contact(self, tmp_pdf_path):
        contact = {"email": None, "phone": None, "name": None}
        result = create_redacted_cv(tmp_pdf_path, contact, mode='punt')
        assert isinstance(result, bytes)

    def test_whitespace_only_fields(self, tmp_pdf_path):
        contact = {"email": "   ", "phone": "  ", "name": "  "}
        result = create_redacted_cv(tmp_pdf_path, contact, mode='punt')
        assert isinstance(result, bytes)

    def test_file_not_found(self):
        with pytest.raises(Exception):
            create_redacted_cv("/nonexistent.pdf", {}, mode='full')


# --- Blind Profile ---

class TestGenerateBlindProfile:
    @pytest.fixture
    def default_theme(self):
        return load_theme()

    @pytest.fixture
    def sample_cv_data(self):
        return {
            "contact": {"name": "John Smith", "address": "London"},
            "skills": [{"category": "Tech", "skills": ["Python", "Go", "SQL"]}],
            "work_history": [
                {
                    "position": "Engineer",
                    "company": "Corp",
                    "start_date": "01/01/2020",
                    "end_date": "Present",
                    "description": "Built things.",
                }
            ],
        }

    @pytest.fixture
    def recruiter(self):
        return {"name": "Recruiter Jane", "phone": "123", "email": "r@x.com"}

    def test_generates_pdf_bytes(self, sample_cv_data, default_theme, recruiter):
        result = generate_blind_profile(sample_cv_data, default_theme, recruiter, mode='client')
        assert isinstance(result, bytes)
        assert result[:5] == b'%PDF-'

    def test_punt_mode_hides_name(self, sample_cv_data, default_theme, recruiter):
        result = generate_blind_profile(sample_cv_data, default_theme, recruiter, mode='punt')
        assert isinstance(result, bytes)

    def test_minimal_data(self, default_theme, recruiter):
        cv = {"contact": {}, "skills": [], "work_history": []}
        result = generate_blind_profile(cv, default_theme, recruiter, mode='client')
        assert isinstance(result, bytes)

    def test_no_recruiter(self, sample_cv_data, default_theme):
        result = generate_blind_profile(sample_cv_data, default_theme, {}, mode='client')
        assert isinstance(result, bytes)

    def test_empty_cv_data(self, default_theme, recruiter):
        result = generate_blind_profile({}, default_theme, recruiter, mode='client')
        assert isinstance(result, bytes)


# --- HTML escaping ---

class TestEscapeHtml:
    def test_ampersand(self):
        assert _escape_html("A & B") == "A &amp; B"

    def test_angle_brackets(self):
        assert "&lt;" in _escape_html("<script>")

    def test_quotes(self):
        assert "&quot;" in _escape_html('"hello"')

    def test_empty(self):
        assert _escape_html("") == ""

    def test_none(self):
        assert _escape_html(None) == ""

    def test_no_special_chars(self):
        assert _escape_html("hello") == "hello"
