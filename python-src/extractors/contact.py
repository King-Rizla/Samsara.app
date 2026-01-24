"""
Contact information extraction from CV text.

Uses spaCy NER for names and GPE (locations), regex for structured patterns
(email, phone, URL).
"""
import re
from typing import Tuple, List, Optional

from schema.cv_schema import ContactInfo


# Email pattern - comprehensive but not overly complex
EMAIL_PATTERN = re.compile(
    r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
    re.IGNORECASE
)

# UK phone patterns and international
# UK formats: +44, 0044, 07xxx, 01xxx, 02xxx
# International: +1, +33, etc.
PHONE_PATTERN = re.compile(
    r'''
    (?:
        # UK mobile with country code
        (?:\+44|0044)\s*7\d{3}\s*\d{3}\s*\d{3}|
        # UK mobile without country code
        07\d{3}\s*\d{3}\s*\d{3}|
        # UK landline with country code
        (?:\+44|0044)\s*[12]\d{2,3}\s*\d{3}\s*\d{3,4}|
        # UK landline without country code
        0[12]\d{2,3}\s*\d{3}\s*\d{3,4}|
        # International format with + and country code
        \+\d{1,3}[-.\s]?\d{3,4}[-.\s]?\d{3,4}[-.\s]?\d{2,4}|
        # Generic phone number (7+ digits with separators)
        \(?\d{3,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}
    )
    ''',
    re.VERBOSE
)

# LinkedIn URL pattern
LINKEDIN_PATTERN = re.compile(
    r'(?:https?://)?(?:www\.)?linkedin\.com/in/[\w-]+/?',
    re.IGNORECASE
)

# GitHub URL pattern
GITHUB_PATTERN = re.compile(
    r'(?:https?://)?(?:www\.)?github\.com/[\w-]+/?',
    re.IGNORECASE
)

# Generic portfolio/website URL pattern
URL_PATTERN = re.compile(
    r'(?:https?://)?(?:www\.)?[a-zA-Z0-9][\w.-]*\.[a-zA-Z]{2,}(?:/[\w./-]*)?',
    re.IGNORECASE
)

# Company indicators to filter from person names
COMPANY_INDICATORS = {
    'ltd', 'limited', 'inc', 'incorporated', 'corp', 'corporation',
    'llc', 'llp', 'plc', 'gmbh', 'ag', 'sa', 'srl', 'bv',
    'company', 'co', 'group', 'holdings', 'partners', 'consulting'
}


def _is_likely_company(name: str) -> bool:
    """Check if a name contains company indicators."""
    name_lower = name.lower()
    for indicator in COMPANY_INDICATORS:
        if indicator in name_lower.split():
            return True
        # Check for patterns like "Co." or "Inc."
        if f'{indicator}.' in name_lower or f'{indicator},' in name_lower:
            return True
    return False


def _extract_emails(text: str) -> List[str]:
    """Extract all email addresses from text."""
    return EMAIL_PATTERN.findall(text)


def _extract_phones(text: str) -> List[str]:
    """Extract all phone numbers from text."""
    phones = PHONE_PATTERN.findall(text)
    # Clean up: remove extra whitespace
    return [re.sub(r'\s+', ' ', p.strip()) for p in phones]


def _extract_linkedin(text: str) -> Optional[str]:
    """Extract LinkedIn profile URL."""
    match = LINKEDIN_PATTERN.search(text)
    if match:
        url = match.group(0)
        # Ensure https prefix
        if not url.startswith('http'):
            url = 'https://' + url
        return url
    return None


def _extract_github(text: str) -> Optional[str]:
    """Extract GitHub profile URL."""
    match = GITHUB_PATTERN.search(text)
    if match:
        url = match.group(0)
        # Ensure https prefix
        if not url.startswith('http'):
            url = 'https://' + url
        return url
    return None


def _extract_portfolio(text: str, linkedin: Optional[str], github: Optional[str]) -> Optional[str]:
    """Extract portfolio/website URL (excluding LinkedIn and GitHub)."""
    urls = URL_PATTERN.findall(text)
    for url in urls:
        url_lower = url.lower()
        # Skip LinkedIn, GitHub, and common non-portfolio sites
        if 'linkedin.com' in url_lower or 'github.com' in url_lower:
            continue
        if any(skip in url_lower for skip in ['google.com', 'facebook.com', 'twitter.com', 'instagram.com']):
            continue
        # Skip email domains
        if '@' in url:
            continue
        # Return first likely portfolio URL
        if not url.startswith('http'):
            url = 'https://' + url
        return url
    return None


def extract_contacts(text: str, nlp) -> Tuple[ContactInfo, float]:
    """
    Extract contact information from CV text.

    Uses spaCy NER for names (PERSON entity) and locations (GPE entity),
    regex for email, phone, LinkedIn, GitHub, and other URLs.

    Args:
        text: Raw CV text (use first ~2000 chars for efficiency)
        nlp: Loaded spaCy model

    Returns:
        Tuple of (ContactInfo dict, confidence score)
        Confidence: 1.0 if multiple sources agree, 0.7 single source, 0.5 ambiguous
    """
    contact: ContactInfo = {}
    confidence_factors = []

    # Extract structured patterns first
    emails = _extract_emails(text)
    if emails:
        contact['email'] = emails[0]  # Take first email
        confidence_factors.append(1.0)  # Email is very reliable

    phones = _extract_phones(text)
    if phones:
        contact['phone'] = phones[0]  # Take first phone
        confidence_factors.append(0.9)  # Phone is reliable

    linkedin = _extract_linkedin(text)
    if linkedin:
        contact['linkedin'] = linkedin
        confidence_factors.append(0.9)

    github = _extract_github(text)
    if github:
        contact['github'] = github
        confidence_factors.append(0.9)

    portfolio = _extract_portfolio(text, linkedin, github)
    if portfolio:
        contact['portfolio'] = portfolio
        confidence_factors.append(0.7)

    # Use spaCy NER for name and location
    # Process only first 2000 chars for efficiency (contact info is at top)
    doc = nlp(text[:2000])

    # Find PERSON entity for name
    person_entities = [ent.text for ent in doc.ents if ent.label_ == 'PERSON']
    for person in person_entities:
        # Skip if it looks like a company name
        if not _is_likely_company(person):
            contact['name'] = person.strip()
            confidence_factors.append(0.8)  # NER name is fairly reliable
            break

    # Find GPE (location) entity for address
    gpe_entities = [ent.text for ent in doc.ents if ent.label_ == 'GPE']
    if gpe_entities:
        contact['address'] = gpe_entities[0]  # Take first location
        confidence_factors.append(0.6)  # Location is less reliable

    # Calculate overall confidence
    if not confidence_factors:
        confidence = 0.0
    elif len(confidence_factors) >= 3:
        confidence = 1.0  # Multiple fields found - high confidence
    elif len(confidence_factors) == 2:
        confidence = sum(confidence_factors) / len(confidence_factors)
    else:
        confidence = 0.7 if confidence_factors[0] >= 0.8 else 0.5

    return contact, round(confidence, 2)
