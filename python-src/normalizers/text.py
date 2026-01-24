"""
Text normalization utilities.

Provides text cleaning, whitespace normalization, and line extraction.
"""
import re
import unicodedata
from typing import List


def normalize_text(text: str) -> str:
    """
    Normalize Unicode text using NFKC normalization.

    This converts compatibility characters to their canonical equivalents:
    - Ligatures (fi -> fi)
    - Superscripts/subscripts to regular characters
    - Full-width characters to half-width
    - Various Unicode punctuation to ASCII equivalents

    Args:
        text: Text to normalize

    Returns:
        Unicode-normalized text
    """
    if not text:
        return ""

    return unicodedata.normalize('NFKC', text)


def clean_whitespace(text: str) -> str:
    """
    Collapse multiple spaces and newlines to single spaces.

    Trims leading/trailing whitespace.

    Args:
        text: Text to clean

    Returns:
        Text with normalized whitespace
    """
    if not text:
        return ""

    # Replace multiple whitespace (including newlines) with single space
    cleaned = re.sub(r'\s+', ' ', text)
    return cleaned.strip()


def extract_lines(text: str) -> List[str]:
    """
    Split text into lines and strip each line.

    Empty lines are preserved as empty strings.

    Args:
        text: Text to split

    Returns:
        List of stripped lines
    """
    if not text:
        return []

    lines = text.split('\n')
    return [line.strip() for line in lines]


def normalize_bullets(text: str) -> str:
    """
    Normalize various bullet characters to standard dash.

    Handles:
    - Unicode bullets
    - Em/en dashes at line start
    - Asterisks

    Args:
        text: Text with potential bullet points

    Returns:
        Text with normalized bullet characters
    """
    if not text:
        return ""

    # Bullet characters to normalize
    bullets = [
        '\u2022',  # bullet
        '\u2023',  # triangular bullet
        '\u2043',  # hyphen bullet
        '\u204c',  # black leftwards bullet
        '\u204d',  # black rightwards bullet
        '\u2219',  # bullet operator
        '\u25aa',  # black small square
        '\u25ab',  # white small square
        '\u25cf',  # black circle
        '\u25cb',  # white circle
        '\u25e6',  # white bullet
        '\u2013',  # en dash (when at line start)
        '\u2014',  # em dash (when at line start)
        '*',       # asterisk
    ]

    lines = text.split('\n')
    normalized = []

    for line in lines:
        stripped = line.lstrip()
        if stripped:
            first_char = stripped[0]
            if first_char in bullets:
                # Replace bullet with dash
                line = line.replace(first_char, '-', 1)
        normalized.append(line)

    return '\n'.join(normalized)
