# Phase 5: Anonymization & Branding - Research

**Researched:** 2026-01-26
**Domain:** PDF generation, text redaction, templating
**Confidence:** HIGH

## Summary

Phase 5 adds export functionality with three capabilities: text redaction (removing PII from existing PDFs), blind profile generation (one-page summary front sheet), and branded PDF output. The research confirms PyMuPDF (already in the project) handles redaction natively, while ReportLab is the standard choice for generating new PDF content like the blind profile page. Both libraries are mature, fast, and well-documented.

The key insight is that redaction and generation are separate concerns handled by different libraries:
- **Redaction (removing text)**: PyMuPDF's `add_redact_annot()` + `apply_redactions()` removes text from existing PDFs
- **Generation (creating new pages)**: ReportLab's Platypus creates the blind profile front sheet with theming
- **Merging**: PyMuPDF's `insert_pdf()` combines the generated front sheet with the (redacted) original CV

**Primary recommendation:** Use PyMuPDF for redaction and merging, ReportLab for blind profile generation. Keep theme.json simple (colors as hex strings, font names, logo path). Target is easily achievable since ReportLab generates PDFs in milliseconds and PyMuPDF operations are sub-second.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| PyMuPDF (pymupdf) | 1.26.7 (already installed) | Redact text, merge PDFs | Already in project; native redaction API; 20x faster than alternatives |
| ReportLab | 4.4.x | Generate blind profile front sheet | Industry standard for programmatic PDF creation; used by Wikipedia; has C extension for speed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Pillow | (transitive) | Image handling for logos | ReportLab uses it internally; may need explicit import for logo preprocessing |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ReportLab | FPDF2 | Simpler API but less control over layout/styling; no tables |
| ReportLab | WeasyPrint | HTML-to-PDF approach; slower; heavier dependencies |
| PyMuPDF redaction | Manual text removal | PyMuPDF handles edge cases (overlapping images, vector graphics) |

**Installation:**
```bash
pip install reportlab
# PyMuPDF already installed (requirements.txt)
```

## Architecture Patterns

### Recommended Project Structure
```
python-src/
├── export/
│   ├── __init__.py           # Module exports
│   ├── redaction.py          # Text removal from PDFs (PyMuPDF)
│   ├── blind_profile.py      # Front sheet generation (ReportLab)
│   ├── theme.py              # Theme loading and validation
│   └── pdf_output.py         # Merge + final output coordination
├── main.py                   # Add 'export_cv' action handler
```

### Pattern 1: Two-Step Redaction (PyMuPDF)
**What:** Mark areas for redaction, then apply all at once
**When to use:** Always - this is how PyMuPDF redaction works
**Example:**
```python
# Source: PyMuPDF documentation
import pymupdf

def redact_contact_info(input_path: str, output_path: str, fields_to_redact: list[str]):
    """
    Redact specified text from PDF.
    fields_to_redact: list of exact text strings to remove (e.g., phone, email)
    """
    doc = pymupdf.open(input_path)

    for page in doc:
        for text in fields_to_redact:
            # Find all instances of the text
            instances = page.search_for(text)
            for rect in instances:
                # Add redaction annotation (marks area for removal)
                page.add_redact_annot(rect, fill=(1, 1, 1))  # White fill = blank

        # Apply all redactions on this page
        # This physically removes the text from the PDF
        page.apply_redactions()

    doc.save(output_path)
    doc.close()
```

### Pattern 2: Blind Profile with Platypus (ReportLab)
**What:** Build document using flowables (Paragraph, Table, Spacer, Image)
**When to use:** For generating the front sheet
**Example:**
```python
# Source: ReportLab Platypus documentation
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from io import BytesIO

def generate_blind_profile(cv_data: dict, theme: dict) -> bytes:
    """Generate blind profile front sheet as PDF bytes."""
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=20*mm,
        bottomMargin=20*mm,
        leftMargin=15*mm,
        rightMargin=15*mm
    )

    # Build story (list of flowables)
    story = []

    # Custom styles from theme
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'Title',
        parent=styles['Heading1'],
        textColor=colors.HexColor(theme.get('primary_color', '#000000')),
        fontSize=18,
        spaceAfter=12
    )

    # Header: Name/Candidate, Location, Date
    story.append(Paragraph(cv_data.get('name', 'Candidate'), title_style))
    story.append(Spacer(1, 6*mm))

    # Skills list
    # ... (add skills table)

    # Work history (last 3 jobs)
    # ... (add work entries)

    # Build PDF
    doc.build(story)
    return buffer.getvalue()
```

