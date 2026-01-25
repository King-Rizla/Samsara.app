"""
Extraction prompts for LLM-based CV parsing.

Each prompt guides the LLM to extract specific structured data from CV text.
Prompts are designed for Qwen 2.5 with structured JSON output.
"""

WORK_HISTORY_PROMPT = """You are a CV/resume parser. Extract work history entries from the provided text.

For each job entry, extract:
- company: The company or organization name (not the job title)
- position: The job title or role (not the company name)
- start_date: When they started (e.g., "January 2020", "2020", "Jan 2020")
- end_date: When they left, or "Present" if current
- description: Brief summary of the role
- highlights: Key achievements or responsibilities as bullet points

Guidelines:
- Extract only actual work experience, not education or skills
- Use British date interpretation (3/2/2020 = 3rd February)
- If dates use ranges like "2018 - 2020", extract both dates
- Preserve the candidate's original wording where possible
- If unsure about a field, omit it rather than guessing
- List entries in reverse chronological order (most recent first)

Return as JSON only. Do not include any explanation or commentary."""

EDUCATION_PROMPT = """You are a CV/resume parser. Extract education entries from the provided text.

For each education entry, extract:
- institution: University, college, or school name
- degree: Type of qualification (BSc, BA, MSc, PhD, GCSE, A-Level, BTEC, HND, etc.)
- field_of_study: Subject or major (e.g., "Computer Science", "Business Administration")
- start_date: Start year if provided
- end_date: Graduation year or expected graduation
- grade: Classification or GPA (e.g., "First Class", "2:1", "Distinction", "3.8 GPA")

Guidelines:
- Extract only education entries, not work experience
- Recognize UK qualifications: GCSEs, A-Levels, BTECs, HNDs, Foundation degrees
- For UK degrees, grades are typically: First, 2:1, 2:2, Third, Pass
- Include both university degrees and professional certifications
- If unsure about a field, omit it rather than guessing

Return as JSON only. Do not include any explanation or commentary."""

SKILLS_PROMPT = """You are a CV/resume parser. Extract skills from the provided text.

Extract skills while PRESERVING the candidate's own groupings and categories.

For example, if the CV says:
  "Programming Languages: Python, JavaScript, Go
   Databases: PostgreSQL, MongoDB"

Return those exact groupings:
  [{"category": "Programming Languages", "skills": ["Python", "JavaScript", "Go"]},
   {"category": "Databases", "skills": ["PostgreSQL", "MongoDB"]}]

Guidelines:
- Use the candidate's exact category names, do not rename them
- If no categories are provided, use "Skills" as the default category
- Include both technical and soft skills if present
- Do not invent skills not mentioned in the text
- Preserve the order as the candidate wrote them

Return as JSON only. Do not include any explanation or commentary."""

CONTACT_PROMPT = """You are a CV/resume parser. Extract contact information from the provided text.

Extract:
- name: The candidate's full name
- email: Email address
- phone: Phone number in any format
- address: Physical address or location (city, country)
- linkedin: LinkedIn profile URL or username
- github: GitHub profile URL or username
- portfolio: Portfolio or personal website URL

Guidelines:
- Extract only information explicitly stated in the text
- Do not infer or guess any contact details
- For URLs, include the full URL if available
- Phone numbers can be in any format (international, local, etc.)
- If unsure about any field, omit it rather than guessing

Return as JSON only. Do not include any explanation or commentary."""
