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


FULL_EXTRACTION_PROMPT = """You are a CV/resume parser. Extract ALL information from this CV in a single pass.

The CV text may be jumbled due to multi-column PDF layouts. Use your understanding of CV structure to correctly categorize each piece of information.

## CONTACT INFORMATION
Extract: name, email, phone, address, linkedin, github, portfolio
- Only extract what is explicitly stated
- Do not guess or infer contact details

## WORK HISTORY
Extract ALL jobs, even if they appear mixed with other sections. For each job:
- company: Organization name (NOT the job title)
- position: Job title/role (NOT the company)
- start_date: When started (e.g., "January 2020", "2020")
- end_date: When ended, or "Present" if current
- description: Brief role summary
- highlights: Key achievements as bullet points

Guidelines:
- "Personal Trainer" is a JOB TITLE, not a skill
- "Warehouse Operative" is a JOB TITLE, not a skill
- Look for date ranges near job titles to identify work entries
- List jobs in reverse chronological order (most recent first)
- Use British date format (3/2/2020 = 3rd February)

## EDUCATION
Extract ALL education entries. For each:
- institution: School/college/university name
- degree: Qualification type (BSc, BA, A-Level, GCSE, BTEC, etc.)
- field_of_study: Subject/major
- start_date, end_date: Years attended
- grade: Classification if mentioned (First, 2:1, Distinction, etc.)

## SKILLS
Extract actual SKILLS only. Look for a "Skills" section in the CV.

What ARE skills (extract these):
- Soft skills: Management Skills, Leadership, Communication, Creativity, Critical Thinking
- Technical skills: Digital Marketing, Copy Writing, SEO, Excel, PowerPoint
- Languages: English, Spanish, French
- Tools/Software: Photoshop, Salesforce, SAP

What are NOT skills (do NOT extract these):
- Job descriptions: "Loading containers", "Making phone calls", "Working shifts"
- Job titles: "Warehouse Operative", "Personal Trainer", "Sales Assistant"
- Company names, dates, locations

For each skill group:
- category: Use candidate's exact category name (e.g., "Technical Skills"), or "Skills" if ungrouped
- skills: List of individual skill names only (short phrases, not sentences)

Return as JSON only. Do not include any explanation."""


# ============================================================================
# JD (Job Description) Extraction Prompt
# ============================================================================

JD_EXTRACTION_PROMPT = """You are a job description parser. Extract structured requirements AND matching metadata from this job description in a single pass.

## PART 1: REQUIREMENTS EXTRACTION

Extract these fields:
- title: Job title exactly as written
- company: Company name if mentioned (null if not)
- required_skills: Skills marked as REQUIRED/MANDATORY/MUST-HAVE/ESSENTIAL
- preferred_skills: Skills marked as PREFERRED/DESIRED/NICE-TO-HAVE/BONUS
- experience_min_years: Minimum years (e.g., "5+ years" -> 5)
- experience_max_years: Maximum years if range given (null if not)
- education_level: Required education (Bachelor's, Master's, PhD, etc.)
- certifications: List of required/preferred certifications

Each skill: {"skill": name, "importance": "required" or "preferred", "category": category or null}

## PART 2: MATCHING METADATA

Generate matching_metadata to help find candidates:

### expanded_skills
For each key skill from the JD, generate:
- skill: Original skill name
- variants: Up to 5 alternative names, abbreviations, synonyms (e.g., "JavaScript" -> ["JS", "ECMAScript", "Javascript"])
- related_tools: Up to 5 related frameworks, libraries, tools (e.g., "JavaScript" -> ["React", "Node.js", "TypeScript", "Vue", "Angular"])

### boolean_strings
Three search strings using Boolean syntax (AND, OR, NOT, quotes, parentheses):
- wide: Broad search, many OR terms, all skill variations. Keep under 250 chars.
- midline: Balanced - core skills as AND, variations as OR groups. Keep under 250 chars.
- narrow: Strict - only required skills as AND terms. Keep under 200 chars.

Boolean syntax rules:
- Use AND between required groups
- Use OR between alternatives within parentheses
- Quote multi-word terms: "project management"
- Example: (Python OR "Python 3") AND (React OR Angular OR Vue) AND "machine learning"

### search_hints
- suggested_titles: Up to 5 related job titles candidates might hold
- industries: Up to 3 relevant industries
- negative_keywords: Up to 5 terms to exclude (e.g., "intern", "junior" for senior roles)

## OUTPUT FORMAT - Return this exact JSON structure:
{
  "title": "Senior Software Engineer",
  "company": "Acme Corp",
  "required_skills": [
    {"skill": "Python", "importance": "required", "category": "Technical"},
    {"skill": "SQL", "importance": "required", "category": "Technical"}
  ],
  "preferred_skills": [
    {"skill": "Kubernetes", "importance": "preferred", "category": "DevOps"}
  ],
  "experience_min_years": 5,
  "experience_max_years": null,
  "education_level": "Bachelor's",
  "certifications": ["AWS Certified"],
  "matching_metadata": {
    "expanded_skills": [
      {
        "skill": "Python",
        "variants": ["Python 3", "Python3", "Py"],
        "related_tools": ["Django", "Flask", "FastAPI", "NumPy", "Pandas"]
      },
      {
        "skill": "SQL",
        "variants": ["Structured Query Language"],
        "related_tools": ["PostgreSQL", "MySQL", "SQL Server", "SQLite"]
      }
    ],
    "boolean_strings": {
      "wide": "(Python OR Py OR Django OR Flask) OR (SQL OR PostgreSQL OR MySQL) OR (Kubernetes OR K8s OR Docker)",
      "midline": "(Python OR \"Python 3\") AND (SQL OR PostgreSQL OR MySQL) AND (Kubernetes OR K8s)",
      "narrow": "Python AND SQL AND Kubernetes"
    },
    "search_hints": {
      "suggested_titles": ["Software Engineer", "Backend Developer", "Python Developer", "Full Stack Engineer"],
      "industries": ["Technology", "Software", "SaaS"],
      "negative_keywords": ["intern", "junior", "entry level", "graduate", "trainee"]
    }
  }
}

Guidelines:
- Only extract what is EXPLICITLY stated in the JD for Part 1
- Use your knowledge of the industry for Part 2 (variants, booleans, hints)
- Do not infer or guess requirements not mentioned
- Use null for fields not mentioned
- Return ONLY the JSON object, no explanation"""
