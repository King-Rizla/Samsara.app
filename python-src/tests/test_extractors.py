"""
Unit tests for extractors module (contact, education, skills, work_history, sections).

Tests extraction from realistic CV text and edge cases.
Uses lightweight mocks for spaCy NLP where needed.
"""
import os
import sys
from unittest.mock import MagicMock

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from extractors.contact import (
    _extract_emails,
    _extract_phones,
    _extract_linkedin,
    _extract_github,
    _extract_portfolio,
    _is_likely_company,
    extract_contacts,
)
from extractors.sections import detect_sections, get_section_text, get_section_order
from extractors.skills import extract_skills, merge_skill_groups, _is_category_heading, _parse_skills_from_text
from extractors.education import _extract_degree, _extract_grade, _extract_field_of_study
from extractors.work_history import _looks_like_job_title, _extract_bullets


def _make_nlp_mock(persons=None, orgs=None, gpes=None):
    """Create a mock spaCy nlp callable returning specified entities."""
    persons = persons or []
    orgs = orgs or []
    gpes = gpes or []

    def nlp(text):
        doc = MagicMock()
        ents = []
        for name in persons:
            ent = MagicMock()
            ent.text = name
            ent.label_ = "PERSON"
            ents.append(ent)
        for name in orgs:
            ent = MagicMock()
            ent.text = name
            ent.label_ = "ORG"
            ents.append(ent)
        for name in gpes:
            ent = MagicMock()
            ent.text = name
            ent.label_ = "GPE"
            ents.append(ent)
        doc.ents = ents
        return doc
    return nlp


# --- Contact extraction ---

class TestExtractEmails:
    def test_valid_email(self):
        assert _extract_emails("Contact: john@example.com") == ["john@example.com"]

    def test_multiple_emails(self):
        result = _extract_emails("a@b.com and c@d.org")
        assert len(result) == 2

    def test_no_email(self):
        assert _extract_emails("No email here") == []

    def test_empty(self):
        assert _extract_emails("") == []


class TestExtractPhones:
    def test_uk_mobile(self):
        result = _extract_phones("+44 7700 900123")
        assert len(result) >= 1

    def test_uk_mobile_local(self):
        result = _extract_phones("07700 900123")
        assert len(result) >= 1

    def test_no_phone(self):
        assert _extract_phones("No phone here") == []

    def test_international(self):
        result = _extract_phones("+1 555-123-4567")
        assert len(result) >= 1


class TestExtractLinkedin:
    def test_full_url(self):
        result = _extract_linkedin("https://www.linkedin.com/in/johnsmith")
        assert result is not None
        assert "linkedin.com" in result

    def test_without_protocol(self):
        result = _extract_linkedin("linkedin.com/in/johnsmith")
        assert result is not None

    def test_no_linkedin(self):
        assert _extract_linkedin("No social media") is None


class TestExtractGithub:
    def test_full_url(self):
        result = _extract_github("https://github.com/johnsmith")
        assert result is not None

    def test_no_github(self):
        assert _extract_github("No github") is None


class TestExtractPortfolio:
    def test_finds_portfolio(self):
        result = _extract_portfolio("Visit johndoe.dev for portfolio", None, None)
        assert result is not None

    def test_skips_linkedin(self):
        result = _extract_portfolio("linkedin.com/in/john", "https://linkedin.com/in/john", None)
        assert result is None or "linkedin" not in (result or "").lower()

    def test_no_url(self):
        assert _extract_portfolio("No URL", None, None) is None


class TestIsLikelyCompany:
    def test_company_ltd(self):
        assert _is_likely_company("TechCorp Ltd") is True

    def test_person_name(self):
        assert _is_likely_company("John Smith") is False

    def test_company_inc(self):
        assert _is_likely_company("Acme Inc") is True


class TestExtractContacts:
    def test_full_contact_block(self, sample_contact_block):
        nlp = _make_nlp_mock(persons=["Jane Doe"], gpes=["Manchester"])
        contact, confidence = extract_contacts(sample_contact_block, nlp)
        assert contact.get('email') == "jane.doe@gmail.com"
        assert contact.get('name') == "Jane Doe"
        assert confidence > 0

    def test_empty_text(self):
        nlp = _make_nlp_mock()
        contact, confidence = extract_contacts("", nlp)
        assert confidence == 0.0

    def test_email_only(self):
        nlp = _make_nlp_mock()
        contact, confidence = extract_contacts("Email: test@example.com", nlp)
        assert contact['email'] == "test@example.com"

    def test_no_contact_info(self):
        nlp = _make_nlp_mock()
        contact, confidence = extract_contacts("Just some random text about cooking", nlp)
        assert confidence <= 0.7


# --- Sections ---