### Pattern 3: PDF Merging (PyMuPDF)
**What:** Insert generated front sheet before original CV
**When to use:** After generating blind profile
**Example:**
```python
# Source: PyMuPDF documentation
import pymupdf

def merge_with_front_sheet(front_sheet_bytes: bytes, cv_path: str, output_path: str):
    """Combine blind profile front sheet with CV."""
    # Create document from front sheet bytes
    front_doc = pymupdf.open(stream=front_sheet_bytes, filetype="pdf")

    # Open the CV
    cv_doc = pymupdf.open(cv_path)

    # Insert front sheet at the beginning
    front_doc.insert_pdf(cv_doc)  # Appends cv_doc pages to front_doc

    # Save combined document
    front_doc.save(output_path)

    front_doc.close()
    cv_doc.close()
```

### Pattern 4: Theme Configuration (JSON)
**What:** Simple JSON file defining branding elements
**When to use:** Load once at export time
**Example:**
```json
{
  "primary_color": "#6B21A8",
  "secondary_color": "#374151",
  "header_font": "Helvetica-Bold",
  "body_font": "Helvetica",
  "logo_path": "resources/client_logo.png",
  "company_name": "TechRecruit Ltd"
}
```

### Anti-Patterns to Avoid
- **Modifying original PDF in place:** Always work on a copy; never modify the user's source file
- **Re-parsing for export:** Use already-extracted data from SQLite, not re-parsing the PDF
- **Blocking UI during export:** Export operations should be async with progress feedback
- **Hardcoding theme values:** All branding should come from theme.json, not code

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Text redaction | String replacement in PDF stream | PyMuPDF `apply_redactions()` | PDF text isn't stored as simple strings; PyMuPDF handles encoding, fonts, layers |
| PDF merging | Manual page copying | PyMuPDF `insert_pdf()` | Preserves links, annotations, fonts, compression |
| Table layout | Manual coordinate calculations | ReportLab `Table` + `TableStyle` | Handles cell sizing, wrapping, page breaks |
| Font metrics | Custom font measurements | ReportLab's built-in font handling | Typography is complex; library handles kerning, leading |

**Key insight:** PDF is a complex format with layers (text, images, vectors, annotations). Hand-rolling solutions leads to edge cases with encoding, fonts, and coordinate systems. Use library methods.

## Common Pitfalls

### Pitfall 1: Redaction Leaves Artifacts
**What goes wrong:** Text appears removed but data still exists in PDF (hidden layers, metadata)
**Why it happens:** Using overlay rectangles instead of true redaction
**How to avoid:** Use PyMuPDF's `apply_redactions()` which physically removes content from the file
**Warning signs:** PDF file size doesn't decrease; text selectable under "redacted" area

### Pitfall 2: Font Embedding in Generated PDFs
**What goes wrong:** PDFs look wrong on other systems; fonts missing or substituted
**Why it happens:** Using system fonts without embedding
**How to avoid:** Use ReportLab's built-in fonts (Helvetica, Times) or explicitly embed custom fonts
**Warning signs:** Different appearance on Windows vs macOS; font substitution warnings

### Pitfall 3: Coordinate System Confusion
**What goes wrong:** Images/text appear in wrong positions
**Why it happens:** ReportLab origin is bottom-left (like PostScript), not top-left (like most UIs)
**How to avoid:** Remember Y increases upward; use `pagesize[1] - y` for top-down positioning
**Warning signs:** Content appears upside down or off-page

### Pitfall 4: Memory Leaks with Large Batches
**What goes wrong:** Memory grows when exporting many CVs
**Why it happens:** Not closing PyMuPDF/ReportLab objects; holding PDF bytes in memory
**How to avoid:** Use context managers; process one PDF at a time; write to disk immediately
**Warning signs:** Python memory usage grows linearly with export count

### Pitfall 5: Slow Logo Loading
**What goes wrong:** Export takes seconds instead of milliseconds
**Why it happens:** Re-reading logo file from disk for every export
**How to avoid:** Cache logo in memory at theme load time; ReportLab caches with `drawImage`
**Warning signs:** Disk I/O on every export; logo file opened multiple times

## Code Examples

Verified patterns from official sources:

