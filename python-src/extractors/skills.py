"""
Skills extraction from CV text.

Preserves candidate's own skill groupings and categories.
"""
import re
from typing import List, Optional, Tuple

from schema.cv_schema import SkillGroup
from extractors.llm.client import OllamaClient
from extractors.llm.schemas import LLMSkills
from extractors.llm.prompts import SKILLS_PROMPT


# Common skill category patterns
CATEGORY_PATTERNS = [
    # Technical categories
    r'(?:programming|coding)\s*(?:languages?)?',
    r'(?:technical|tech)\s*skills?',
    r'(?:software|tools?|technologies?)',
    r'(?:frameworks?|libraries?)',
    r'(?:databases?|data\s*(?:stores?|management))',
    r'(?:cloud|devops|infrastructure)',
    r'(?:operating\s*systems?|os)',
    r'(?:web\s*(?:development|technologies?))',
    r'(?:mobile\s*(?:development|platforms?))',
    # Soft skills
    r'(?:soft|interpersonal|personal)\s*skills?',
    r'(?:communication|leadership|management)\s*skills?',
    # Languages
    r'(?:spoken\s*)?languages?',
    # Other common categories
    r'(?:certifications?|qualifications?)',
    r'(?:methodologies|practices)',
    r'(?:core\s*)?competenc(?:y|ies)',
    r'(?:areas?\s*of\s*)?expertise',
]

CATEGORY_REGEX = re.compile(
    r'^(' + '|'.join(CATEGORY_PATTERNS) + r')[\s:]*$',
    re.IGNORECASE | re.MULTILINE
)

# Bullet and list item patterns
LIST_SEPARATORS = re.compile(r'[,\u2022\u2023\u2043\u2219\u25aa\u25cf\u25cb\u25e6|;]')
BULLET_START = re.compile(r'^[\u2022\u2023\u2043\u2219\u25aa\u25cf\u25cb\u25e6\-\*]\s*')


def _is_category_heading(line: str) -> bool:
    """Check if a line looks like a skill category heading."""
    line = line.strip()
    if not line:
        return False

    # Check against category patterns
    if CATEGORY_REGEX.match(line):
        return True

    # Check for heading indicators
    # Short line ending with colon
    if len(line) < 40 and line.endswith(':'):
        return True

    # Line with all caps that's short (skip title case - skills are often capitalized)
    if len(line) < 30 and line.isupper():
        words = line.replace(':', '').split()
        if 1 <= len(words) <= 4:
            return True

    return False


def _parse_skills_from_text(text: str) -> List[str]:
    """
    Parse individual skills from text.

    Splits on commas, bullets, semicolons, and pipes.
    """
    skills = []

    # First split by newlines
    lines = text.split('\n')

    for line in lines:
        line = line.strip()
        if not line:
            continue

        # Remove bullet at start
        line = BULLET_START.sub('', line)

        # Split by separators
        parts = LIST_SEPARATORS.split(line)

        for part in parts:
            skill = part.strip()
            # Clean up
            skill = re.sub(r'^\-+|\-+$', '', skill).strip()

            # Filter out empty or too short/long (allow 2-char skills like "Go", "R")
            if skill and 1 < len(skill) < 100:
                # Filter out likely non-skills
                if not _is_category_heading(skill):
                    skills.append(skill)

    return skills


def _find_skill_blocks(text: str) -> List[tuple]:
    """
    Find skill category blocks in text.

    Returns list of (category, start_pos, end_pos) tuples.
    """
    lines = text.split('\n')
    blocks = []

    current_category = None
    current_start = 0

    for i, line in enumerate(lines):
        if _is_category_heading(line):
            # Save previous block
            if current_category is not None:
                blocks.append((current_category, current_start, i))

            # Start new block
            current_category = line.strip().rstrip(':').strip()
            current_start = i + 1

    # Save last block
    if current_category is not None:
        blocks.append((current_category, current_start, len(lines)))

    return blocks


def extract_skills(text: str) -> List[SkillGroup]:
    """
    Extract skills from CV text, preserving original groupings.

    Identifies skill categories by headings (technical skills, languages, etc.)
    and extracts individual skills within each category.

    Args:
        text: Skills section text (or full CV text)

    Returns:
        List of SkillGroup dicts with category and skills list
    """
    if not text:
        return []

    groups = []
    lines = text.split('\n')

    # Find skill blocks with categories
    blocks = _find_skill_blocks(text)

    if blocks:
        # Parse each block
        for category, start_line, end_line in blocks:
            block_text = '\n'.join(lines[start_line:end_line])
            skills = _parse_skills_from_text(block_text)

            if skills:
                groups.append(SkillGroup(
                    category=category,
                    skills=skills
                ))
    else:
        # No clear categories - treat as single group
        skills = _parse_skills_from_text(text)
        if skills:
            groups.append(SkillGroup(
                category='Skills',
                skills=skills
            ))

    return groups


def merge_skill_groups(groups: List[SkillGroup]) -> List[SkillGroup]:
    """
    Merge skill groups with similar categories.

    Useful when skills are scattered across multiple sections.

    Args:
        groups: List of SkillGroup dicts

    Returns:
        Merged list of SkillGroup dicts
    """
    merged = {}

    for group in groups:
        category = group['category'].lower()

        # Normalize common category names
        if 'technical' in category or 'programming' in category or 'coding' in category:
            key = 'Technical Skills'
        elif 'language' in category and 'programming' not in category:
            key = 'Languages'
        elif 'soft' in category or 'interpersonal' in category:
            key = 'Soft Skills'
        else:
            key = group['category']

        if key in merged:
            # Extend existing group, avoiding duplicates
            existing_skills = set(s.lower() for s in merged[key]['skills'])
            for skill in group['skills']:
                if skill.lower() not in existing_skills:
                    merged[key]['skills'].append(skill)
                    existing_skills.add(skill.lower())
        else:
            merged[key] = SkillGroup(
                category=key,
                skills=list(group['skills'])
            )

    return list(merged.values())


def extract_skills_hybrid(
    text: str,
    llm_client: Optional[OllamaClient] = None
) -> Tuple[List[SkillGroup], dict]:
    """
    Extract skills with LLM, fallback to regex.

    Returns:
        Tuple of (skill_groups, metadata with method/llm_available)
    """
    metadata = {"method": "regex", "llm_available": False}

    # Try LLM extraction first
    if llm_client and llm_client.is_available():
        metadata["llm_available"] = True

        llm_result = llm_client.extract(
            text=text,
            prompt=SKILLS_PROMPT,
            schema=LLMSkills,
            temperature=0.0
        )

        if llm_result and llm_result.groups:
            skill_groups = []
            for g in llm_result.groups:
                group = _llm_to_skill_group(g)
                if group['skills']:  # Only add groups with actual skills
                    skill_groups.append(group)

            if skill_groups:
                metadata["method"] = "llm"
                return skill_groups, metadata

    # Fallback to regex
    skills = extract_skills(text)
    return skills, metadata


def _llm_to_skill_group(llm_group) -> SkillGroup:
    """Convert LLM output to schema SkillGroup."""
    return SkillGroup(
        category=llm_group.category or 'General',
        skills=llm_group.skills or []
    )
