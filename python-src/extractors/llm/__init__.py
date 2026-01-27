"""
LLM extraction module for CV parsing.

Supports two modes:
- Privacy Mode: Local Ollama with Qwen 2.5 7B (slower, data stays local)
- Speed Mode: OpenAI GPT-4o-mini (fast, requires API key)
"""
from extractors.llm.client import OllamaClient
from extractors.llm.openai_client import OpenAIClient
from extractors.llm.schemas import (
    LLMWorkEntry,
    LLMWorkHistory,
    LLMEducationEntry,
    LLMEducation,
    LLMSkillGroup,
    LLMSkills,
    LLMContact,
    LLMFullExtraction,
)
from extractors.llm.prompts import (
    WORK_HISTORY_PROMPT,
    EDUCATION_PROMPT,
    SKILLS_PROMPT,
    CONTACT_PROMPT,
    FULL_EXTRACTION_PROMPT,
)

__all__ = [
    # Clients
    "OllamaClient",
    "OpenAIClient",
    # Schemas
    "LLMWorkEntry",
    "LLMWorkHistory",
    "LLMEducationEntry",
    "LLMEducation",
    "LLMSkillGroup",
    "LLMSkills",
    "LLMContact",
    "LLMFullExtraction",
    # Prompts
    "WORK_HISTORY_PROMPT",
    "EDUCATION_PROMPT",
    "SKILLS_PROMPT",
    "CONTACT_PROMPT",
    "FULL_EXTRACTION_PROMPT",
]