### Complete Redaction Workflow
```python
# Source: PyMuPDF redaction guide
import pymupdf

def create_redacted_cv(
    source_path: str,
    contact_info: dict,
    mode: str  # 'full', 'client', 'punt'
) -> bytes:
    """
    Create redacted version of CV.

    Modes:
    - full: No redaction
    - client: Remove phone and email
    - punt: Remove phone, email, AND name
    """
    doc = pymupdf.open(source_path)

    if mode == 'full':
        # No redaction needed
        output = doc.tobytes()
        doc.close()
        return output

    fields_to_redact = []

    # Client mode: remove phone and email
    if contact_info.get('phone'):
        fields_to_redact.append(contact_info['phone'])
    if contact_info.get('email'):
        fields_to_redact.append(contact_info['email'])

    # Punt mode: also remove name
    if mode == 'punt' and contact_info.get('name'):
        fields_to_redact.append(contact_info['name'])

    for page in doc:
        for text in fields_to_redact:
            if not text:
                continue
            instances = page.search_for(text)
            for rect in instances:
                # White fill = blank space (as specified in CONTEXT.md)
                page.add_redact_annot(rect, fill=(1, 1, 1))
        page.apply_redactions()

    output = doc.tobytes()
    doc.close()
    return output
```

### Theme-Aware Blind Profile
```python
# Source: ReportLab Platypus user guide
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from io import BytesIO

def generate_blind_profile(
    cv_data: dict,
    theme: dict,
    recruiter: dict,
    mode: str  # 'client' or 'punt'
) -> bytes:
    """
    Generate one-page blind profile front sheet.

    Structure:
    - Header: Name (or "Candidate" for punt), Location, Date
    - Key skills list
    - Last 3 jobs summary
    - Footer: Recruiter contact box
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=15*mm,
        bottomMargin=20*mm,
        leftMargin=15*mm,
        rightMargin=15*mm
    )

    # Parse theme colors
    primary = colors.HexColor(theme.get('primary_color', '#6B21A8'))
    secondary = colors.HexColor(theme.get('secondary_color', '#374151'))

    styles = getSampleStyleSheet()

    # Custom styles
    name_style = ParagraphStyle(
        'CandidateName',
        parent=styles['Heading1'],
        fontSize=20,
        textColor=primary,
        spaceAfter=4*mm
    )
    section_style = ParagraphStyle(
        'Section',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=primary,
        spaceBefore=6*mm,
        spaceAfter=3*mm
    )
    body_style = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontSize=10,
        textColor=secondary,
        leading=14
    )

    story = []

    # Header: Name or "Candidate"
    display_name = 'Candidate' if mode == 'punt' else cv_data.get('contact', {}).get('name', 'Candidate')
    story.append(Paragraph(display_name, name_style))

    # Location and date
    location = cv_data.get('contact', {}).get('address', '')
    if location:
        story.append(Paragraph(location, body_style))

    story.append(Spacer(1, 4*mm))

    # Skills section
    skills = cv_data.get('skills', [])
    if skills:
        story.append(Paragraph('Key Skills', section_style))
        all_skills = []
        for group in skills[:3]:  # Limit to 3 groups
            all_skills.extend(group.get('skills', [])[:5])  # 5 skills per group max

        skill_text = ' | '.join(all_skills[:15])  # Max 15 skills total
        story.append(Paragraph(skill_text, body_style))

    # Work history (last 3 jobs)
    work = cv_data.get('work_history', [])[:3]
    if work:
        story.append(Paragraph('Recent Experience', section_style))

        for entry in work:
            title = entry.get('position', '')
            company = entry.get('company', '')
            dates = f"{entry.get('start_date', '')} - {entry.get('end_date', 'Present')}"

            story.append(Paragraph(f"<b>{title}</b> at {company}", body_style))
            story.append(Paragraph(dates, body_style))

            # Description (max 3 lines ~150 chars)
            desc = entry.get('description', '')[:150]
            if desc:
                story.append(Paragraph(desc, body_style))
            story.append(Spacer(1, 3*mm))

    # Footer: Recruiter box
    story.append(Spacer(1, 10*mm))
    recruiter_data = [
        [Paragraph(f"<b>{recruiter.get('name', '')}</b>", body_style)],
        [Paragraph(recruiter.get('phone', ''), body_style)],
        [Paragraph(recruiter.get('email', ''), body_style)]
    ]

    recruiter_table = Table(recruiter_data, colWidths=[180*mm])
    recruiter_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F3F4F6')),
        ('BOX', (0, 0), (-1, -1), 1, primary),
        ('TOPPADDING', (0, 0), (-1, -1), 4*mm),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4*mm),
        ('LEFTPADDING', (0, 0), (-1, -1), 4*mm),
    ]))
    story.append(recruiter_table)

    doc.build(story)
    return buffer.getvalue()
```

