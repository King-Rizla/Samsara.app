/**
 * Template variable substitution engine.
 * Uses {{variable}} syntax for placeholder replacement.
 */

export interface TemplateVariables {
  candidate_name: string;
  candidate_first_name: string;
  candidate_email?: string;
  candidate_phone?: string;
  role_title: string;
  company_name: string;
  recruiter_name?: string;
  recruiter_phone?: string;
  recruiter_email?: string;
}

/**
 * Available variables for template authoring.
 * Used by UI to populate the variable dropdown.
 */
export const AVAILABLE_VARIABLES: {
  key: keyof TemplateVariables;
  label: string;
  example: string;
  category: "candidate" | "role" | "recruiter";
}[] = [
  {
    key: "candidate_name",
    label: "Candidate Name",
    example: "John Smith",
    category: "candidate",
  },
  {
    key: "candidate_first_name",
    label: "Candidate First Name",
    example: "John",
    category: "candidate",
  },
  {
    key: "candidate_email",
    label: "Candidate Email",
    example: "john.smith@email.com",
    category: "candidate",
  },
  {
    key: "candidate_phone",
    label: "Candidate Phone",
    example: "+1 555 987 6543",
    category: "candidate",
  },
  {
    key: "role_title",
    label: "Role Title",
    example: "Senior Software Engineer",
    category: "role",
  },
  {
    key: "company_name",
    label: "Company Name",
    example: "TechCorp Ltd",
    category: "role",
  },
  {
    key: "recruiter_name",
    label: "Recruiter Name",
    example: "Jane Doe",
    category: "recruiter",
  },
  {
    key: "recruiter_phone",
    label: "Recruiter Phone",
    example: "+1 555 123 4567",
    category: "recruiter",
  },
  {
    key: "recruiter_email",
    label: "Recruiter Email",
    example: "jane@recruit.com",
    category: "recruiter",
  },
];

/**
 * Build example data object from AVAILABLE_VARIABLES.
 */
function getExampleData(): TemplateVariables {
  const data: Partial<TemplateVariables> = {};
  for (const v of AVAILABLE_VARIABLES) {
    (data as Record<string, string>)[v.key] = v.example;
  }
  return data as TemplateVariables;
}

/**
 * Render a template by replacing {{variable}} with values.
 * Unmatched variables are left as-is (for visibility).
 */
export function renderTemplate(
  template: string,
  variables: Partial<TemplateVariables>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = variables[key as keyof TemplateVariables];
    return value !== undefined ? String(value) : match;
  });
}

/**
 * Preview a template with example data.
 * Used for live preview in the template editor.
 */
export function previewTemplate(template: string): string {
  return renderTemplate(template, getExampleData());
}

/**
 * Extract all variable names used in a template.
 * Returns array of variable keys found in the template.
 */
export function extractTemplateVariables(template: string): string[] {
  const matches = template.matchAll(/\{\{(\w+)\}\}/g);
  const variables = new Set<string>();
  for (const match of matches) {
    variables.add(match[1]);
  }
  return Array.from(variables);
}

/**
 * Validate that all variables in template are known variables.
 * Returns array of unknown variable names.
 */
export function validateTemplateVariables(template: string): string[] {
  const used = extractTemplateVariables(template);
  const known = new Set(AVAILABLE_VARIABLES.map((v) => v.key));
  return used.filter((v) => !known.has(v as keyof TemplateVariables));
}
