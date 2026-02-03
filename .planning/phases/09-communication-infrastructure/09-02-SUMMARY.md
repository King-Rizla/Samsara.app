---
phase: "09-communication-infrastructure"
plan: "02"
status: "complete"
subsystem: "messaging"
tags: ["templates", "variable-substitution", "sms", "email", "zustand"]

requires:
  - "08-03" # Database migration v5 with outreach_templates table

provides:
  - "Template engine with {{variable}} substitution"
  - "CRUD operations for SMS and email templates"
  - "Live preview in template editor"
  - "Variable dropdown by category"

affects:
  - "09-03" # SMS/email send will use templates
  - "10-*" # Outreach sequences will use templates

tech-stack:
  added: []
  patterns:
    - "Client-side live preview for instant feedback"
    - "Sheet-based template management in project layout"
    - "SMS segment calculation (160/153 chars)"

key-files:
  created:
    - "src/main/templateEngine.ts"
    - "src/renderer/stores/templateStore.ts"
    - "src/renderer/components/templates/TemplateEditor.tsx"
    - "src/renderer/components/templates/TemplateList.tsx"
    - "src/renderer/components/templates/VariableDropdown.tsx"
    - "src/renderer/components/templates/index.ts"
  modified:
    - "src/main/database.ts"
    - "src/main/index.ts"
    - "src/main/preload.ts"
    - "src/renderer/routes/ProjectLayout.tsx"
    - "src/renderer/types/communication.ts"

decisions:
  - key: "client-side-preview"
    choice: "Generate template preview on client using example data"
    why: "Instant feedback without IPC round-trip for typing"

  - key: "sms-segment-calc"
    choice: "160 chars for single, 153 for concatenated segments"
    why: "Standard GSM-7 encoding with 7-char UDH header"

metrics:
  duration: "10 min"
  completed: "2026-02-03"
---

# Phase 9 Plan 2: Template Engine and Authoring UI Summary

Template engine with {{variable}} substitution for SMS and email templates with live preview.

## What Was Built

### Template Engine (templateEngine.ts)

- `renderTemplate()` - Replace {{variable}} placeholders with actual values
- `previewTemplate()` - Generate preview with example data
- `extractTemplateVariables()` - Extract variable names from template
- `validateTemplateVariables()` - Detect unknown variables
- `AVAILABLE_VARIABLES` - 9 variables across candidate/role/recruiter categories

### Database CRUD (database.ts)

- `createTemplate()` - Insert new template with auto-extracted variables
- `getTemplate()` - Get single template by ID
- `getTemplatesByProject()` - Get all templates for a project
- `updateTemplate()` - Update template fields, re-extract variables on body change
- `deleteTemplate()` - Remove template

### IPC Handlers (index.ts)

- `create-template` - Create new template
- `get-template` - Get template by ID
- `get-templates-by-project` - List project templates
- `update-template` - Update template
- `delete-template` - Delete template
- `preview-template` - Preview with example data
- `get-available-variables` - Get variable definitions for dropdown

### UI Components

**TemplateEditor (332 lines)**

- Side-by-side layout: form on left, preview on right
- Template name, type toggle (SMS/Email), subject line (email only)
- Variable dropdown inserts {{variable}} at cursor
- SMS: Character count and segment estimation
- Client-side live preview for instant feedback

**TemplateList (234 lines)**

- Filter tabs: All, SMS, Email with counts
- Template cards showing type badge, name, preview
- Click to edit, dropdown menu for delete
- Empty state with create button
- Delete confirmation with 3-second timeout

**VariableDropdown**

- Categorized by: Candidate, Role, Recruiter
- Shows example value for each variable
- Inserts {{variable}} syntax on click

### Integration

- Templates button added to ProjectLayout header
- Sheet slides out for template management
- TemplateList for browsing, TemplateEditor for create/edit

## Variables Available

| Category  | Variable             | Example                  |
| --------- | -------------------- | ------------------------ |
| Candidate | candidate_name       | John Smith               |
| Candidate | candidate_first_name | John                     |
| Candidate | candidate_email      | john.smith@email.com     |
| Candidate | candidate_phone      | +1 555 987 6543          |
| Role      | role_title           | Senior Software Engineer |
| Role      | company_name         | TechCorp Ltd             |
| Recruiter | recruiter_name       | Jane Doe                 |
| Recruiter | recruiter_phone      | +1 555 123 4567          |
| Recruiter | recruiter_email      | jane@recruit.com         |

## Commits

| Hash    | Type | Description                                |
| ------- | ---- | ------------------------------------------ |
| 70a4329 | feat | Template engine with variable substitution |
| 617c3a9 | feat | Template IPC handlers and database CRUD    |
| 20e5e05 | feat | Template UI components and store           |

## Verification

- [x] TypeScript compiles (eslint passes)
- [x] 152 tests pass
- [x] TemplateEditor.tsx > 120 lines (332)
- [x] TemplateList.tsx > 80 lines (234)
- [x] Exports: renderTemplate, previewTemplate, AVAILABLE_VARIABLES
- [x] IPC: api.createTemplate, api.previewTemplate connected

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

**Phase 9 Plan 3 (SMS/Email Send):**

- Templates are ready for use in message sending
- Variable substitution works for personalization
- Template selection can be integrated into send workflow
