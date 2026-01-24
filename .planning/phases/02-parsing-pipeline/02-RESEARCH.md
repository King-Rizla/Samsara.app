# Phase 2: Parsing Pipeline - Research

**Researched:** 2026-01-24
**Domain:** CV/Resume parsing with PDF/DOCX/DOC extraction, NLP entity extraction, structured JSON output
**Confidence:** HIGH (verified via official documentation, PyPI releases, and community patterns)

## Summary

Phase 2 implements a parsing pipeline that extracts structured data from CVs in PDF, DOCX, and DOC formats with <2s processing time. Research confirms the user-decided stack: PyMuPDF (primary PDF), python-docx (DOCX), pdfplumber (fallback for complex layouts). Legacy DOC support requires either textract+antiword (system dependency) or LibreOffice subprocess conversion (heavier but more reliable). The spaCy NER model already loaded in Phase 1 handles entity recognition, but standard NER does NOT provide confidence scores - a custom approach using regex patterns plus NER will be needed.

Key findings:
- **PyMuPDF 1.26.7** (latest, uses MuPDF 1.26.11) provides `get_text("dict")` for structured extraction with font/position info
- **python-docx 1.2.0** handles DOCX paragraphs and tables; does NOT support legacy .doc format
- **pdfplumber 0.11.9** excels at table extraction (96% accuracy in research) and complex layouts
- **spaCy NER confidence scores** are NOT available from the standard NER component - use SpanCat or rule-based patterns instead
- **JSON Resume schema v1.0.0** provides a well-established standard for CV structured data
- **Legacy DOC**: textract with antiword is simplest but antiword is unmaintained; LibreOffice headless conversion is more reliable

**Primary recommendation:** Use a cascading extraction strategy: PyMuPDF first (fast), pdfplumber fallback for tables/complex layouts, regex-based contact extraction (email/phone/URL) combined with spaCy NER for names. Calculate confidence based on extraction method agreement and field completeness, not spaCy model scores.

## Standard Stack

The established libraries/tools for this domain:

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| PyMuPDF | 1.26.7 | PDF text/structure extraction | Fast, layout-aware, dict output with position/font info, active maintenance |
| python-docx | 1.2.0 | DOCX parsing | Standard for .docx, reads paragraphs/tables/styles |
| pdfplumber | 0.11.9 | PDF table extraction, complex layouts | 96% table accuracy, better than PyMuPDF for grids |
| spaCy | 3.8.11 | NER (names, organizations) | Already loaded from Phase 1, en_core_web_sm model |
| python-dateutil | 2.9.x | Date parsing and normalization | Handles various date formats, `dayfirst=True` for UK |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| textract | 1.6.1 | Legacy DOC extraction | When processing .doc files (requires antiword) |
| regex | stdlib | Contact extraction | Email, phone, URL patterns (more reliable than NER) |
| typing-extensions | latest | Type hints | For TypedDict schema definitions |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| PyMuPDF | pymupdf4llm | Better markdown output but overkill for extraction |
| textract | LibreOffice subprocess | More reliable but heavier dependency, slower |
| Custom JSON schema | JSON Resume standard | JSON Resume is well-established but may need extension for CV-specific fields |
| spaCy NER confidence | SpanCat model | Would require training custom model; regex is simpler for contact info |

**Installation:**

```bash
# Add to python-src/requirements.txt
PyMuPDF==1.26.7
python-docx==1.2.0
pdfplumber==0.11.9
python-dateutil>=2.9.0

# For legacy DOC support (optional - requires system antiword)
# textract==1.6.1  # Uncomment if needed

# spaCy already installed from Phase 1
# spacy==3.8.11
```

## Architecture Patterns

### Recommended Project Structure

```
python-src/
├── main.py                    # IPC handler (existing)
├── requirements.txt           # Dependencies
├── samsara.spec              # PyInstaller spec (existing)
├── parsers/
│   ├── __init__.py
│   ├── base.py               # Base parser interface
│   ├── pdf_parser.py         # PyMuPDF + pdfplumber
│   ├── docx_parser.py        # python-docx
│   └── doc_parser.py         # Legacy DOC (textract or LibreOffice)
├── extractors/
│   ├── __init__.py
│   ├── contact.py            # Email, phone, URL, address extraction
│   ├── sections.py           # Section detection and splitting
│   ├── work_history.py       # Employment extraction
│   ├── education.py          # Education extraction
│   └── skills.py             # Skills extraction
├── normalizers/
│   ├── __init__.py
│   ├── dates.py              # Date normalization (dd/mm/yyyy)
│   └── text.py               # Text cleanup, Unicode normalization
└── schema/
    ├── __init__.py
    └── cv_schema.py          # TypedDict definitions for CV structure
```

