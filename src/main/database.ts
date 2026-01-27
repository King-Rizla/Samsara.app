import Database from 'better-sqlite3';
import { app } from 'electron';
import * as path from 'path';
import * as crypto from 'crypto';

let db: Database.Database | null = null;

// TypeScript interfaces matching Python schema
export interface ContactInfo {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;
}

export interface WorkEntry {
  company: string;
  position: string;
  start_date?: string;
  end_date?: string;
  description: string;
  highlights: string[];
  confidence: number;
}

export interface EducationEntry {
  institution: string;
  degree: string;
  field_of_study?: string;
  start_date?: string;
  end_date?: string;
  grade?: string;
  confidence: number;
}

export interface SkillGroup {
  category: string;
  skills: string[];
}

export interface ParsedCV {
  contact: ContactInfo;
  work_history: WorkEntry[];
  education: EducationEntry[];
  skills: SkillGroup[];
  certifications: string[];
  languages: string[];
  other_sections: Record<string, string>;
  raw_text: string;
  section_order: string[];
  parse_confidence: number;
  warnings: string[];
  extract_time_ms?: number;
  document_type?: string;
  page_count?: number;
}

export interface CVRecord {
  id: string;
  file_path: string;
  file_name: string;
  created_at: string;
  updated_at: string;
  contact_json: string;
  contact_confidence: number;
  work_history_json: string | null;
  education_json: string | null;
  skills_json: string | null;
  certifications_json: string | null;
  languages_json: string | null;
  other_sections_json: string | null;
  raw_text: string | null;
  section_order_json: string | null;
  parse_confidence: number;
  warnings_json: string | null;
  parse_time_ms: number | null;
}

export interface CVSummary {
  id: string;
  file_name: string;
  contact_json: string;
  parse_confidence: number;
  created_at: string;
}

// ============================================================================
// Project Types and CRUD
// ============================================================================

export interface ProjectRecord {
  id: string;
  name: string;
  client_name: string | null;
  description: string | null;
  is_archived: number;  // SQLite stores as 0/1
  created_at: string;
  updated_at: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  client_name: string | null;
  description: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  cv_count: number;
  jd_count: number;
}

export interface CreateProjectInput {
  name: string;
  client_name?: string;
  description?: string;
}

