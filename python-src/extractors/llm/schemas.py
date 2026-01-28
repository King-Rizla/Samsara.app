"""
Pydantic schemas for LLM extraction output.

These models generate JSON schemas that Ollama uses for structured output.
Field descriptions become part of the schema and guide LLM extraction.
"""
from typing import List, Optional
from pydantic import BaseModel, Field


class LLMWorkEntry(BaseModel):
    """A single work history entry extracted by LLM."""

    company: str = Field(
        description="Company or organization name (not the job title)"
    )
    position: str = Field(
        description="Job title or role (not the company name)"
    )
    start_date: Optional[str] = Field(
        default=None,
        description="Start date in format 'Month Year' (e.g., 'January 2020') or just 'YYYY'"
    )
    end_date: Optional[str] = Field(
        default=None,
        description="End date in format 'Month Year', or 'Present' if current role"
    )
    description: str = Field(
        default="",
        description="Brief description or summary of responsibilities"
    )
    highlights: List[str] = Field(
        default_factory=list,
        description="Key achievements, responsibilities, or bullet points"
    )


class LLMWorkHistory(BaseModel):
    """Complete work history extraction."""

    entries: List[LLMWorkEntry] = Field(
        default_factory=list,
        description="List of work experience entries, most recent first"
    )


class LLMEducationEntry(BaseModel):
    """A single education entry extracted by LLM."""

    institution: str = Field(
        description="University, college, or school name"
    )
    degree: str = Field(
        description="Degree type (BSc, BA, MSc, PhD, GCSE, A-Level, BTEC, etc.)"
    )
    field_of_study: Optional[str] = Field(
        default=None,
        description="Subject or major field of study (e.g., 'Computer Science')"
    )
    start_date: Optional[str] = Field(
        default=None,
        description="Start year if provided"
    )
    end_date: Optional[str] = Field(
        default=None,
        description="Graduation year or expected graduation year"
    )
    grade: Optional[str] = Field(
        default=None,
        description="Grade, classification, or GPA (e.g., '2:1', 'First Class', 'Distinction', '3.8')"
    )


class LLMEducation(BaseModel):
    """Complete education extraction."""

    entries: List[LLMEducationEntry] = Field(
        default_factory=list,
        description="List of education entries"
    )


class LLMSkillGroup(BaseModel):
    """A group of related skills under a category."""

    category: str = Field(
        description="Category name exactly as written by the candidate"
    )
    skills: List[str] = Field(
        default_factory=list,
        description="Individual skills listed in this category"
    )


class LLMSkills(BaseModel):
    """Skills extraction preserving candidate's own groupings."""

    groups: List[LLMSkillGroup] = Field(
        default_factory=list,
        description="Skill groups with categories as the candidate organized them"
    )


class LLMContact(BaseModel):
    """Contact information extracted by LLM (fallback for regex)."""

    name: Optional[str] = Field(
        default=None,
        description="Full name of the candidate"
    )
    email: Optional[str] = Field(
        default=None,
        description="Email address"
    )
    phone: Optional[str] = Field(
        default=None,
        description="Phone number in any format"
    )
    address: Optional[str] = Field(
        default=None,
        description="Physical address or location"
    )
    linkedin: Optional[str] = Field(
        default=None,
        description="LinkedIn profile URL or username"
    )
    github: Optional[str] = Field(
        default=None,
        description="GitHub profile URL or username"
    )
    portfolio: Optional[str] = Field(
        default=None,
        description="Portfolio or personal website URL"
    )


class LLMFullExtraction(BaseModel):
    """Complete CV extraction in a single LLM call - faster and more accurate."""

    contact: LLMContact = Field(
        default_factory=LLMContact,
        description="Contact information: name, email, phone, address, linkedin, github, portfolio"
    )
    work_history: List[LLMWorkEntry] = Field(
        default_factory=list,
        description="All work experience entries, most recent first"
    )
    education: List[LLMEducationEntry] = Field(
        default_factory=list,
        description="All education entries"
    )
    skills: List[LLMSkillGroup] = Field(
        default_factory=list,
        description="Skills grouped by category as the candidate organized them"
    )


# ============================================================================
# JD (Job Description) Extraction Schemas
# ============================================================================

class LLMSkillRequirement(BaseModel):
    """A skill requirement from a job description."""

    skill: str = Field(
        description="The skill name (e.g., 'Python', 'React', 'Project Management')"
    )
    importance: str = Field(
        description="'required', 'preferred', or 'nice-to-have'"
    )
    category: Optional[str] = Field(
        default=None,
        description="Category if grouped in JD (e.g., 'Technical Skills', 'Soft Skills')"
    )


class LLMJDExtraction(BaseModel):
    """Complete JD extraction in a single LLM call."""

    title: str = Field(
        description="Job title (e.g., 'Senior Software Engineer', 'Product Manager')"
    )
    company: Optional[str] = Field(
        default=None,
        description="Company name if mentioned"
    )

    required_skills: List[LLMSkillRequirement] = Field(
        default_factory=list,
        description="Skills explicitly marked as required, mandatory, or must-have"
    )
    preferred_skills: List[LLMSkillRequirement] = Field(
        default_factory=list,
        description="Skills marked as preferred, desired, nice-to-have, or bonus"
    )

    experience_min_years: Optional[int] = Field(
        default=None,
        description="Minimum years of experience required (e.g., '5+ years' -> 5)"
    )
    experience_max_years: Optional[int] = Field(
        default=None,
        description="Maximum years of experience if range given"
    )

    education_level: Optional[str] = Field(
        default=None,
        description="Required education level (Bachelor's, Master's, PhD)"
    )
    certifications: List[str] = Field(
        default_factory=list,
        description="Required or preferred certifications"
    )

    matching_metadata: Optional['LLMMatchingMetadata'] = Field(
        default=None,
        description="Enhanced matching data: skill variants, boolean strings, search hints"
    )


# ============================================================================
# Matching Metadata Schemas (generated alongside JD extraction)
# ============================================================================

class LLMExpandedSkill(BaseModel):
    """A skill with its semantic variants and related tools."""

    skill: str = Field(description="Original skill name from JD")
    variants: List[str] = Field(
        default_factory=list,
        description="Alternative names, abbreviations, synonyms. Limit to 5 most common."
    )
    related_tools: List[str] = Field(
        default_factory=list,
        description="Related frameworks, libraries, tools. Limit to 5 most relevant."
    )


class LLMBooleanStrings(BaseModel):
    """Three-tier boolean search strings for candidate sourcing."""

    wide: str = Field(
        description="Broad search with many OR terms. Keep under 250 chars."
    )
    midline: str = Field(
        description="Balanced search: core skills AND, variations OR. Keep under 250 chars."
    )
    narrow: str = Field(
        description="Strict search with required terms only as AND terms. Keep under 200 chars."
    )


class LLMSearchHints(BaseModel):
    """Search hints for candidate sourcing."""

    suggested_titles: List[str] = Field(
        default_factory=list,
        description="Related job titles to search for. Limit to 5."
    )
    industries: List[str] = Field(
        default_factory=list,
        description="Relevant industries. Limit to 3."
    )
    negative_keywords: List[str] = Field(
        default_factory=list,
        description="Terms to exclude from searches. Limit to 5."
    )


class LLMMatchingMetadata(BaseModel):
    """Comprehensive matching metadata generated alongside JD extraction."""

    expanded_skills: List[LLMExpandedSkill] = Field(default_factory=list)
    boolean_strings: LLMBooleanStrings
    search_hints: LLMSearchHints = Field(default_factory=LLMSearchHints)


# Resolve forward reference
LLMJDExtraction.model_rebuild()
