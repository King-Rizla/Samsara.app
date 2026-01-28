"""
Shared test fixtures for Samsara Python test suite.

Provides sample CV text, edge case corpus, mock paths, and temp file helpers.
"""
import os
import sys
import tempfile

import pytest

# Ensure python-src is on the import path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


@pytest.fixture
def sample_cv_text():
    """Multi-paragraph realistic CV text with contact, work, education, skills."""
    return """John Smith
123 High Street, London, EC1A 1BB
john.smith@example.com
+44 7700 900123
linkedin.com/in/johnsmith
github.com/johnsmith

SUMMARY
Experienced software engineer with 10+ years of expertise in full-stack
development, cloud infrastructure, and team leadership.

WORK EXPERIENCE

Senior Software Engineer at TechCorp Ltd
January 2020 - Present
- Led migration of monolith to microservices architecture
- Managed team of 5 developers
- Reduced deployment time by 60%

Software Developer - DataFlow Inc
June 2016 - December 2019
- Built real-time data processing pipeline
- Implemented CI/CD with Jenkins and Docker
- Mentored junior developers

Junior Developer at StartupXYZ
March 2014 - May 2016
- Developed REST APIs using Python and Flask
- Wrote unit tests achieving 90% coverage

EDUCATION

BSc Computer Science
University of London
2010 - 2014
First Class Honours

SKILLS

Technical Skills:
Python, JavaScript, TypeScript, Go, SQL, Docker, Kubernetes, AWS, React, Node.js

Soft Skills:
Team Leadership, Communication, Problem Solving

Languages:
English (Native), French (Conversational)

CERTIFICATIONS
AWS Solutions Architect Associate
Kubernetes Certified Developer

REFERENCES
Available on request
"""


@pytest.fixture
def edge_case_strings():
    """Adversarial strings for fuzz/edge-case testing."""
    return [
        None,
        "",
        " ",
        "\n",
        "\t",
        "\x00",
        "\ufeff",  # BOM
        "a" * 100000,  # huge input
        "<script>alert('xss')</script>",
        "'; DROP TABLE users; --",
        "../../../etc/passwd",
        "..\\..\\..\\windows\\system32",
        "CON",  # Windows reserved name
        "NUL",
        "COM1",
        "\ud800",  # lone surrogate (may raise on some ops)
        "\r\n\r\n",
        "   \n   \n   ",
        "\u200b\u200b\u200b",  # zero-width spaces
        "\U0001f600" * 100,  # emoji flood
        "name@email.com" * 500,  # repeated pattern
        "A" * 0,
        "\x0b\x0c\x1c\x1d\x1e\x1f",  # control chars
    ]


@pytest.fixture
def sample_contact_block():
    """Text block with name, phone, email, address."""
    return """Jane Doe
456 Oxford Road, Manchester, M1 2AB
jane.doe@gmail.com
07700 123456
linkedin.com/in/janedoe"""


@pytest.fixture
def tmp_pdf_path(tmp_path):
    """Create a minimal valid PDF file for parser testing."""
    pdf_bytes = (
        b"%PDF-1.4\n"
        b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
        b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
        b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n"
        b"4 0 obj\n<< /Length 44 >>\nstream\nBT /F1 12 Tf 100 700 Td (Hello World) Tj ET\nendstream\nendobj\n"
        b"5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n"
        b"xref\n0 6\n"
        b"0000000000 65535 f \n"
        b"0000000009 00000 n \n"
        b"0000000058 00000 n \n"
        b"0000000115 00000 n \n"
        b"0000000266 00000 n \n"
        b"0000000360 00000 n \n"
        b"trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n441\n%%EOF\n"
    )
    pdf_file = tmp_path / "test.pdf"
    pdf_file.write_bytes(pdf_bytes)
    return str(pdf_file)


@pytest.fixture
def tmp_empty_file(tmp_path):
    """Create an empty file."""
    f = tmp_path / "empty.pdf"
    f.write_bytes(b"")
    return str(f)


@pytest.fixture
def tmp_text_as_pdf(tmp_path):
    """Create a text file with .pdf extension (invalid PDF)."""
    f = tmp_path / "fake.pdf"
    f.write_text("This is not a PDF file", encoding="utf-8")
    return str(f)
