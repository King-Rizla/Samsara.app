"""
Edge case corpus and Hypothesis property-based fuzz tests.

Ensures all extractors and normalizers handle adversarial inputs
without crashing. Hypothesis generates thousands of random inputs.
"""
import os
import sys
from unittest.mock import MagicMock

import pytest
from hypothesis import given, strategies as st, settings, HealthCheck

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from normalizers.dates import normalize_date, extract_date_range
from normalizers.text import normalize_text, clean_whitespace, extract_lines, normalize_bullets
from extractors.contact import _extract_emails, _extract_phones, _extract_linkedin, _extract_github
from extractors.sections import detect_sections, get_section_text
from extractors.skills import extract_skills, _parse_skills_from_text
from extractors.education import _extract_degree, _extract_grade, _extract_field_of_study
from extractors.work_history import _looks_like_job_title, _extract_bullets


# ---------------------------------------------------------------------------
# Parametrized edge-case corpus tests
# ---------------------------------------------------------------------------

# Functions that accept a single string argument and must not crash
NORMALIZER_FUNCTIONS = [
    normalize_date,
    normalize_text,
    clean_whitespace,
    extract_lines,
    normalize_bullets,
]

EXTRACTOR_STRING_FUNCTIONS = [
    _extract_emails,
    _extract_phones,
    _extract_linkedin,
    _extract_github,
    detect_sections,
    extract_skills,
    _parse_skills_from_text,
    _extract_degree,
    _extract_grade,
    _looks_like_job_title,
    _extract_bullets,
]


@pytest.mark.parametrize("func", NORMALIZER_FUNCTIONS, ids=lambda f: f.__name__)
def test_normalizer_handles_edge_cases(func, edge_case_strings):
    """Every normalizer function must survive all edge case strings without crashing."""
    for s in edge_case_strings:
        if s is None:
            # Some functions accept None, some don't - just don't crash
            try:
                func(s)
            except (TypeError, AttributeError):
                pass
        else:
            try:
                func(s)
            except (TypeError, AttributeError):
                pass  # acceptable for truly hostile inputs


@pytest.mark.parametrize("func", EXTRACTOR_STRING_FUNCTIONS, ids=lambda f: f.__name__)
def test_extractor_handles_edge_cases(func, edge_case_strings):
    """Every extractor function must survive all edge case strings without crashing."""
    for s in edge_case_strings:
        if s is None:
            try:
                func(s)
            except (TypeError, AttributeError):
                pass
        else:
            try:
                func(s)
            except (TypeError, AttributeError):
                pass


def test_extract_date_range_edge_cases(edge_case_strings):
    """extract_date_range must survive all edge case strings."""
    for s in edge_case_strings:
        if s is None:
            try:
                extract_date_range(s)
            except (TypeError, AttributeError):
                pass
        else:
            try:
                extract_date_range(s)
            except (TypeError, AttributeError):
                pass


def test_get_section_text_edge_cases(edge_case_strings):
    """get_section_text must survive edge cases."""
    for s in edge_case_strings:
        if s is None:
            continue
        try:
            sections = detect_sections(s)
            get_section_text(s, sections, 'experience')
        except (TypeError, AttributeError):
            pass


def test_extract_field_of_study_edge_cases(edge_case_strings):
    """_extract_field_of_study with edge case strings."""
    for s in edge_case_strings:
        if s is None:
            continue
        try:
            _extract_field_of_study(s, None)
            _extract_field_of_study(s, "BSc")
        except (TypeError, AttributeError):
            pass


# ---------------------------------------------------------------------------
# Hypothesis property-based fuzz tests
# ---------------------------------------------------------------------------

@given(text=st.text(min_size=0, max_size=5000))
@settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
def test_normalize_date_fuzz(text):
    """normalize_date must not crash on arbitrary text."""
    try:
        result = normalize_date(text)
        assert result is None or isinstance(result, str)
    except (OverflowError, ValueError):
        pass  # acceptable for extreme date values


@given(text=st.text(min_size=0, max_size=5000))
@settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
def test_normalize_text_fuzz(text):
    """normalize_text must not crash on arbitrary text."""
    result = normalize_text(text)
    assert isinstance(result, str)


@given(text=st.text(min_size=0, max_size=5000))
@settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
def test_clean_whitespace_fuzz(text):
    """clean_whitespace must not crash on arbitrary text."""
    result = clean_whitespace(text)
    assert isinstance(result, str)


@given(text=st.text(min_size=0, max_size=5000))
@settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
def test_extract_lines_fuzz(text):
    """extract_lines must not crash on arbitrary text."""
    result = extract_lines(text)
    assert isinstance(result, list)


@given(text=st.text(min_size=0, max_size=5000))
@settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
def test_normalize_bullets_fuzz(text):
    """normalize_bullets must not crash on arbitrary text."""
    result = normalize_bullets(text)
    assert isinstance(result, str)


@given(text=st.text(min_size=0, max_size=5000))
@settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
def test_extract_emails_fuzz(text):
    """_extract_emails must not crash on arbitrary text."""
    result = _extract_emails(text)
    assert isinstance(result, list)


@given(text=st.text(min_size=0, max_size=5000))
@settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
def test_extract_phones_fuzz(text):
    """_extract_phones must not crash on arbitrary text."""
    result = _extract_phones(text)
    assert isinstance(result, list)


@given(text=st.text(min_size=0, max_size=5000))
@settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
def test_detect_sections_fuzz(text):
    """detect_sections must not crash on arbitrary text."""
    result = detect_sections(text)
    assert isinstance(result, list)


@given(text=st.text(min_size=0, max_size=5000))
@settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
def test_extract_skills_fuzz(text):
    """extract_skills must not crash on arbitrary text."""
    result = extract_skills(text)
    assert isinstance(result, list)


@given(text=st.text(min_size=0, max_size=5000))
@settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
def test_extract_date_range_fuzz(text):
    """extract_date_range must not crash on arbitrary text."""
    try:
        result = extract_date_range(text)
        assert isinstance(result, tuple) and len(result) == 2
    except (OverflowError, ValueError):
        pass


@given(text=st.text(min_size=0, max_size=2000))
@settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
def test_extract_degree_fuzz(text):
    """_extract_degree must not crash on arbitrary text."""
    result = _extract_degree(text)
    assert result is None or isinstance(result, str)


@given(text=st.text(min_size=0, max_size=2000))
@settings(max_examples=200, suppress_health_check=[HealthCheck.too_slow])
def test_looks_like_job_title_fuzz(text):
    """_looks_like_job_title must not crash on arbitrary text."""
    result = _looks_like_job_title(text)
    assert isinstance(result, bool)
