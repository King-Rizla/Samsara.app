/**
 * Skill variant mapping for matching skills across different naming conventions.
 * Keys are canonical (lowercase) skill names, values are common aliases.
 */
export const SKILL_VARIANTS: Record<string, string[]> = {
  // Programming languages
  'javascript': ['js', 'ecmascript', 'es6', 'es2015', 'es2016', 'es2017', 'es2018', 'es2019', 'es2020'],
  'typescript': ['ts'],
  'python': ['py', 'python3', 'python 3'],
  'c#': ['csharp', 'c sharp', 'dotnet', '.net', 'c-sharp'],
  'c++': ['cpp', 'cplusplus', 'c plus plus'],
  'golang': ['go'],
  'ruby': ['rb'],
  'rust': ['rs'],

  // Frontend frameworks
  'react': ['reactjs', 'react.js', 'react js'],
  'angular': ['angularjs', 'angular.js', 'angular 2', 'angular2'],
  'vue': ['vuejs', 'vue.js', 'vue js', 'vue 3', 'vue3'],
  'svelte': ['sveltejs', 'svelte.js'],
  'next.js': ['nextjs', 'next js', 'next'],
  'nuxt': ['nuxtjs', 'nuxt.js'],

  // Backend frameworks
  'node.js': ['nodejs', 'node js', 'node'],
  'express': ['expressjs', 'express.js'],
  'django': ['django rest', 'drf'],
  'flask': ['flask api'],
  'spring': ['spring boot', 'springboot'],
  'fastapi': ['fast api'],
  '.net core': ['dotnet core', 'asp.net core', 'aspnet core'],

  // Databases
  'postgresql': ['postgres', 'psql', 'pgsql'],
  'mongodb': ['mongo'],
  'mysql': ['mariadb'],
  'sql server': ['mssql', 'microsoft sql', 'ms sql'],
  'redis': ['redis cache'],
  'elasticsearch': ['elastic', 'es'],

  // Cloud
  'aws': ['amazon web services', 'amazon aws', 'amazon cloud'],
  'azure': ['microsoft azure', 'ms azure'],
  'gcp': ['google cloud', 'google cloud platform'],
  'kubernetes': ['k8s'],
  'docker': ['containerization', 'containers'],

  // Tools & practices
  'git': ['github', 'gitlab', 'bitbucket', 'version control'],
  'ci/cd': ['continuous integration', 'continuous deployment', 'jenkins', 'github actions'],
  'agile': ['scrum', 'kanban', 'agile methodology'],
  'devops': ['dev ops', 'development operations'],
  'test-driven development': ['tdd', 'test driven'],
  'restful api': ['rest api', 'rest', 'restful'],
  'graphql': ['graph ql'],

  // Soft skills
  'communication': ['communication skills', 'verbal communication', 'written communication'],
  'leadership': ['team leadership', 'leading teams', 'team lead'],
  'project management': ['project mgmt', 'pm', 'managing projects'],
  'problem solving': ['problem-solving', 'analytical skills', 'critical thinking'],
  'teamwork': ['team work', 'collaboration', 'team player'],
};

/**
 * Normalize a skill name for consistent matching.
 * - Lowercase
 * - Trim whitespace
 * - Normalize multiple spaces to single space
 * - Remove special characters except -, +, #, .
 */
export function normalizeSkill(skill: string): string {
  return skill
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s\-+#.]/g, '');
}

/**
 * Get all known variants of a skill (including the canonical name).
 * Returns empty array if skill has no known variants.
 */
export function getSkillVariants(skill: string): string[] {
  const normalized = normalizeSkill(skill);

  // Check if skill is a canonical key
  if (SKILL_VARIANTS[normalized]) {
    return [normalized, ...SKILL_VARIANTS[normalized]];
  }

  // Check if skill is a variant - find its canonical form
  for (const [canonical, variants] of Object.entries(SKILL_VARIANTS)) {
    if (variants.includes(normalized)) {
      return [canonical, ...variants];
    }
  }

  // No known variants
  return [];
}

/**
 * Check if two skills match (considering variants).
 */
export function skillsMatch(skill1: string, skill2: string): boolean {
  const norm1 = normalizeSkill(skill1);
  const norm2 = normalizeSkill(skill2);

  // Exact match
  if (norm1 === norm2) return true;

  // Check variants
  const variants1 = getSkillVariants(norm1);
  const variants2 = getSkillVariants(norm2);

  // If either has variants, check for overlap
  if (variants1.length > 0 && variants2.length > 0) {
    return variants1.some(v => variants2.includes(v));
  }

  // Substring matching for compound skills
  // "Microsoft Excel" matches "Excel", "React Native" matches "React"
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    return true;
  }

  return false;
}
