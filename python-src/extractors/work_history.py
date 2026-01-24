"""
Work history extraction from CV text.

Extracts job entries with company, position, dates, and descriptions.
"""
import re
from typing import List, Optional

from schema.cv_schema import WorkEntry
from normalizers.dates import normalize_date, extract_date_range


# Date range patterns for work history
DATE_RANGE_PATTERN = re.compile(
    r'''
    (?:
        # Month Year - Month Year or Present
        (?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|
           Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*
        \d{4}\s*[-\u2013\u2014]\s*
        (?:(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|
            Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*
         \d{4}|Present|Current|Now|Ongoing)
    |
        # Year - Year or Present
        \d{4}\s*[-\u2013\u2014]\s*(?:\d{4}|Present|Current|Now|Ongoing)
    |
        # MM/YYYY - MM/YYYY
        \d{1,2}/\d{4}\s*[-\u2013\u2014]\s*(?:\d{1,2}/\d{4}|Present|Current|Now|Ongoing)
    )
    ''',
    re.VERBOSE | re.IGNORECASE
)

# Job title keywords (common titles that help identify position lines)
JOB_TITLE_KEYWORDS = [
    'engineer', 'developer', 'manager', 'director', 'analyst',
    'consultant', 'architect', 'lead', 'senior', 'junior',
    'specialist', 'coordinator', 'administrator', 'assistant',
    'executive', 'officer', 'head', 'chief', 'vice president', 'vp',
    'associate', 'intern', 'trainee', 'technician', 'designer',
    'scientist', 'researcher', 'professor', 'lecturer', 'teacher',
    'accountant', 'attorney', 'lawyer', 'nurse', 'doctor', 'therapist'
]

# Bullet point patterns
BULLET_PATTERN = re.compile(r'^[\u2022\u2023\u2043\u204c\u204d\u2219\u25aa\u25ab\u25cf\u25cb\u25e6\-\*]\s*', re.MULTILINE)


def _looks_like_job_title(text: str) -> bool:
    """Check if text looks like a job title."""
    text_lower = text.lower()
    return any(keyword in text_lower for keyword in JOB_TITLE_KEYWORDS)


def _looks_like_company(text: str, nlp) -> bool:
    """Check if text looks like a company name using NER."""
    doc = nlp(text)
    for ent in doc.ents:
        if ent.label_ == 'ORG':
            return True
    return False


def _extract_bullets(text: str) -> List[str]:
    """Extract bullet points from text."""
    lines = text.split('\n')
    bullets = []

    for line in lines:
        line = line.strip()
        if BULLET_PATTERN.match(line):
            # Remove bullet and clean
            cleaned = BULLET_PATTERN.sub('', line).strip()
            if cleaned:
                bullets.append(cleaned)

    return bullets