### Pattern 1: Cascading Parser Strategy

**What:** Try fast extraction first, fall back to thorough extraction if needed
**When to use:** All CV parsing - balances speed and accuracy
**Example:**

```python
# Source: Recommended pattern from research
from typing import Optional, Dict, Any
import pymupdf  # Note: import as pymupdf, not fitz (fitz is deprecated)

def parse_pdf(file_path: str) -> Dict[str, Any]:
    """Parse PDF with cascading strategy."""
    doc = pymupdf.open(file_path)

    # Stage 1: Fast extraction with PyMuPDF
    text_blocks = []
    has_tables = False

    for page in doc:
        # Get structured text with position info
        page_dict = page.get_text("dict", sort=True)

        for block in page_dict["blocks"]:
            if block["type"] == 0:  # Text block
                text_blocks.append(block)
            elif block["type"] == 1:  # Image block
                pass  # Skip images per user decision

        # Check for tables
        tables = page.find_tables()
        if tables:
            has_tables = True

    doc.close()

    # Stage 2: If tables detected, use pdfplumber for those sections
    if has_tables:
        import pdfplumber
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                page_tables = page.extract_tables()
                # Process tables...

    return {"blocks": text_blocks, "has_tables": has_tables}
```

### Pattern 2: Contact Extraction with Regex + NER

**What:** Combine regex patterns (reliable) with spaCy NER (contextual)
**When to use:** Extracting contact fields - regex is more accurate than NER for structured data
**Example:**

```python
# Source: Community patterns verified against spaCy docs
import re
from typing import Dict, List, Optional

# UK-friendly patterns
EMAIL_PATTERN = re.compile(
    r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}',
    re.IGNORECASE
)

# UK phone: +44, 0, with various separators
PHONE_PATTERN = re.compile(
    r'(?:(?:\+44\s?|0)(?:\d\s?){10,11})|'  # UK format
    r'(?:\+\d{1,3}\s?\d[\d\s]{8,14})',     # International
    re.IGNORECASE
)

# LinkedIn, GitHub, portfolio URLs
URL_PATTERN = re.compile(
    r'https?://(?:www\.)?(?:linkedin\.com/in/[\w-]+|'
    r'github\.com/[\w-]+|'
    r'[\w.-]+\.[a-z]{2,}/[\w/-]*)',
    re.IGNORECASE
)

def extract_contacts(text: str, nlp) -> Dict[str, Any]:
    """Extract contact information using regex + NER."""
    contacts = {
        "emails": list(set(EMAIL_PATTERN.findall(text))),
        "phones": list(set(PHONE_PATTERN.findall(text))),
        "urls": list(set(URL_PATTERN.findall(text))),
        "name": None,
        "address": None
    }

    # Use spaCy NER for name and location (harder to regex)
    doc = nlp(text[:2000])  # First 2000 chars likely has contact info

    for ent in doc.ents:
        if ent.label_ == "PERSON" and contacts["name"] is None:
            contacts["name"] = ent.text
        elif ent.label_ == "GPE" and contacts["address"] is None:
            contacts["address"] = ent.text

    return contacts
```

### Pattern 3: Date Normalization to British Format

**What:** Parse various date formats and normalize to dd/mm/yyyy
**When to use:** All date fields in work history, education
**Example:**

```python
# Source: dateutil documentation
from dateutil.parser import parse as parse_date
from dateutil.parser import ParserError
from typing import Optional
import re

def normalize_date(date_str: str) -> Optional[str]:
    """
    Normalize date string to dd/mm/yyyy (British format).
    Returns None if unparseable.
    """
    if not date_str or date_str.lower() in ('present', 'current', 'now'):
        return 'Present'

    # Clean common patterns
    date_str = date_str.strip()
    date_str = re.sub(r'[\u2013\u2014]', '-', date_str)  # En/em dash to hyphen

    try:
        # dayfirst=True for British date interpretation
        # e.g., "3/2/2020" = 3rd February (not March 2nd)
        parsed = parse_date(date_str, dayfirst=True, fuzzy=True)
        return parsed.strftime('%d/%m/%Y')
    except (ParserError, ValueError, OverflowError):
        # Return original if can't parse
        return date_str
```