export function initDatabase(): Database.Database {
  if (db) return db;

  try {
    const dbPath = path.join(app.getPath('userData'), 'samsara.db');
    console.log('Initializing database at:', dbPath);
    db = new Database(dbPath);

    // Enable WAL mode for better concurrent access
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');

    // Enable foreign keys (must be set per connection)
    db.pragma('foreign_keys = ON');

    // Initialize schema
    db.exec(`
      CREATE TABLE IF NOT EXISTS app_meta (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);

    // Create CV storage table
    db.exec(`
      CREATE TABLE IF NOT EXISTS cvs (
        id TEXT PRIMARY KEY,
        file_path TEXT NOT NULL,
        file_name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        -- Contact fields with confidence
        contact_json TEXT NOT NULL,
        contact_confidence REAL NOT NULL,
        -- Structured data as JSON (for agent consumption)
        work_history_json TEXT,
        education_json TEXT,
        skills_json TEXT,
        certifications_json TEXT,
        languages_json TEXT,
        other_sections_json TEXT,
        -- Metadata
        raw_text TEXT,
        section_order_json TEXT,
        parse_confidence REAL NOT NULL,
        warnings_json TEXT,
        parse_time_ms INTEGER
      );
    `);

    // Create JD (Job Description) storage table
    db.exec(`
      CREATE TABLE IF NOT EXISTS job_descriptions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        company TEXT,
        raw_text TEXT NOT NULL,
        required_skills_json TEXT,
        preferred_skills_json TEXT,
        experience_min INTEGER,
        experience_max INTEGER,
        education_level TEXT,
        certifications_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS cv_jd_matches (
        cv_id TEXT NOT NULL,
        jd_id TEXT NOT NULL,
        match_score INTEGER NOT NULL,
        matched_skills_json TEXT,
        missing_required_json TEXT,
        missing_preferred_json TEXT,
        calculated_at TEXT NOT NULL,
        PRIMARY KEY (cv_id, jd_id),
        FOREIGN KEY (cv_id) REFERENCES cvs(id) ON DELETE CASCADE,
        FOREIGN KEY (jd_id) REFERENCES job_descriptions(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_matches_jd ON cv_jd_matches(jd_id);
      CREATE INDEX IF NOT EXISTS idx_matches_score ON cv_jd_matches(jd_id, match_score DESC);
    `);

    // Schema versioning and migrations
    const version = db.pragma('user_version', { simple: true }) as number;

    if (version < 1) {
      console.log('Migrating database to version 1 (projects)...');

      // Projects table
      db.exec(`
        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          client_name TEXT,
          description TEXT,
          is_archived INTEGER DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      // Add project_id to cvs (nullable for existing data migration)
      // SQLite doesn't support adding FK constraints via ALTER TABLE, so we add nullable column
      // Check if column exists first to avoid error on re-run
      const cvColumns = db.prepare("PRAGMA table_info(cvs)").all() as { name: string }[];
      if (!cvColumns.some(col => col.name === 'project_id')) {
        db.exec(`ALTER TABLE cvs ADD COLUMN project_id TEXT`);
      }

      const jdColumns = db.prepare("PRAGMA table_info(job_descriptions)").all() as { name: string }[];
      if (!jdColumns.some(col => col.name === 'project_id')) {
        db.exec(`ALTER TABLE job_descriptions ADD COLUMN project_id TEXT`);
      }

      // Create indexes for project filtering
      db.exec(`CREATE INDEX IF NOT EXISTS idx_cvs_project ON cvs(project_id)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_jds_project ON job_descriptions(project_id)`);

      // Create Default Project for orphaned data
      const defaultProjectId = 'default-project';
      const now = new Date().toISOString();
      db.prepare(`
        INSERT OR IGNORE INTO projects (id, name, client_name, description, is_archived, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(defaultProjectId, 'Default Project', null, 'Auto-created for existing CVs and JDs', 0, now, now);

      // Migrate existing CVs/JDs to Default Project
      db.exec(`UPDATE cvs SET project_id = 'default-project' WHERE project_id IS NULL`);
      db.exec(`UPDATE job_descriptions SET project_id = 'default-project' WHERE project_id IS NULL`);

      db.pragma('user_version = 1');
      console.log('Database migrated to version 1');
    }

    if (version < 2) {
      console.log('Migrating database to version 2 (queue status)...');

      // Check if columns exist before adding
      const cvColumns = db.prepare("PRAGMA table_info(cvs)").all() as { name: string }[];

      if (!cvColumns.some(col => col.name === 'status')) {
        db.exec(`ALTER TABLE cvs ADD COLUMN status TEXT NOT NULL DEFAULT 'completed'`);
      }
      if (!cvColumns.some(col => col.name === 'error_message')) {
        db.exec(`ALTER TABLE cvs ADD COLUMN error_message TEXT`);
      }
      if (!cvColumns.some(col => col.name === 'processing_started_at')) {
        db.exec(`ALTER TABLE cvs ADD COLUMN processing_started_at TEXT`);
      }

      db.exec(`CREATE INDEX IF NOT EXISTS idx_cvs_status ON cvs(status)`);
      db.pragma('user_version = 2');
      console.log('Database migrated to version 2');
    }

    // Store init timestamp
    const stmt = db.prepare('INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)');
    stmt.run('initialized_at', new Date().toISOString());

    console.log('Database initialized successfully with WAL mode');
    return db;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

export function getDatabase(): Database.Database {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.');
  return db;
}

export function closeDatabase(): void {
  if (db) {
    console.log('Closing database connection');
    db.close();
    db = null;
  }
}

/**
 * Calculate contact confidence from parsed CV contact info.
 * Higher confidence when more fields are present.
 */
function calculateContactConfidence(contact: ContactInfo): number {
  // Weight: name and email are most important
  let score = 0;
  if (contact.name) score += 0.3;
  if (contact.email) score += 0.3;
  if (contact.phone) score += 0.2;
  if (contact.linkedin || contact.github || contact.portfolio) score += 0.1;
  if (contact.address) score += 0.1;

  return Math.min(1.0, score);
}

/**
 * Insert or replace a CV record in the database.
 * Returns the generated ID.
 */
export function insertCV(cv: ParsedCV, filePath: string, projectId?: string): string {
  const database = getDatabase();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const fileName = path.basename(filePath);
  const contactConfidence = calculateContactConfidence(cv.contact);

  const stmt = database.prepare(`
    INSERT OR REPLACE INTO cvs (
      id, file_path, file_name, created_at, updated_at,
      contact_json, contact_confidence,
      work_history_json, education_json, skills_json,
      certifications_json, languages_json, other_sections_json,
      raw_text, section_order_json, parse_confidence,
      warnings_json, parse_time_ms, project_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    filePath,
    fileName,
    now,
    now,
    JSON.stringify(cv.contact),
    contactConfidence,
    cv.work_history ? JSON.stringify(cv.work_history) : null,
    cv.education ? JSON.stringify(cv.education) : null,
    cv.skills ? JSON.stringify(cv.skills) : null,
    cv.certifications ? JSON.stringify(cv.certifications) : null,
    cv.languages ? JSON.stringify(cv.languages) : null,
    cv.other_sections ? JSON.stringify(cv.other_sections) : null,
    cv.raw_text || null,
    cv.section_order ? JSON.stringify(cv.section_order) : null,
    cv.parse_confidence,
    cv.warnings ? JSON.stringify(cv.warnings) : null,
    cv.extract_time_ms || null,
    projectId || null
  );

  console.log(`Inserted CV with ID: ${id}`);
  return id;
}

/**
 * Get a CV by its ID.
 * Returns null if not found.
 */
export function getCV(id: string): CVRecord | null {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM cvs WHERE id = ?');
  const row = stmt.get(id) as CVRecord | undefined;
  return row || null;
}

/**
 * Get all CVs with summary information.
 * Returns id, file_name, contact_json, parse_confidence, created_at.
 * Optionally filter by projectId.
 */
export function getAllCVs(projectId?: string): CVSummary[] {
  const database = getDatabase();

  let query = `
    SELECT id, file_name, contact_json, parse_confidence, created_at
    FROM cvs
  `;

  const params: unknown[] = [];
  if (projectId) {
    query += ' WHERE project_id = ?';
    params.push(projectId);
  }

  query += ' ORDER BY created_at DESC';

  const stmt = database.prepare(query);
  return params.length ? stmt.all(...params) as CVSummary[] : stmt.all() as CVSummary[];
}

/**
 * Delete a CV by its ID.
 * Returns true if a record was deleted.
 */
export function deleteCV(id: string): boolean {
  const database = getDatabase();
  const stmt = database.prepare('DELETE FROM cvs WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

/**
 * Update a specific field in a CV record.
 * fieldPath format: "contact.email", "work_history[0].company", etc.
 */
export function updateCVField(id: string, fieldPath: string, value: unknown): boolean {
  const database = getDatabase();
  const now = new Date().toISOString();

  const cv = database.prepare('SELECT * FROM cvs WHERE id = ?').get(id) as CVRecord | undefined;
  if (!cv) return false;

  // Parse field path to determine which JSON column to update
  const [section, ...rest] = fieldPath.split('.');
  const columnMap: Record<string, string> = {
    contact: 'contact_json',
    work_history: 'work_history_json',
    education: 'education_json',
    skills: 'skills_json',
    certifications: 'certifications_json',
    languages: 'languages_json',
    other_sections: 'other_sections_json',
  };

  const column = columnMap[section];
  if (!column) {
    console.error(`Unknown section: ${section}`);
    return false;
  }

  try {
    // Parse existing JSON
    const currentData = JSON.parse(cv[column as keyof CVRecord] as string || '{}');

    // Apply update using nested path
    applyNestedUpdate(currentData, rest, value);

    // Save back to database
    const stmt = database.prepare(`UPDATE cvs SET ${column} = ?, updated_at = ? WHERE id = ?`);
    stmt.run(JSON.stringify(currentData), now, id);

    console.log(`Updated CV ${id} field ${fieldPath}`);
    return true;
  } catch (error) {
    console.error('Failed to update CV field:', error);
    return false;
  }
}

/**
 * Helper to apply updates to nested object paths including array indices.
 * Handles paths like: "email", "name", "[0].company", "[1].position"
 */
function applyNestedUpdate(obj: unknown, pathParts: string[], value: unknown): void {
  if (pathParts.length === 0) {
    // Direct section replacement (e.g., entire contact object)
    Object.assign(obj as object, value);
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = obj;
  for (let i = 0; i < pathParts.length - 1; i++) {
    const part = pathParts[i];
    const arrayMatch = part.match(/^\[(\d+)\]$/);

    if (arrayMatch) {
      const index = parseInt(arrayMatch[1], 10);
      current = current[index];
    } else {
      current = current[part];
    }
  }

  const lastPart = pathParts[pathParts.length - 1];
  const lastArrayMatch = lastPart.match(/^\[(\d+)\]$/);

  if (lastArrayMatch) {
    const index = parseInt(lastArrayMatch[1], 10);
    current[index] = value;
  } else {
    current[lastPart] = value;
  }
}

/**
 * Get full CV data by ID for editor.
 * Returns parsed CV object or null if not found.
 */
export function getCVFull(id: string): ParsedCV | null {
  const database = getDatabase();
  const cv = database.prepare('SELECT * FROM cvs WHERE id = ?').get(id) as CVRecord | undefined;

  if (!cv) return null;

  return {
    contact: JSON.parse(cv.contact_json || '{}'),
    work_history: JSON.parse(cv.work_history_json || '[]'),
    education: JSON.parse(cv.education_json || '[]'),
    skills: JSON.parse(cv.skills_json || '[]'),
    certifications: JSON.parse(cv.certifications_json || '[]'),
    languages: JSON.parse(cv.languages_json || '[]'),
    other_sections: JSON.parse(cv.other_sections_json || '{}'),
    raw_text: cv.raw_text || '',
    section_order: JSON.parse(cv.section_order_json || '[]'),
    parse_confidence: cv.parse_confidence,
    warnings: JSON.parse(cv.warnings_json || '[]'),
    extract_time_ms: cv.parse_time_ms || undefined,
  };
}

// ============================================================================
// JD (Job Description) Types and CRUD
// ============================================================================

export interface SkillRequirement {
  skill: string;
  importance: 'required' | 'preferred' | 'nice-to-have';
  category?: string;
}

export interface JDRecord {
  id: string;
  title: string;
  company: string | null;
  raw_text: string;
  required_skills_json: string | null;
  preferred_skills_json: string | null;
  experience_min: number | null;
  experience_max: number | null;
  education_level: string | null;
  certifications_json: string | null;
  created_at: string;
  updated_at: string;
}

export interface JDSummary {
  id: string;
  title: string;
  company: string | null;
  created_at: string;
  required_count: number;
  preferred_count: number;
}

export interface ParsedJD {
  title: string;
  company?: string;
  raw_text: string;
  required_skills: SkillRequirement[];
  preferred_skills: SkillRequirement[];
  experience_min?: number;
  experience_max?: number;
  education_level?: string;
  certifications: string[];
}

export interface FullJD extends ParsedJD {
  id: string;
  created_at: string;
  updated_at: string;
}

/**
 * Insert a new JD into the database.
 * Returns the generated ID.
 */
export function insertJD(jd: ParsedJD, projectId?: string): string {
  const database = getDatabase();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const stmt = database.prepare(`
    INSERT INTO job_descriptions (
      id, title, company, raw_text,
      required_skills_json, preferred_skills_json,
      experience_min, experience_max,
      education_level, certifications_json,
      created_at, updated_at, project_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    jd.title,
    jd.company || null,
    jd.raw_text,
    jd.required_skills ? JSON.stringify(jd.required_skills) : null,
    jd.preferred_skills ? JSON.stringify(jd.preferred_skills) : null,
    jd.experience_min ?? null,
    jd.experience_max ?? null,
    jd.education_level || null,
    jd.certifications ? JSON.stringify(jd.certifications) : null,
    now,
    now,
    projectId || null
  );

  console.log(`Inserted JD with ID: ${id}`);
  return id;
}

/**
 * Get a JD by its ID.
 * Returns null if not found.
 */
export function getJD(id: string): FullJD | null {
  const database = getDatabase();
  const row = database.prepare('SELECT * FROM job_descriptions WHERE id = ?').get(id) as JDRecord | undefined;

  if (!row) return null;

  return {
    id: row.id,
    title: row.title,
    company: row.company || undefined,
    raw_text: row.raw_text,
    required_skills: JSON.parse(row.required_skills_json || '[]'),
    preferred_skills: JSON.parse(row.preferred_skills_json || '[]'),
    experience_min: row.experience_min ?? undefined,
    experience_max: row.experience_max ?? undefined,
    education_level: row.education_level || undefined,
    certifications: JSON.parse(row.certifications_json || '[]'),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * Get all JDs with summary information.
 * Returns id, title, company, created_at, and skill counts.
 * Optionally filter by projectId.
 */
export function getAllJDs(projectId?: string): JDSummary[] {
  const database = getDatabase();

  let query = `
    SELECT id, title, company, raw_text, required_skills_json, preferred_skills_json, created_at
    FROM job_descriptions
  `;

  const params: unknown[] = [];
  if (projectId) {
    query += ' WHERE project_id = ?';
    params.push(projectId);
  }

  query += ' ORDER BY created_at DESC';

  const stmt = database.prepare(query);
  const rows = (params.length ? stmt.all(...params) : stmt.all()) as (JDRecord & { required_skills_json: string | null; preferred_skills_json: string | null })[];

  return rows.map(row => {
    const requiredSkills = JSON.parse(row.required_skills_json || '[]');
    const preferredSkills = JSON.parse(row.preferred_skills_json || '[]');

    return {
      id: row.id,
      title: row.title,
      company: row.company,
      created_at: row.created_at,
      required_count: requiredSkills.length,
      preferred_count: preferredSkills.length,
    };
  });
}

/**
 * Delete a JD by its ID.
 * Returns true if a record was deleted.
 */
export function deleteJD(id: string): boolean {
  const database = getDatabase();
  const stmt = database.prepare('DELETE FROM job_descriptions WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

// ============================================================================
// Match Result Types and CRUD
// ============================================================================

export interface MatchResultRecord {
  cv_id: string;
  jd_id: string;
  match_score: number;
  matched_skills_json: string | null;
  missing_required_json: string | null;
  missing_preferred_json: string | null;
  calculated_at: string;
}

export interface MatchResultInput {
  cv_id: string;
  jd_id: string;
  match_score: number;
  matched_skills: string[];
  missing_required: string[];
  missing_preferred: string[];
  calculated_at: string;
}

/**
 * Insert or update a match result.
 */
export function insertMatchResult(result: MatchResultInput): void {
  const database = getDatabase();

  const stmt = database.prepare(`
    INSERT OR REPLACE INTO cv_jd_matches (
      cv_id, jd_id, match_score,
      matched_skills_json, missing_required_json, missing_preferred_json,
      calculated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    result.cv_id,
    result.jd_id,
    result.match_score,
    JSON.stringify(result.matched_skills),
    JSON.stringify(result.missing_required),
    JSON.stringify(result.missing_preferred),
    result.calculated_at
  );
}

/**
 * Get all match results for a JD, sorted by score descending.
 */
export function getMatchResultsForJD(jdId: string): MatchResultRecord[] {
  const database = getDatabase();

  const stmt = database.prepare(`
    SELECT * FROM cv_jd_matches
    WHERE jd_id = ?
    ORDER BY match_score DESC
  `);

  return stmt.all(jdId) as MatchResultRecord[];
}

/**
 * Delete all match results for a JD.
 */
export function deleteMatchResultsForJD(jdId: string): void {
  const database = getDatabase();
  const stmt = database.prepare('DELETE FROM cv_jd_matches WHERE jd_id = ?');
  stmt.run(jdId);
}

/**
 * Get match result for a specific CV-JD pair.
 */
export function getMatchResult(cvId: string, jdId: string): MatchResultRecord | null {
  const database = getDatabase();
  const stmt = database.prepare(`
    SELECT * FROM cv_jd_matches
    WHERE cv_id = ? AND jd_id = ?
  `);
  return (stmt.get(cvId, jdId) as MatchResultRecord) || null;
}

// ============================================================================
// Project CRUD Functions
// ============================================================================

/**
 * Create a new project.
 * Returns the created project record.
 */
export function createProject(input: CreateProjectInput): ProjectRecord {
  const database = getDatabase();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const stmt = database.prepare(`
    INSERT INTO projects (id, name, client_name, description, is_archived, created_at, updated_at)
    VALUES (?, ?, ?, ?, 0, ?, ?)
  `);
  stmt.run(id, input.name, input.client_name || null, input.description || null, now, now);

  console.log(`Created project with ID: ${id}`);
  return {
    id,
    name: input.name,
    client_name: input.client_name || null,
    description: input.description || null,
    is_archived: 0,
    created_at: now,
    updated_at: now,
  };
}

/**
 * Get all projects with CV/JD counts.
 * Excludes archived projects by default.
 */
export function getAllProjects(includeArchived = false): ProjectSummary[] {
  const database = getDatabase();

  const whereClause = includeArchived ? '' : 'WHERE p.is_archived = 0';

  const stmt = database.prepare(`
    SELECT
      p.id, p.name, p.client_name, p.description, p.is_archived, p.created_at, p.updated_at,
      (SELECT COUNT(*) FROM cvs WHERE project_id = p.id) as cv_count,
      (SELECT COUNT(*) FROM job_descriptions WHERE project_id = p.id) as jd_count
    FROM projects p
    ${whereClause}
    ORDER BY p.updated_at DESC
  `);

  const rows = stmt.all() as (ProjectRecord & { cv_count: number; jd_count: number })[];

  return rows.map(row => ({
    ...row,
    is_archived: Boolean(row.is_archived),
  }));
}

/**
 * Get a single project by ID.
 */
export function getProject(id: string): ProjectSummary | null {
  const database = getDatabase();

  const row = database.prepare(`
    SELECT
      p.id, p.name, p.client_name, p.description, p.is_archived, p.created_at, p.updated_at,
      (SELECT COUNT(*) FROM cvs WHERE project_id = p.id) as cv_count,
      (SELECT COUNT(*) FROM job_descriptions WHERE project_id = p.id) as jd_count
    FROM projects p
    WHERE p.id = ?
  `).get(id) as (ProjectRecord & { cv_count: number; jd_count: number }) | undefined;

  if (!row) return null;

  return {
    ...row,
    is_archived: Boolean(row.is_archived),
  };
}

/**
 * Update a project.
 */
export function updateProject(id: string, updates: Partial<CreateProjectInput & { is_archived: boolean }>): boolean {
  const database = getDatabase();
  const now = new Date().toISOString();

  const fields: string[] = ['updated_at = ?'];
  const values: unknown[] = [now];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.client_name !== undefined) {
    fields.push('client_name = ?');
    values.push(updates.client_name);
  }
  if (updates.description !== undefined) {
    fields.push('description = ?');
    values.push(updates.description);
  }
  if (updates.is_archived !== undefined) {
    fields.push('is_archived = ?');
    values.push(updates.is_archived ? 1 : 0);
  }

  values.push(id);

  const stmt = database.prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`);
  const result = stmt.run(...values);

  return result.changes > 0;
}

/**
 * Delete a project and all its CVs, JDs, and match results.
 * Returns true if deleted.
 */
export function deleteProject(id: string): boolean {
  const database = getDatabase();

  // First delete all CVs (cascades to cv_jd_matches)
  database.prepare('DELETE FROM cvs WHERE project_id = ?').run(id);

  // Delete all JDs (cascades to cv_jd_matches)
  database.prepare('DELETE FROM job_descriptions WHERE project_id = ?').run(id);

  // Delete the project
  const result = database.prepare('DELETE FROM projects WHERE id = ?').run(id);

  return result.changes > 0;
}

/**
 * Get aggregate stats across all projects.
 */
export function getAggregateStats(): { total_cvs: number; total_jds: number } {
  const database = getDatabase();

  const cvCount = database.prepare('SELECT COUNT(*) as count FROM cvs').get() as { count: number };
  const jdCount = database.prepare('SELECT COUNT(*) as count FROM job_descriptions').get() as { count: number };

  return {
    total_cvs: cvCount.count,
    total_jds: jdCount.count,
  };
}