def _parse_work_block(block: str, nlp) -> Optional[WorkEntry]:
    """
    Parse a single work experience block into a WorkEntry.

    Attempts to identify company, position, dates, and description.
    """
    lines = [l.strip() for l in block.split('\n') if l.strip()]
    if not lines:
        return None

    entry: WorkEntry = {
        'company': '',
        'position': '',
        'start_date': None,
        'end_date': None,
        'description': '',
        'highlights': [],
        'confidence': 0.5
    }

    # Find date range in the block
    date_match = DATE_RANGE_PATTERN.search(block)
    if date_match:
        date_str = date_match.group(0)
        start, end = extract_date_range(date_str)
        entry['start_date'] = start
        entry['end_date'] = end

    # Process first few lines for company/position
    confidence_factors = []
    header_lines = lines[:3] if len(lines) >= 3 else lines

    for line in header_lines:
        # Skip if this is the date line
        if date_match and date_match.group(0) in line:
            continue

        # Check for common patterns like "Position at Company" or "Company - Position"
        if ' at ' in line.lower():
            parts = line.split(' at ', 1)
            if len(parts) == 2:
                # Could be "Position at Company"
                if _looks_like_job_title(parts[0]):
                    entry['position'] = parts[0].strip()
                    entry['company'] = parts[1].strip()
                    confidence_factors.append(0.9)
                    continue

        if ' - ' in line or ' | ' in line:
            # Could be "Company - Position" or "Position - Company"
            sep = ' - ' if ' - ' in line else ' | '
            parts = line.split(sep, 1)
            if len(parts) == 2:
                # Determine which is which
                if _looks_like_job_title(parts[0]):
                    entry['position'] = parts[0].strip()
                    entry['company'] = parts[1].strip()
                elif _looks_like_job_title(parts[1]):
                    entry['company'] = parts[0].strip()
                    entry['position'] = parts[1].strip()
                else:
                    # Assume Company - Position format
                    entry['company'] = parts[0].strip()
                    entry['position'] = parts[1].strip()
                confidence_factors.append(0.8)
                continue

        # If no pattern matched, try to classify the line
        if not entry['position'] and _looks_like_job_title(line):
            entry['position'] = line
            confidence_factors.append(0.7)
        elif not entry['company'] and _looks_like_company(line, nlp):
            entry['company'] = line
            confidence_factors.append(0.7)
        elif not entry['company'] and not entry['position']:
            # First unidentified line might be company or position
            # Use heuristics: shorter lines with capital words are likely company
            if len(line) < 50 and line[0].isupper():
                entry['company'] = line
                confidence_factors.append(0.5)

    # Extract highlights (bullet points)
    entry['highlights'] = _extract_bullets(block)

    # Remaining text is description
    desc_lines = []
    for line in lines:
        if line != entry['company'] and line != entry['position']:
            if not BULLET_PATTERN.match(line):
                if not (date_match and date_match.group(0) in line):
                    desc_lines.append(line)

    if desc_lines:
        entry['description'] = ' '.join(desc_lines[:5])  # Limit description length

    # Calculate confidence
    if entry['company'] and entry['position'] and entry['start_date']:
        entry['confidence'] = 0.9
    elif entry['company'] and entry['position']:
        entry['confidence'] = 0.7
    elif entry['company'] or entry['position']:
        entry['confidence'] = 0.5
    else:
        entry['confidence'] = 0.3

    return entry if (entry['company'] or entry['position']) else None


def extract_work_history(text: str, nlp) -> List[WorkEntry]:
    """
    Extract work history entries from CV text.

    Identifies job entries by date ranges and extracts company, position,
    dates, description, and highlights.

    Args:
        text: Work experience section text (or full CV text)
        nlp: Loaded spaCy model

    Returns:
        List of WorkEntry dicts with confidence scores
    """
    if not text:
        return []

    entries = []

    # Find all date ranges
    date_matches = list(DATE_RANGE_PATTERN.finditer(text))

    if not date_matches:
        # No date ranges found - try to split on blank lines
        blocks = re.split(r'\n\s*\n', text)
        for block in blocks:
            if block.strip():
                entry = _parse_work_block(block, nlp)
                if entry:
                    entries.append(entry)
    else:
        # Split text into blocks around date ranges
        for i, match in enumerate(date_matches):
            # Find the start of this entry (look backwards for company/position)
            start = match.start()
            # Look for previous blank line or start of text
            prev_blank = text.rfind('\n\n', 0, start)
            entry_start = prev_blank + 2 if prev_blank != -1 else 0

            # Find end (next date range or next blank line block)
            if i + 1 < len(date_matches):
                next_match = date_matches[i + 1]
                # Find the start of the next entry
                next_prev_blank = text.rfind('\n\n', 0, next_match.start())
                entry_end = next_prev_blank if next_prev_blank > match.end() else next_match.start()
            else:
                entry_end = len(text)

            block = text[entry_start:entry_end]
            entry = _parse_work_block(block, nlp)
            if entry:
                entries.append(entry)

    return entries
