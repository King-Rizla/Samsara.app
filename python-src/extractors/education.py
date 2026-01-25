"""
Education extraction from CV text.

Extracts education entries with institution, degree, field, and dates.
"""
import re
from typing import List, Optional, Tuple

from schema.cv_schema import EducationEntry
from normalizers.dates import normalize_date, extract_date_range
from extractors.llm.client import OllamaClient
from extractors.llm.schemas import LLMEducation
from extractors.llm.prompts import EDUCATION_PROMPT


# Degree patterns
DEGREE_KEYWORDS = [
    # Full forms
    'bachelor', 'master', 'doctor', 'doctorate', 'phd', 'ph.d',
    'diploma', 'certificate', 'associate', 'foundation',
    # Abbreviations
    'bsc', 'ba', 'beng', 'bba', 'bed', 'bfa', 'llb',
    'msc', 'ma', 'mba', 'meng', 'mphil', 'med', 'mfa', 'llm',
    'dphil', 'edd', 'dba',
    # UK specific
    'hnd', 'hnc', 'btec', 'nvq', 'gcse', 'a-level', 'a level',
    'bsc hons', 'ba hons', 'msc hons',
]

DEGREE_PATTERN = re.compile(
    r'\b(?:' + '|'.join(re.escape(d) for d in DEGREE_KEYWORDS) + r')\.?\b',
    re.IGNORECASE
)

# Grade patterns for UK education
GRADE_PATTERNS = [
    re.compile(r'\b(?:first\s*class|1st\s*class|first)\b', re.IGNORECASE),
    re.compile(r'\b(?:2:1|2\.1|upper\s*second)\b', re.IGNORECASE),
    re.compile(r'\b(?:2:2|2\.2|lower\s*second)\b', re.IGNORECASE),
    re.compile(r'\b(?:third|3rd)\b', re.IGNORECASE),
    re.compile(r'\b(?:pass|merit|distinction)\b', re.IGNORECASE),
    re.compile(r'\b(?:\d\.\d{1,2})\s*(?:gpa|cgpa)?\b', re.IGNORECASE),  # GPA
    re.compile(r'\bgpa\s*(?:of\s*)?\d\.\d{1,2}\b', re.IGNORECASE),  # GPA of X.X
]

# Date patterns for education
DATE_PATTERN = re.compile(
    r'''
    (?:
        # Year - Year
        (?:19|20)\d{2}\s*[-\u2013\u2014]\s*(?:(?:19|20)\d{2}|Present|Current|Ongoing)
    |
        # Month Year - Month Year
        (?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|
           Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*
        (?:19|20)\d{2}\s*[-\u2013\u2014]\s*
        (?:(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|
            Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*
         (?:19|20)\d{2}|Present|Current|Ongoing)
    |
        # Single year (graduation year)
        (?:graduated?\s*)?(?:19|20)\d{2}
    |
        # Class of YYYY
        class\s*of\s*(?:19|20)\d{2}
    )
    ''',
    re.VERBOSE | re.IGNORECASE
)


def _extract_degree(text: str) -> Optional[str]:
    """Extract degree type from text."""
    match = DEGREE_PATTERN.search(text)
    if match:
        # Get some context around the match
        start = max(0, match.start() - 20)
        end = min(len(text), match.end() + 50)
        context = text[start:end]

        # Try to get full degree name
        # Look for patterns like "BSc in Computer Science" or "Bachelor of Science"
        full_degree_match = re.search(
            r'(?:' + match.group(0) + r')(?:\s+(?:in|of)\s+[\w\s]+)?',
            context,
            re.IGNORECASE
        )
        if full_degree_match:
            return full_degree_match.group(0).strip()
        return match.group(0).upper()
    return None


