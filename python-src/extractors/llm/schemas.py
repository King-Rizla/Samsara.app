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