### Pattern 4: Section Detection

**What:** Identify CV sections by headings and layout
**When to use:** Splitting CV into logical parts before extraction
**Example:**

```python
# Source: Resume parsing patterns
import re
from typing import List, Tuple

SECTION_PATTERNS = {
    'contact': r'(?i)^(contact|personal\s+(?:info|details)|about\s+me)',
    'experience': r'(?i)^(experience|employment|work\s+history|professional\s+(?:experience|history))',
    'education': r'(?i)^(education|qualifications|academic|training)',
    'skills': r'(?i)^(skills|technical\s+skills|competencies|expertise|technologies)',
    'certifications': r'(?i)^(certifications?|certificates?|licenses?|accreditations?)',
    'languages': r'(?i)^(languages?|language\s+skills)',
    'publications': r'(?i)^(publications?|papers|research)',
    'volunteer': r'(?i)^(volunteer|volunteering|community)',
    'projects': r'(?i)^(projects?|portfolio)',
    'summary': r'(?i)^(summary|profile|objective|professional\s+summary)',
}

def detect_sections(text_blocks: List[dict]) -> List[Tuple[str, int, int]]:
    """
    Detect section boundaries from text blocks.
    Returns list of (section_name, start_idx, end_idx).
    """
    sections = []

    for i, block in enumerate(text_blocks):
        text = block.get('text', '').strip()

        for section_name, pattern in SECTION_PATTERNS.items():
            if re.match(pattern, text):
                sections.append((section_name, i))
                break

    # Convert to ranges
    result = []
    for j, (name, start) in enumerate(sections):
        end = sections[j + 1][1] if j + 1 < len(sections) else len(text_blocks)
        result.append((name, start, end))

    return result
```

### Anti-Patterns to Avoid

- **Using `import fitz`:** The `fitz` module name is deprecated. Use `import pymupdf` instead.
- **Relying on spaCy NER for emails/phones:** NER is designed for names/orgs, not structured patterns. Use regex.
- **Expecting spaCy NER confidence scores:** The standard NER component does not expose meaningful confidence. Use SpanCat or rule agreement instead.
- **Processing entire document for contact info:** Contact info is almost always in the first page/section. Limit search scope.
- **Loading spaCy model per-request:** Already preloaded in Phase 1. Use the existing `nlp` instance.
- **Storing raw file content in database:** Store reference path only per user decision. User manages files.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date parsing | Custom regex for each format | `dateutil.parser.parse(dayfirst=True)` | Handles 100+ formats, fuzzy parsing |
| Table detection | Line-by-line analysis | `pdfplumber.extract_tables()` or `page.find_tables()` | 96% accuracy on complex layouts |
| DOCX text extraction | Custom XML parsing | `python-docx` Document.paragraphs | Handles styles, runs, formatting |
| PDF structure | Raw byte parsing | PyMuPDF `get_text("dict")` | Returns blocks/lines/spans with position |
| Unicode normalization | Manual cleanup | `unicodedata.normalize('NFKC', text)` | Handles all Unicode edge cases |
| Phone validation | Custom regex per country | Consider `phonenumbers` library | Validates and formats international numbers |

**Key insight:** CV parsing involves many edge cases (multi-column layouts, creative formatting, international conventions). Libraries like PyMuPDF and pdfplumber have years of handling these. Focus implementation effort on the CV-specific logic (section detection, field extraction) rather than low-level parsing.

## Common Pitfalls

### Pitfall 1: Two-Column Layouts Produce Jumbled Text

**What goes wrong:** Text from left and right columns gets interleaved when sorted by Y-coordinate
**Why it happens:** PyMuPDF's `sort=True` sorts by vertical position first, mixing columns
**How to avoid:**
1. Use `get_text("dict")` to get block-level structure
2. Detect multi-column layouts by analyzing block X positions
3. Process columns separately, then merge
4. For complex cases, use pdfplumber's layout-aware extraction