def _extract_field_of_study(text: str, degree: Optional[str]) -> Optional[str]:
    """Extract field of study from text."""
    # Look for "in [Field]" or "[Field] degree"
    if degree:
        # Text after degree
        idx = text.lower().find(degree.lower())
        if idx != -1:
            after_degree = text[idx + len(degree):].strip()
            # Look for "in X" pattern
            in_match = re.match(r'^(?:\s*in\s+)?([\w\s&,]+?)(?:\s*[-\u2013\u2014,|]|\s*$)', after_degree, re.IGNORECASE)
            if in_match:
                field = in_match.group(1).strip()
                if len(field) > 2 and len(field) < 100:
                    return field

    # Look for common field patterns
    field_patterns = [
        r'(?:computer|software|data)\s+(?:science|engineering)',
        r'(?:business|marketing|finance|accounting|economics)',
        r'(?:electrical|mechanical|civil|chemical)\s+engineering',
        r'(?:mathematics|physics|chemistry|biology)',
        r'(?:psychology|sociology|history|english|law)',
        r'(?:information\s+technology|it)',
    ]
    for pattern in field_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(0).title()

    return None


def _extract_grade(text: str) -> Optional[str]:
    """Extract grade/classification from text."""
    for pattern in GRADE_PATTERNS:
        match = pattern.search(text)
        if match:
            return match.group(0).strip()
    return None


def _parse_education_block(block: str, nlp) -> Optional[EducationEntry]:
    """Parse a single education block into an EducationEntry."""
    if not block.strip():
        return None

    entry: EducationEntry = {
        'institution': '',
        'degree': '',
        'field_of_study': None,
        'start_date': None,
        'end_date': None,
        'grade': None,
        'confidence': 0.5
    }

    # Extract degree
    degree = _extract_degree(block)
    if degree:
        entry['degree'] = degree

    # Extract field of study
    field = _extract_field_of_study(block, degree)
    if field:
        entry['field_of_study'] = field

    # Extract dates
    date_match = DATE_PATTERN.search(block)
    if date_match:
        date_str = date_match.group(0)
        # Check if it's a range or single year
        if any(sep in date_str for sep in ['-', '\u2013', '\u2014']):
            start, end = extract_date_range(date_str)
            entry['start_date'] = start
            entry['end_date'] = end
        else:
            # Single year - treat as graduation/end date
            year_match = re.search(r'((?:19|20)\d{2})', date_str)
            if year_match:
                entry['end_date'] = normalize_date(year_match.group(1))

    # Extract grade
    grade = _extract_grade(block)
    if grade:
        entry['grade'] = grade

    # Find institution using NER
    lines = [l.strip() for l in block.split('\n') if l.strip()]
    doc = nlp(block)

    # Look for ORG entities that might be institutions
    for ent in doc.ents:
        if ent.label_ == 'ORG':
            org_text = ent.text.strip()
            # Check if it looks like an educational institution
            if any(kw in org_text.lower() for kw in ['university', 'college', 'school', 'institute', 'academy']):
                entry['institution'] = org_text
                break
            # Even if not explicit, first ORG might be institution
            if not entry['institution']:
                entry['institution'] = org_text

    # If no ORG found, try heuristics on first lines
    if not entry['institution']:
        for line in lines[:2]:
            if 'university' in line.lower() or 'college' in line.lower():
                # Clean up the line
                entry['institution'] = line.strip()
                break

    # Calculate confidence
    confidence_score = 0.0
    if entry['institution']:
        confidence_score += 0.3
    if entry['degree']:
        confidence_score += 0.3
    if entry['start_date'] or entry['end_date']:
        confidence_score += 0.2
    if entry['field_of_study']:
        confidence_score += 0.1
    if entry['grade']:
        confidence_score += 0.1

    entry['confidence'] = round(min(confidence_score, 1.0), 2)

    # Only return if we have meaningful data
    if entry['institution'] or entry['degree']:
        return entry
    return None