class TestDetectSections:
    def test_detects_experience(self, sample_cv_text):
        sections = detect_sections(sample_cv_text)
        names = [s[0] for s in sections]
        assert 'experience' in names

    def test_detects_education(self, sample_cv_text):
        sections = detect_sections(sample_cv_text)
        names = [s[0] for s in sections]
        assert 'education' in names

    def test_detects_skills(self, sample_cv_text):
        sections = detect_sections(sample_cv_text)
        names = [s[0] for s in sections]
        assert 'skills' in names

    def test_empty_text(self):
        assert detect_sections("") == []

    def test_no_sections(self):
        assert detect_sections("Just a paragraph of text") == []


class TestGetSectionText:
    def test_returns_text(self, sample_cv_text):
        sections = detect_sections(sample_cv_text)
        text = get_section_text(sample_cv_text, sections, 'education')
        assert text is not None
        assert len(text) > 0

    def test_missing_section(self, sample_cv_text):
        sections = detect_sections(sample_cv_text)
        assert get_section_text(sample_cv_text, sections, 'nonexistent') is None


class TestGetSectionOrder:
    def test_returns_order(self, sample_cv_text):
        sections = detect_sections(sample_cv_text)
        order = get_section_order(sections)
        assert isinstance(order, list)
        assert len(order) > 0


# --- Skills ---

class TestExtractSkills:
    def test_categorized_skills(self):
        text = "Technical Skills:\nPython, JavaScript, Go\n\nSoft Skills:\nLeadership, Communication"
        groups = extract_skills(text)
        assert len(groups) >= 1
        assert any("Python" in g['skills'] for g in groups)

    def test_flat_skills(self):
        text = "Python, JavaScript, Go, SQL"
        groups = extract_skills(text)
        assert len(groups) >= 1

    def test_empty_text(self):
        assert extract_skills("") == []

    def test_none_text(self):
        assert extract_skills(None) == []

    def test_bullet_skills(self):
        text = "Skills:\n- Python\n- JavaScript\n- Docker"
        groups = extract_skills(text)
        assert len(groups) >= 1


class TestMergeSkillGroups:
    def test_merge_similar(self):
        from schema.cv_schema import SkillGroup
        groups = [
            SkillGroup(category="Technical Skills", skills=["Python"]),
            SkillGroup(category="Programming Languages", skills=["Go"]),
        ]
        merged = merge_skill_groups(groups)
        # Should merge technical categories
        assert len(merged) <= 2

    def test_no_duplicates(self):
        from schema.cv_schema import SkillGroup
        groups = [
            SkillGroup(category="Technical Skills", skills=["Python"]),
            SkillGroup(category="Technical Skills", skills=["Python", "Go"]),
        ]
        merged = merge_skill_groups(groups)
        tech = [g for g in merged if g['category'] == "Technical Skills"][0]
        assert tech['skills'].count("Python") == 1


class TestIsCategoryHeading:
    def test_with_colon(self):
        assert _is_category_heading("Technical Skills:") is True

    def test_known_pattern(self):
        assert _is_category_heading("Programming Languages") is True

    def test_not_heading(self):
        assert _is_category_heading("Python is a programming language used worldwide") is False

    def test_empty(self):
        assert _is_category_heading("") is False


class TestParseSkillsFromText:
    def test_comma_separated(self):
        result = _parse_skills_from_text("Python, JavaScript, Go")
        assert "Python" in result
        assert "Go" in result

    def test_bullet_list(self):
        result = _parse_skills_from_text("- Python\n- JavaScript")
        assert "Python" in result


# --- Education helpers ---

class TestExtractDegree:
    def test_bsc(self):
        assert _extract_degree("BSc in Computer Science") is not None

    def test_mba(self):
        assert _extract_degree("MBA") is not None

    def test_no_degree(self):
        assert _extract_degree("I worked at a factory") is None


class TestExtractGrade:
    def test_first_class(self):
        assert _extract_grade("First Class Honours") is not None

    def test_two_one(self):
        assert _extract_grade("2:1") is not None

    def test_gpa(self):
        assert _extract_grade("3.8 GPA") is not None

    def test_no_grade(self):
        assert _extract_grade("No grade mentioned") is None


# --- Work history helpers ---

class TestLooksLikeJobTitle:
    def test_engineer(self):
        assert _looks_like_job_title("Software Engineer") is True

    def test_manager(self):
        assert _looks_like_job_title("Project Manager") is True

    def test_not_title(self):
        assert _looks_like_job_title("Python") is False


class TestExtractBullets:
    def test_dash_bullets(self):
        result = _extract_bullets("- Did A\n- Did B")
        assert len(result) == 2

    def test_unicode_bullets(self):
        result = _extract_bullets("\u2022 Item 1\n\u2022 Item 2")
        assert len(result) == 2

    def test_no_bullets(self):
        result = _extract_bullets("Plain paragraph text")
        assert len(result) == 0