```python
def is_multi_column(blocks: list) -> bool:
    """Detect if page has multi-column layout."""
    x_positions = [b["bbox"][0] for b in blocks if b["type"] == 0]
    if len(x_positions) < 2:
        return False

    # Check if there's a significant gap in X positions
    x_sorted = sorted(set(x_positions))
    for i in range(1, len(x_sorted)):
        if x_sorted[i] - x_sorted[i-1] > 100:  # Gap threshold
            return True
    return False
```
**Warning signs:** Names appearing mid-sentence, dates mixed with job titles

### Pitfall 2: spaCy NER Misidentifies Company Names as Persons

**What goes wrong:** Company names like "John Smith Ltd" get labeled as PERSON
**Why it happens:** NER models trained on general text, not CV-specific context
**How to avoid:**
1. Post-process NER results: check for company indicators (Ltd, Inc, LLC, PLC)
2. Use context: if entity appears after "at" or "for", likely ORG
3. Consider EntityRuler for common patterns

```python
COMPANY_INDICATORS = re.compile(
    r'\b(Ltd|Limited|Inc|LLC|PLC|Corp|Corporation|GmbH|AG|SA|BV)\b',
    re.IGNORECASE
)

def refine_entity(text: str, label: str) -> str:
    """Refine NER label using heuristics."""
    if label == "PERSON" and COMPANY_INDICATORS.search(text):
        return "ORG"
    return label
```
**Warning signs:** Companies appearing in name field, duplicate "names" per job entry

### Pitfall 3: Encrypted/Secured PDFs Fail Silently

**What goes wrong:** PDF opens but text extraction returns empty strings
**Why it happens:** PDF has permissions restrictions or is encrypted
**How to avoid:**
1. Check PDF metadata before extraction
2. Handle empty extraction gracefully
3. Provide clear error message to user

```python
def check_pdf_readable(file_path: str) -> Tuple[bool, str]:
    """Check if PDF is readable and not secured."""
    doc = pymupdf.open(file_path)

    if doc.is_encrypted:
        return False, "PDF is encrypted - please provide an unlocked version"

    if doc.permissions & pymupdf.PDF_PERM_COPY == 0:
        return False, "PDF restricts text copying - please provide an unrestricted version"

    # Try to extract text from first page
    if doc.page_count > 0:
        text = doc[0].get_text()
        if not text.strip():
            return False, "PDF appears to be image-only or corrupted"

    doc.close()
    return True, "OK"
```
**Warning signs:** Zero-length text extraction, "invalid" JSON errors

### Pitfall 4: Legacy DOC Files with Missing Antiword

**What goes wrong:** textract throws error "antiword not found" on Windows
**Why it happens:** antiword is a Linux tool, requires manual Windows setup
**How to avoid:**
1. Detect .doc extension early and check for antiword availability
2. Provide fallback: prompt user to save as .docx
3. Or use LibreOffice headless conversion (if installed)
4. Make DOC support optional with graceful degradation

```python
import shutil
import subprocess

def can_parse_doc() -> Tuple[bool, str]:
    """Check if DOC parsing is available."""
    # Check for antiword
    if shutil.which('antiword'):
        return True, "antiword"

    # Check for LibreOffice
    soffice = shutil.which('soffice') or shutil.which('libreoffice')
    if soffice:
        return True, "libreoffice"

    return False, "none"
```
**Warning signs:** Import errors on Windows, "command not found" errors

### Pitfall 5: Confidence Scores Not Available from spaCy NER

**What goes wrong:** Code expects confidence scores from `ent._.confidence` or similar
**Why it happens:** spaCy's standard NER component does not expose confidence scores
**How to avoid:**
1. Calculate confidence based on extraction method agreement (regex matches NER)
2. Use field completeness as confidence proxy
3. Flag fields with ambiguous extraction for user review

```python
def calculate_confidence(field: str, sources: Dict[str, Any]) -> float:
    """
    Calculate confidence based on extraction agreement.
    Returns 0.0-1.0 confidence score.
    """
    values = [v for v in sources.values() if v is not None]

    if not values:
        return 0.0  # No extraction

    if len(set(values)) == 1 and len(values) > 1:
        return 1.0  # Multiple sources agree

    if len(values) == 1:
        return 0.7  # Single source, no verification

    # Multiple sources disagree
    return 0.5
```
**Warning signs:** AttributeError on confidence access, always-1.0 or always-0.0 scores

