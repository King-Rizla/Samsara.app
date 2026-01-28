"""
PDF redaction module using PyMuPDF.

Provides text redaction functionality for CV anonymization with three modes:
- full: No redaction, return original PDF
- client: Redact phone and email (anti-backdoor protection)
- punt: Redact phone, email, AND name (fully anonymous)

Redacted text is physically removed from the PDF (not just overlaid),
leaving blank white space where the contact info was.
"""

import pymupdf
from typing import Optional


def create_redacted_cv(
    source_path: str,
    contact_info: dict,
    mode: str = 'client'
) -> bytes:
    """
    Create a redacted version of a CV PDF.

    Args:
        source_path: Path to the source PDF file
        contact_info: Dict with contact fields (name, email, phone, etc.)
        mode: Redaction mode
            - 'full': No redaction, return original bytes
            - 'client': Remove phone and email only
            - 'punt': Remove phone, email, AND name

    Returns:
        bytes: The redacted PDF as bytes

    Raises:
        FileNotFoundError: If source_path doesn't exist
        ValueError: If mode is not one of 'full', 'client', 'punt'
    """
    # Validate mode
    valid_modes = ('full', 'client', 'punt')
    if mode not in valid_modes:
        raise ValueError(f"Invalid mode '{mode}'. Must be one of: {valid_modes}")

    # Open the document
    doc = pymupdf.open(source_path)

    try:
        # Full mode: no redaction needed
        if mode == 'full':
            output = doc.tobytes()
            return output

        # Build list of text strings to redact
        fields_to_redact: list[str] = []

        # Client and Punt modes: redact phone and email
        phone = contact_info.get('phone')
        if phone and isinstance(phone, str) and phone.strip():
            fields_to_redact.append(phone.strip())

        email = contact_info.get('email')
        if email and isinstance(email, str) and email.strip():
            fields_to_redact.append(email.strip())

        # Punt mode: also redact name
        if mode == 'punt':
            name = contact_info.get('name')
            if name and isinstance(name, str) and name.strip():
                fields_to_redact.append(name.strip())

        # Apply redactions to all pages
        for page in doc:
            for text in fields_to_redact:
                if not text:
                    continue

                # Find all instances of the text on this page
                instances = page.search_for(text)

                for rect in instances:
                    # Add redaction annotation with white fill
                    # (1, 1, 1) = white RGB = blank space, not black bars
                    page.add_redact_annot(rect, fill=(1, 1, 1))

            # Apply all redactions on this page
            # This physically removes the text from the PDF (not just overlay)
            page.apply_redactions()

        # Return the redacted PDF as bytes
        output = doc.tobytes()
        return output

    finally:
        # Always close the document to prevent resource leaks
        doc.close()
