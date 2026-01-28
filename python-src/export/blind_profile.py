"""
Blind Profile generator using ReportLab.

Creates a one-page front sheet summarizing candidate qualifications
for prepending to CVs. Features recruiter contact details and theming.

Structure:
- Header: Name (or "Candidate" for punt mode), Location
- Key Skills section: First 15 skills (pipe-separated)
- Recent Experience section: Last 3 jobs with dates and descriptions
- Footer: Recruiter contact box on light gray background
"""

from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from io import BytesIO
from typing import Optional

from .theme import Theme


def generate_blind_profile(
    cv_data: dict,
    theme: Theme,
    recruiter: dict,
    mode: str = 'client'
) -> bytes:
    """
    Generate one-page Blind Profile front sheet as PDF bytes.

    Args:
        cv_data: Parsed CV data containing contact, skills, work_history
        theme: Theme configuration for styling
        recruiter: Dict with recruiter details (name, phone, email)
        mode: Export mode - 'client' (show name) or 'punt' (show "Candidate")

    Returns:
        bytes: PDF document as bytes
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
    primary = colors.HexColor(theme.primary_color)
    secondary = colors.HexColor(theme.secondary_color)

    # Get base styles
    styles = getSampleStyleSheet()

    # Custom styles from theme
    name_style = ParagraphStyle(
        'CandidateName',
        parent=styles['Heading1'],
        fontSize=20,
        textColor=primary,
        spaceAfter=4*mm,
        fontName=theme.header_font
    )

    location_style = ParagraphStyle(
        'Location',
        parent=styles['Normal'],
        fontSize=12,
        textColor=secondary,
        spaceAfter=6*mm,
        fontName=theme.body_font
    )

    section_style = ParagraphStyle(
        'Section',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=primary,
        spaceBefore=6*mm,
        spaceAfter=3*mm,
        fontName=theme.header_font
    )

    body_style = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontSize=10,
        textColor=secondary,
        leading=14,
        fontName=theme.body_font
    )

    job_title_style = ParagraphStyle(
        'JobTitle',
        parent=styles['Normal'],
        fontSize=10,
        textColor=secondary,
        fontName=theme.body_font,
        spaceAfter=1*mm
    )

    job_dates_style = ParagraphStyle(
        'JobDates',
        parent=styles['Normal'],
        fontSize=9,
        textColor=colors.HexColor('#6B7280'),  # Gray-500
        fontName=theme.body_font,
        spaceAfter=2*mm
    )

    # Build story (list of flowables)
    story = []

    # Extract contact info
    contact = cv_data.get('contact', {})

    # Header: Name or "Candidate"
    if mode == 'punt':
        display_name = 'Candidate'
    else:
        display_name = contact.get('name') or 'Candidate'

    story.append(Paragraph(display_name, name_style))

    # Location (if available)
    location = contact.get('address', '')
    if location:
        story.append(Paragraph(location, location_style))
    else:
        story.append(Spacer(1, 4*mm))

    # Skills section
    skills_groups = cv_data.get('skills', [])
    if skills_groups:
        story.append(Paragraph('Key Skills', section_style))

        # Collect skills from groups (max 15 total)
        all_skills = []
        for group in skills_groups[:5]:  # Limit to 5 groups
            group_skills = group.get('skills', [])
            # Take up to 5 skills per group to stay within 15 total
            remaining = 15 - len(all_skills)
            if remaining <= 0:
                break
            all_skills.extend(group_skills[:remaining])

        if all_skills:
            # Display as pipe-separated list
            skill_text = ' | '.join(all_skills[:15])
            story.append(Paragraph(skill_text, body_style))

    # Work history section (last 3 jobs)
    work_history = cv_data.get('work_history', [])[:3]
    if work_history:
        story.append(Paragraph('Recent Experience', section_style))

        for entry in work_history:
            position = entry.get('position', '')
            company = entry.get('company', '')
            start_date = entry.get('start_date', '')
            end_date = entry.get('end_date', 'Present')

            # Position at Company
            title_text = f"<b>{_escape_html(position)}</b>"
            if company:
                title_text += f" at {_escape_html(company)}"
            story.append(Paragraph(title_text, job_title_style))

            # Dates
            if start_date or end_date:
                dates_text = f"{start_date or 'N/A'} - {end_date or 'Present'}"
                story.append(Paragraph(dates_text, job_dates_style))

            # Description (max ~150 chars for 3 lines)
            description = entry.get('description', '')
            if description:
                # Truncate to ~150 chars at word boundary
                if len(description) > 150:
                    description = description[:147].rsplit(' ', 1)[0] + '...'
                story.append(Paragraph(_escape_html(description), body_style))

            story.append(Spacer(1, 3*mm))

    elif not skills_groups:
        # No skills and no work history - show placeholder
        story.append(Paragraph('Recent Experience', section_style))
        story.append(Paragraph('Experience details available on request.', body_style))

    # Recruiter footer box
    if recruiter and any([recruiter.get('name'), recruiter.get('phone'), recruiter.get('email')]):
        story.append(Spacer(1, 10*mm))

        recruiter_rows = []

        # Recruiter name (bold)
        if recruiter.get('name'):
            recruiter_rows.append([Paragraph(f"<b>{_escape_html(recruiter['name'])}</b>", body_style)])

        # Phone
        if recruiter.get('phone'):
            recruiter_rows.append([Paragraph(_escape_html(recruiter['phone']), body_style)])

        # Email
        if recruiter.get('email'):
            recruiter_rows.append([Paragraph(_escape_html(recruiter['email']), body_style)])

        if recruiter_rows:
            recruiter_table = Table(recruiter_rows, colWidths=[180*mm])
            recruiter_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F3F4F6')),  # Gray-100
                ('BOX', (0, 0), (-1, -1), 1, primary),
                ('TOPPADDING', (0, 0), (-1, -1), 4*mm),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4*mm),
                ('LEFTPADDING', (0, 0), (-1, -1), 4*mm),
                ('RIGHTPADDING', (0, 0), (-1, -1), 4*mm),
            ]))
            story.append(recruiter_table)

    # Build PDF
    doc.build(story)
    return buffer.getvalue()


def _escape_html(text: str) -> str:
    """Escape HTML special characters for ReportLab Paragraph."""
    if not text:
        return ''
    return (text
        .replace('&', '&amp;')
        .replace('<', '&lt;')
        .replace('>', '&gt;')
        .replace('"', '&quot;')
        .replace("'", '&#39;'))