## Code Examples

Verified patterns from official sources:

### PyMuPDF Structured Text Extraction

```python
# Source: https://pymupdf.readthedocs.io/en/latest/recipes-text.html
import pymupdf

def extract_pdf_structure(file_path: str) -> dict:
    """Extract PDF text with full structure information."""
    doc = pymupdf.open(file_path)
    result = {"pages": []}

    for page_num, page in enumerate(doc):
        page_data = {
            "number": page_num + 1,
            "blocks": []
        }

        # sort=True reorders by position (top-left to bottom-right)
        page_dict = page.get_text("dict", sort=True)

        for block in page_dict["blocks"]:
            if block["type"] == 0:  # Text block
                block_data = {
                    "bbox": block["bbox"],  # (x0, y0, x1, y1)
                    "lines": []
                }

                for line in block["lines"]:
                    line_text = ""
                    for span in line["spans"]:
                        line_text += span["text"]

                    block_data["lines"].append({
                        "text": line_text,
                        "font": line["spans"][0]["font"] if line["spans"] else None,
                        "size": line["spans"][0]["size"] if line["spans"] else None
                    })

                page_data["blocks"].append(block_data)

        result["pages"].append(page_data)

    doc.close()
    return result
```

### python-docx Text Extraction

```python
# Source: https://python-docx.readthedocs.io/
from docx import Document
from typing import List, Dict

def extract_docx_content(file_path: str) -> Dict:
    """Extract text and tables from DOCX file."""
    doc = Document(file_path)
    result = {
        "paragraphs": [],
        "tables": []
    }

    # Extract paragraphs with style info
    for para in doc.paragraphs:
        if para.text.strip():
            result["paragraphs"].append({
                "text": para.text,
                "style": para.style.name if para.style else None
            })

    # Extract tables
    for table in doc.tables:
        table_data = []
        for row in table.rows:
            row_data = [cell.text for cell in row.cells]
            table_data.append(row_data)
        result["tables"].append(table_data)

    return result
```

### pdfplumber Table Extraction

```python
# Source: https://github.com/jsvine/pdfplumber
import pdfplumber
from typing import List

def extract_pdf_tables(file_path: str) -> List[List[List[str]]]:
    """Extract all tables from PDF using pdfplumber."""
    tables = []

    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            page_tables = page.extract_tables()
            for table in page_tables:
                # Clean None values
                cleaned = [
                    [cell if cell else "" for cell in row]
                    for row in table
                ]
                tables.append(cleaned)

    return tables
```

### CV Data Schema (TypedDict)

