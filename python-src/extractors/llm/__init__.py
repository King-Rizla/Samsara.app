"""
LLM extraction module for CV parsing.

Uses Ollama with local LLM (Qwen 2.5 7B) for structured data extraction.
Provides graceful fallback when Ollama is unavailable.
"""
from extractors.llm.client import OllamaClient
from extractors.llm.schemas import (
    LLMWorkEntry,
    LLMWorkHistory,
    LLMEducationEntry,
    LLMEducation,
    LLMSkillGroup,
    LLMSkills,
    LLMContact,
)
from extractors.llm.prompts import (
    WORK_HISTORY_PROMPT,
    EDUCATION_PROMPT,
    SKILLS_PROMPT,
    CONTACT_PROMPT,
)

__all__ = [
    # Client
    "OllamaClient",
    # Schemas
    "LLMWorkEntry",
    "LLMWorkHistory",
    "LLMEducationEntry",
    "LLMEducation",
    "LLMSkillGroup",
    "LLMSkills",
    "LLMContact",
    # Prompts
    "WORK_HISTORY_PROMPT",
    "EDUCATION_PROMPT",
    "SKILLS_PROMPT",
    "CONTACT_PROMPT",
]