### Export Coordinator
```python
# Orchestrates redaction, blind profile, and merging
import pymupdf
from pathlib import Path

def export_cv(
    cv_id: int,
    cv_data: dict,
    source_pdf_path: str,
    output_dir: Path,
    mode: str,
    theme: dict,
    recruiter: dict,
    include_blind_profile: bool = True
) -> str:
    """
    Export CV with optional redaction and blind profile.

    Returns: Path to output PDF
    """
    contact = cv_data.get('contact', {})

    # Step 1: Redact source PDF
    redacted_bytes = create_redacted_cv(source_pdf_path, contact, mode)

    if not include_blind_profile:
        # Just save redacted PDF
        name = contact.get('name', 'Candidate').replace(' ', '_')
        output_path = output_dir / f"{name}_CV.pdf"
        output_path.write_bytes(redacted_bytes)
        return str(output_path)

    # Step 2: Generate blind profile
    profile_bytes = generate_blind_profile(cv_data, theme, recruiter, mode)

    # Step 3: Merge (profile first, then CV)
    front_doc = pymupdf.open(stream=profile_bytes, filetype="pdf")
    cv_doc = pymupdf.open(stream=redacted_bytes, filetype="pdf")

    front_doc.insert_pdf(cv_doc)

    # Step 4: Save combined
    name = contact.get('name', 'Candidate').replace(' ', '_')
    if mode == 'punt':
        name = 'Candidate'

    output_path = output_dir / f"{name}_CV.pdf"
    front_doc.save(str(output_path))

    front_doc.close()
    cv_doc.close()

    return str(output_path)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| PDF string manipulation | PyMuPDF redaction API | 2020+ | Reliable, handles edge cases |
| pdfgen canvas only | Platypus flowables | ReportLab 2.x | Much easier document creation |
| FPDF for generation | ReportLab | N/A | ReportLab has more features, tables, C extension |

**Deprecated/outdated:**
- `reportlab.lib.fonts.addMapping`: Use `pdfmetrics.registerFont` instead
- PyMuPDF `page.getText()`: Use `page.get_text()` (snake_case API since 1.18.0)

## Open Questions

Things that couldn't be fully resolved:

1. **Logo aspect ratio handling**
   - What we know: ReportLab `drawImage` has `preserveAspectRatio` parameter
   - What's unclear: Best dimensions for client logos (square? rectangular? max size?)
   - Recommendation: Define max dimensions in theme.json (e.g., 150x50 pixels), scale down preserving ratio

2. **Exact 500ms performance breakdown**
   - What we know: ReportLab generates simple PDFs in <100ms; PyMuPDF operations are <100ms
   - What's unclear: Real-world timing with disk I/O, logo loading, complex CVs
   - Recommendation: Benchmark during implementation; cache logo; optimize if needed

3. **Theme.json location at build time**
   - What we know: CONTEXT.md says "baked into client branch"
   - What's unclear: Exact location (resources folder? app.asar?)
   - Recommendation: Use `extraResources` in electron-forge config, similar to Python sidecar

## Sources

### Primary (HIGH confidence)
- [PyMuPDF Documentation - Page Methods](https://pymupdf.readthedocs.io/en/latest/page.html) - Redaction API
- [PyMuPDF - The Basics](https://pymupdf.readthedocs.io/en/latest/the-basics.html) - PDF merging with insert_pdf
- [ReportLab User Guide - Platypus](https://docs.reportlab.com/reportlab/userguide/ch5_platypus/) - Document creation
- [ReportLab User Guide - Tables](https://docs.reportlab.com/reportlab/userguide/ch7_tables/) - TableStyle commands
- [ReportLab User Guide - Graphics](https://docs.reportlab.com/reportlab/userguide/ch2_graphics/) - Image handling

### Secondary (MEDIUM confidence)
- [Artifex Blog - How to Merge PDFs](https://artifex.com/blog/how-to-merge-pdfs-with-pymupdf-a-complete-guide) - Merging patterns
- [Artifex Blog - Search and Replace Text](https://artifex.com/blog/how-to-search-and-replace-text-in-pdfs-using-pymupdf) - Redaction workflow
- [GeeksforGeeks - PDF Redaction](https://www.geeksforgeeks.org/python/pdf-redaction-using-python/) - Verified examples
- [ReportLab PyPI](https://pypi.org/project/reportlab/) - Version 4.4.9 confirmed

### Tertiary (LOW confidence)
- Various Medium articles on ReportLab - General patterns confirmed with official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - PyMuPDF already in project; ReportLab is industry standard
- Architecture: HIGH - Separation of redaction/generation/merging is well-established pattern
- Pitfalls: MEDIUM - Based on common issues in documentation and forums
- Performance: MEDIUM - Benchmarks suggest <500ms is achievable but needs validation

**Research date:** 2026-01-26
**Valid until:** 2026-02-26 (30 days - stable libraries, mature APIs)
