"""
CV Schema definitions using TypedDict.

Provides structured types for parsed CV data with confidence scoring.
"""
from typing import TypedDict, List, Optional


class ContactInfo(TypedDict, total=False):
    """Contact information extracted from CV."""
    name: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    address: Optional[str]
    linkedin: Optional[str]
    github: Optional[str]
    portfolio: Optional[str]


class WorkEntry(TypedDict, total=False):
    """A single work history entry."""
    company: str
    position: str
    start_date: Optional[str]
    end_date: Optional[str]
    description: str
    highlights: List[str]
    confidence: float


class EducationEntry(TypedDict, total=False):
    """A single education entry."""
    institution: str
    degree: str
    field_of_study: Optional[str]
    start_date: Optional[str]
    end_date: Optional[str]
    grade: Optional[str]
    confidence: float


class SkillGroup(TypedDict):
    """A group of related skills under a category."""
    category: str
    skills: List[str]


class ExtractionMethods(TypedDict, total=False):
    """Metadata about which extraction method was used for each field."""
    contact: str        # 'regex', 'llm', or 'hybrid'
    work_history: str   # 'regex' or 'llm'
    education: str      # 'regex' or 'llm'
    skills: str         # 'regex' or 'llm'
    llm_available: bool # Whether LLM was available during extraction


class ParsedCV(TypedDict, total=False):
    """Complete parsed CV structure."""
    contact: ContactInfo
    work_history: List[WorkEntry]
    education: List[EducationEntry]
    skills: List[SkillGroup]
    certifications: List[str]
    languages: List[str]
    other_sections: dict
    raw_text: str
    section_order: List[str]
    parse_confidence: float
    warnings: List[str]
    extraction_methods: ExtractionMethods
