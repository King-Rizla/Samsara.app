"""
Unit tests for schema module (cv_schema).

Tests TypedDict construction and field access for all schema types.
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from schema.cv_schema import ContactInfo, WorkEntry, EducationEntry, SkillGroup, ParsedCV


class TestContactInfo:
    def test_full_contact(self):
        c = ContactInfo(
            name="John Smith",
            email="john@example.com",
            phone="+44 7700 900123",
            address="London",
            linkedin="https://linkedin.com/in/john",
            github="https://github.com/john",
            portfolio="https://john.dev",
        )
        assert c['name'] == "John Smith"
        assert c['email'] == "john@example.com"

    def test_partial_contact(self):
        c = ContactInfo(name="Jane")
        assert c['name'] == "Jane"

    def test_empty_contact(self):
        c: ContactInfo = {}
        assert c.get('name') is None

    def test_contact_get_missing_field(self):
        c = ContactInfo(email="a@b.com")
        assert c.get('phone') is None


class TestWorkEntry:
    def test_full_entry(self):
        w = WorkEntry(
            company="TechCorp",
            position="Engineer",
            start_date="01/01/2020",
            end_date="Present",
            description="Built stuff",
            highlights=["Did A", "Did B"],
            confidence=0.9,
        )
        assert w['company'] == "TechCorp"
        assert len(w['highlights']) == 2

    def test_minimal_entry(self):
        w = WorkEntry(company="Corp", position="Dev")
        assert w['company'] == "Corp"

    def test_empty_highlights(self):
        w = WorkEntry(company="X", position="Y", highlights=[])
        assert w['highlights'] == []


class TestEducationEntry:
    def test_full_entry(self):
        e = EducationEntry(
            institution="University of London",
            degree="BSc",
            field_of_study="Computer Science",
            start_date="01/09/2010",
            end_date="01/06/2014",
            grade="First Class",
            confidence=0.9,
        )
        assert e['institution'] == "University of London"

    def test_minimal_entry(self):
        e = EducationEntry(institution="MIT", degree="PhD")
        assert e['degree'] == "PhD"


class TestSkillGroup:
    def test_basic_group(self):
        sg = SkillGroup(category="Technical", skills=["Python", "Go"])
        assert sg['category'] == "Technical"
        assert len(sg['skills']) == 2

    def test_empty_skills(self):
        sg = SkillGroup(category="Empty", skills=[])
        assert sg['skills'] == []


class TestParsedCV:
    def test_full_cv(self):
        cv = ParsedCV(
            contact=ContactInfo(name="John"),
            work_history=[],
            education=[],
            skills=[],
            certifications=[],
            languages=[],
            other_sections={},
            raw_text="test",
            section_order=["summary"],
            parse_confidence=0.8,
            warnings=[],
        )
        assert cv['raw_text'] == "test"
        assert cv['parse_confidence'] == 0.8

    def test_minimal_cv(self):
        cv: ParsedCV = {"raw_text": "hello"}
        assert cv['raw_text'] == "hello"

    def test_cv_missing_optional_fields(self):
        cv: ParsedCV = {}
        assert cv.get('contact') is None
        assert cv.get('warnings') is None
