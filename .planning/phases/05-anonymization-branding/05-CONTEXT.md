# Phase 5: Anonymization & Branding - Context

**Gathered:** 2026-01-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Generate client-ready PDFs with optional contact redaction and client-specific branding. Output includes optional Blind Profile front sheet prepended to CV. This phase covers export functionality — parsing and editing are complete in earlier phases.

</domain>

<decisions>
## Implementation Decisions

### Redaction Approach
- **Purpose:** Anti-backdoor protection — prevent companies from contacting candidates directly
- **Three export modes:**
  - **Full:** No redaction
  - **Client:** Phone and email removed (default)
  - **Punt:** Phone, email, AND name removed (for non-clients)
- **Redaction method:** Just remove the text, leave blank space (no black bars, no placeholders)
- **Default:** Client mode pre-selected at export

### Blind Profile Format
- **What it is:** One-page cover sheet prepended to the full CV (recipient gets both)
- **Structure:**
  - **Header:** Name (or "Candidate" for Punt mode), Location, Date
  - **Summary section:**
    - Key skills list
    - Last 3 jobs: title, dates, basic description (max 3 lines each)
  - **Footer box:** Recruiter name, phone, email
- **Recruiter details:** Pulled from app settings (set once)
- **Styling:** Client-specific template (set in settings, potentially uploadable)

### Branding/Theming
- **Architecture:** One template per client deployment — baked into their branch
- **No in-app template management** — branding is fixed for that install
- **Client provides template** — technical format (DOCX, JSON, etc.) is Claude's discretion
- **Template management happens at build/deploy time**, not runtime

### PDF Output
- **Format:** Single combined PDF (Blind Profile + CV = one file)
- **Naming:** Candidate name based (e.g., "John_Smith_CV.pdf")
- **Save location:** System downloads folder, no prompt
- **Bulk export:** Supported — select multiple CVs, save all to chosen folder

### Claude's Discretion
- Template file format and data injection method
- Exact PDF generation library/approach
- Blind Profile layout/typography details
- How "last 3 jobs" summary is generated from extracted data
- Performance optimization for <500ms target

</decisions>

<specifics>
## Specific Ideas

- Punt mode uses "Candidate" or "Candidate A" as the name placeholder
- Recruiter box at bottom of Blind Profile — their contact details are the point of contact
- Template is unique per client — each client deployment is a branch with their template baked in

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-anonymization-branding*
*Context gathered: 2026-01-26*
