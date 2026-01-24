"""
Date normalization utilities.

Normalizes various date formats to British dd/mm/yyyy format.
"""
import re
from datetime import datetime
from typing import Optional
from dateutil.parser import parse, ParserError


# Words that indicate "present" employment
PRESENT_WORDS = {'present', 'current', 'now', 'ongoing', 'today'}


def _is_month_year_only(date_str: str) -> bool:
    """
    Check if the date string is just month and year (no day).

    Examples: "January 2020", "Jan 2020", "2020-01"
    """
    # Match patterns like "Month Year", "Mon Year", or "YYYY-MM"
    patterns = [
        r'^[A-Za-z]+\s+\d{4}$',          # "January 2020" or "Jan 2020"
        r'^\d{4}-\d{1,2}$',               # "2020-01" or "2020-1"
        r'^\d{1,2}/\d{4}$',               # "01/2020" or "1/2020"
    ]
    cleaned = date_str.strip()
    for pattern in patterns:
        if re.match(pattern, cleaned, re.IGNORECASE):
            return True
    return False


def normalize_date(date_str: str) -> Optional[str]:
    """
    Normalize a date string to dd/mm/yyyy British format.

    Handles:
    - ISO format: "2020-01-15" -> "15/01/2020"
    - Month year: "January 2020" -> "01/01/2020"
    - Abbreviated: "Jan 2020" -> "01/01/2020"
    - British format: "3/2/2020" -> "03/02/2020" (3rd Feb, dayfirst=True)
    - Present indicators: "Present", "Current", "Now" -> "Present"
    - En/em dashes converted to hyphens

    Args:
        date_str: The date string to normalize

    Returns:
        Normalized date string in dd/mm/yyyy format, "Present", or
        original string if unparseable
    """
    if not date_str or not isinstance(date_str, str):
        return None

    # Clean up the string
    cleaned = date_str.strip()

    # Check for present indicators
    if cleaned.lower() in PRESENT_WORDS:
        return "Present"

    # Convert en-dash and em-dash to hyphen
    cleaned = cleaned.replace('\u2013', '-').replace('\u2014', '-')

    # Remove any leading/trailing non-alphanumeric characters
    cleaned = re.sub(r'^[^\w]+|[^\w]+$', '', cleaned)

    if not cleaned:
        return None

    # Check again for present after cleanup
    if cleaned.lower() in PRESENT_WORDS:
        return "Present"

    try:
        # Check if this is a month-year only format (no day specified)
        month_year_only = _is_month_year_only(cleaned)

        # Parse with dayfirst=True for British date format
        # Use default=datetime(1900, 1, 1) to default missing day to 1st
        default_date = datetime(1900, 1, 1) if month_year_only else None
        parsed = parse(cleaned, dayfirst=True, fuzzy=True, default=default_date)

        # For month-year only, ensure day is 01
        if month_year_only:
            parsed = parsed.replace(day=1)

        return parsed.strftime('%d/%m/%Y')
    except (ParserError, ValueError, OverflowError):
        # Return original if unparseable
        return date_str.strip()


def extract_date_range(text: str) -> tuple[Optional[str], Optional[str]]:
    """
    Extract start and end dates from a date range string.

    Handles formats like:
    - "Jan 2020 - Dec 2022"
    - "2020-2022"
    - "January 2020 to Present"
    - "2020 - current"

    Args:
        text: Text potentially containing a date range

    Returns:
        Tuple of (start_date, end_date), both normalized or None if not found
    """
    if not text:
        return None, None

    # Convert en-dash and em-dash to hyphen
    text = text.replace('\u2013', '-').replace('\u2014', '-')

    # Split on common separators
    separators = [' - ', ' to ', ' until ', ' through ', '-']

    parts = None
    for sep in separators:
        if sep in text:
            parts = text.split(sep, 1)
            break

    if parts and len(parts) == 2:
        start = normalize_date(parts[0].strip())
        end = normalize_date(parts[1].strip())
        return start, end

    # Single date - treat as start date
    single = normalize_date(text)
    if single and single != text.strip():
        return single, None

    return None, None
