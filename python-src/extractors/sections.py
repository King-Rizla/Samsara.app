"""
CV section detection and extraction.

Identifies common CV sections (experience, education, skills, etc.)
by their headings.
"""
import re
from typing import List, Tuple, Optional, Dict


# Section heading patterns - compiled for efficiency
# Each pattern matches common variations of section headings
SECTION_PATTERNS: Dict[str, re.Pattern] = {
    'experience': re.compile(
        r'^(?:work\s*)?(?:experience|employment|career|professional\s*background|work\s*history)s?\b',
        re.IGNORECASE | re.MULTILINE
    ),
    'education': re.compile(
        r'^(?:education|academic|qualifications?|degrees?)\b',
        re.IGNORECASE | re.MULTILINE
    ),
    'skills': re.compile(
        r'^(?:skills?|technical\s*skills?|core\s*skills?|key\s*skills?|competenc(?:y|ies)|expertise)\b',
        re.IGNORECASE | re.MULTILINE
    ),
    'certifications': re.compile(
        r'^(?:certifications?|certificates?|professional\s*development|accreditations?|licenses?)\b',
        re.IGNORECASE | re.MULTILINE
    ),
    'languages': re.compile(
        r'^(?:languages?|language\s*skills?)\b',
        re.IGNORECASE | re.MULTILINE
    ),
    'publications': re.compile(
        r'^(?:publications?|papers?|research|articles?)\b',
        re.IGNORECASE | re.MULTILINE
    ),
    'volunteer': re.compile(
        r'^(?:volunteer(?:ing)?|community|charitable|civic)\b',
        re.IGNORECASE | re.MULTILINE
    ),
    'projects': re.compile(
        r'^(?:projects?|personal\s*projects?|portfolio)\b',
        re.IGNORECASE | re.MULTILINE
    ),
    'summary': re.compile(
        r'^(?:summary|profile|objective|about(?:\s*me)?|personal\s*statement|career\s*objective|professional\s*summary)\b',
        re.IGNORECASE | re.MULTILINE
    ),
    'interests': re.compile(
        r'^(?:interests?|hobbies|activities|personal\s*interests?)\b',
        re.IGNORECASE | re.MULTILINE
    ),
    'references': re.compile(
        r'^(?:references?|referees?)\b',
        re.IGNORECASE | re.MULTILINE
    ),
    'awards': re.compile(
        r'^(?:awards?|honors?|honours?|achievements?|recognition)\b',
        re.IGNORECASE | re.MULTILINE
    ),
}


def _find_section_boundaries(text: str, section_starts: List[Tuple[str, int]]) -> List[Tuple[str, int, int]]:
    """
    Convert section start positions to (name, start, end) tuples.

    Each section ends where the next one begins, or at text end.
    """
    if not section_starts:
        return []

    # Sort by position
    sorted_sections = sorted(section_starts, key=lambda x: x[1])

    result = []
    for i, (name, start) in enumerate(sorted_sections):
        if i + 1 < len(sorted_sections):
            end = sorted_sections[i + 1][1]
        else:
            end = len(text)
        result.append((name, start, end))

    return result


def detect_sections(text: str) -> List[Tuple[str, int, int]]:
    """
    Detect CV sections and their boundaries.

    Searches for section headings using pattern matching and returns
    the section name, start position, and end position for each.

    Args:
        text: Raw CV text

    Returns:
        List of (section_name, start_char, end_char) tuples,
        sorted by start position
    """
    section_starts: List[Tuple[str, int]] = []

    for section_name, pattern in SECTION_PATTERNS.items():
        # Find all matches for this section type
        for match in pattern.finditer(text):
            # Check if this looks like a heading (standalone line or has colon)
            start = match.start()
            end = match.end()
            matched_text = match.group(0)

            # Look at context - is this at line start?
            # Find the actual line this is on
            line_start = text.rfind('\n', 0, start) + 1
            prefix = text[line_start:start].strip()

            # Accept if at line start (no text before) or minimal prefix
            if len(prefix) <= 2:  # Allow numbering like "1." or bullet
                # Find end of line for the heading
                line_end = text.find('\n', end)
                if line_end == -1:
                    line_end = len(text)

                # Section content starts after the heading line
                content_start = line_end + 1 if line_end < len(text) else line_end
                section_starts.append((section_name, content_start))

    # Convert to boundaries
    sections = _find_section_boundaries(text, section_starts)

    return sections


def get_section_text(text: str, sections: List[Tuple[str, int, int]], section_name: str) -> Optional[str]:
    """
    Extract text for a specific section.

    Args:
        text: Full CV text
        sections: Result from detect_sections()
        section_name: Name of section to extract (e.g., 'experience', 'education')

    Returns:
        Section text if found, None otherwise
    """
    for name, start, end in sections:
        if name == section_name:
            return text[start:end].strip()
    return None


def get_section_order(sections: List[Tuple[str, int, int]]) -> List[str]:
    """
    Get the order of sections as they appear in the CV.

    Args:
        sections: Result from detect_sections()

    Returns:
        List of section names in document order
    """
    return [name for name, _, _ in sections]