```python
# Source: JSON Resume schema adapted for CV extraction
from typing import TypedDict, List, Optional
from datetime import date

class ContactInfo(TypedDict, total=False):
    name: str
    email: str
    phone: str
    address: str
    linkedin: Optional[str]
    github: Optional[str]
    portfolio: Optional[str]

class WorkEntry(TypedDict, total=False):
    company: str
    position: str
    start_date: str  # dd/mm/yyyy or "Present"
    end_date: str
    description: str
    highlights: List[str]
    confidence: float

class EducationEntry(TypedDict, total=False):
    institution: str
    degree: str
    field_of_study: str
    start_date: str
    end_date: str
    grade: Optional[str]
    confidence: float

class SkillGroup(TypedDict, total=False):
    category: str  # Preserve candidate's own heading
    skills: List[str]

class ParsedCV(TypedDict, total=False):
    contact: ContactInfo
    work_history: List[WorkEntry]
    education: List[EducationEntry]
    skills: List[SkillGroup]
    certifications: List[str]
    languages: List[str]
    other_sections: dict  # Dynamic sections detected
    raw_text: str  # Full text for agent re-interpretation
    section_order: List[str]  # Original order from CV
    parse_confidence: float  # Overall confidence
    warnings: List[str]  # Issues detected during parsing
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `import fitz` | `import pymupdf` | PyMuPDF 1.24.3 | fitz name deprecated, use pymupdf |
| textract + antiword | Consider LibreOffice or user saves as .docx | 2025 | antiword unmaintained |
| spaCy NER confidence | SpanCat or rule-based + agreement | spaCy 3.x | NER component doesn't expose scores |
| Custom JSON schema | JSON Resume standard | 2014 (stable) | Community-driven, well-established |
| PyMuPDF `extractText()` | `get_text("dict", sort=True)` | Current | Better structure preservation |

**Deprecated/outdated:**
- `fitz` module name: Use `pymupdf` instead
- `Page.getText()`: Use `Page.get_text()` (method renamed for consistency)
- antiword for DOC files: Unmaintained, source disappeared. Consider alternatives.
- spaCy beam parsing for confidence: Unreliable in v3.x, returns 0.0/1.0

## Open Questions

Things that couldn't be fully resolved:

1. **Legacy DOC handling strategy**
   - What we know: textract+antiword works but antiword is unmaintained; LibreOffice is reliable but heavy
   - What's unclear: Whether users actually have many .doc files (vs .docx)
   - Recommendation: Implement graceful degradation - detect .doc, warn user, suggest saving as .docx. Add LibreOffice fallback if needed based on user feedback.

2. **Adversarial corpus specifics**
   - What we know: Multiple public datasets exist (Kaggle, HuggingFace, Innovatiana)
   - What's unclear: Which best represents real recruitment CVs with edge cases
   - Recommendation: Start with HuggingFace datasetmaster/resumes (mixed real + synthetic), supplement with Innovatiana (2400 CVs in PDF/HTML/text)

3. **Confidence score calibration**
   - What we know: Can calculate based on extraction agreement and completeness
   - What's unclear: What thresholds indicate "low confidence" for UI highlighting
   - Recommendation: Start with 0.7 threshold for "low confidence" flag, adjust based on user feedback during Phase 3 (Visual Editor)

4. **PyInstaller bundling for new libraries**
   - What we know: PyMuPDF may need hidden imports like spaCy did
   - What's unclear: Exact hidden imports needed for PyMuPDF, pdfplumber, python-docx
   - Recommendation: Test PyInstaller build early, add hidden imports as discovered

## Sources

### Primary (HIGH confidence)
- [PyMuPDF Documentation](https://pymupdf.readthedocs.io/en/latest/) - Text extraction patterns, get_text dict format, v1.26.7
- [python-docx Documentation](https://python-docx.readthedocs.io/) - DOCX parsing, paragraphs/tables, v1.2.0
- [pdfplumber GitHub](https://github.com/jsvine/pdfplumber) - Table extraction, v0.11.9
- [dateutil.parser Documentation](https://dateutil.readthedocs.io/en/stable/parser.html) - Date parsing with dayfirst
- [JSON Resume Schema](https://jsonresume.org/schema) - Standard CV JSON structure v1.0.0
- [spaCy EntityRuler](https://spacy.io/api/entityruler) - Custom pattern matching
- [spaCy NER Confidence Issues](https://github.com/explosion/spaCy/issues/5917) - Confirmation NER doesn't expose scores

### Secondary (MEDIUM confidence)
- [Unstract PDF Parser Evaluation](https://unstract.com/blog/evaluating-python-pdf-to-text-libraries/) - 2026 library comparison
- [Unstract Table Extraction](https://unstract.com/blog/extract-tables-from-pdf-python/) - 2026 pdfplumber vs alternatives
- [PyMuPDF Text Extraction Strategies](https://artifex.com/blog/text-extraction-strategies-with-pymupdf) - Layout handling patterns
- [textract Documentation](https://textract.readthedocs.io/) - DOC extraction with antiword

### Tertiary (LOW confidence)
- [Resume Corpus GitHub](https://github.com/florex/resume_corpus) - Public dataset option
- [datasetmaster/resumes HuggingFace](https://huggingface.co/datasets/datasetmaster/resumes) - Mixed real/synthetic CVs
- [lorey/social-media-profiles-regexs](https://github.com/lorey/social-media-profiles-regexs) - LinkedIn/GitHub URL patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All versions verified via PyPI, official docs
- Architecture: HIGH - Patterns from official documentation and proven community usage
- Pitfalls: HIGH - Verified via GitHub issues, Stack Overflow, official troubleshooting
- DOC handling: MEDIUM - antiword status confirmed but alternatives need testing

**Research date:** 2026-01-24
**Valid until:** 2026-02-24 (30 days - libraries are stable, check for PyMuPDF updates)