def extract_education(text: str, nlp) -> List[EducationEntry]:
    """
    Extract education entries from CV text.

    Identifies education entries by degree keywords and institution names,
    extracting degree, field of study, dates, and grade.

    Args:
        text: Education section text (or full CV text)
        nlp: Loaded spaCy model

    Returns:
        List of EducationEntry dicts with confidence scores
    """
    if not text:
        return []

    entries = []

    # Try to split into education blocks
    # Look for degree keywords as block separators
    degree_positions = [(m.start(), m.group(0)) for m in DEGREE_PATTERN.finditer(text)]

    if not degree_positions:
        # No degree keywords - try splitting on blank lines
        blocks = re.split(r'\n\s*\n', text)
        for block in blocks:
            entry = _parse_education_block(block, nlp)
            if entry:
                entries.append(entry)
    else:
        # Split around degree positions
        for i, (pos, _) in enumerate(degree_positions):
            # Find block boundaries
            # Start: previous blank line or previous degree, or start of text
            start = 0
            prev_blank = text.rfind('\n\n', 0, pos)
            if i > 0:
                prev_deg_pos = degree_positions[i - 1][0]
                # Find end of previous entry
                next_blank_after_prev = text.find('\n\n', prev_deg_pos)
                if next_blank_after_prev != -1 and next_blank_after_prev < pos:
                    start = next_blank_after_prev + 2
                else:
                    start = prev_blank + 2 if prev_blank > prev_deg_pos else prev_deg_pos
            elif prev_blank != -1:
                start = prev_blank + 2

            # End: next blank line or next degree
            end = len(text)
            next_blank = text.find('\n\n', pos)
            if i + 1 < len(degree_positions):
                next_deg_pos = degree_positions[i + 1][0]
                prev_blank_before_next = text.rfind('\n\n', 0, next_deg_pos)
                if prev_blank_before_next > pos:
                    end = prev_blank_before_next
                else:
                    end = next_deg_pos
            elif next_blank != -1:
                end = next_blank

            block = text[start:end]
            entry = _parse_education_block(block, nlp)
            if entry:
                # Check for duplicate
                is_dup = any(
                    e['institution'] == entry['institution'] and e['degree'] == entry['degree']
                    for e in entries
                )
                if not is_dup:
                    entries.append(entry)

    return entries


def extract_education_hybrid(
    text: str,
    nlp,
    llm_client: Optional[OllamaClient] = None
) -> Tuple[List[EducationEntry], dict]:
    """
    Extract education with LLM, fallback to regex.

    Returns:
        Tuple of (entries, metadata with method/llm_available)
    """
    metadata = {"method": "regex", "llm_available": False}

    # Try LLM extraction first
    if llm_client and llm_client.is_available():
        metadata["llm_available"] = True

        llm_result = llm_client.extract(
            text=text,
            prompt=EDUCATION_PROMPT,
            schema=LLMEducation,
            temperature=0.0
        )

        if llm_result and llm_result.entries:
            entries = []
            for e in llm_result.entries:
                entry = _llm_to_education_entry(e)
                if _validate_education_entry(entry):
                    entries.append(entry)

            if entries:
                metadata["method"] = "llm"
                return entries, metadata

    # Fallback to regex/NER
    entries = extract_education(text, nlp)
    return entries, metadata


def _llm_to_education_entry(llm_entry) -> EducationEntry:
    """Convert LLM output to schema EducationEntry."""
    return EducationEntry(
        institution=llm_entry.institution or '',
        degree=llm_entry.degree or '',
        field_of_study=llm_entry.field_of_study,
        start_date=normalize_date(llm_entry.start_date) if llm_entry.start_date else None,
        end_date=normalize_date(llm_entry.end_date) if llm_entry.end_date else None,
        grade=llm_entry.grade,
        confidence=0.85  # Higher confidence for LLM extraction
    )


def _validate_education_entry(entry: EducationEntry) -> bool:
    """Validate extracted education entry has minimum required data."""
    if not entry.get('institution') and not entry.get('degree'):
        return False
    return True
