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

export function initDatabase(): Database.Database {
  if (db) return db;

  try {
    const dbPath = path.join(app.getPath('userData'), 'samsara.db');
    console.log('Initializing database at:', dbPath);
    db = new Database(dbPath);

    // Enable WAL mode for better concurrent access
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');

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
export function insertCV(cv: ParsedCV, filePath: string): string {
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
      warnings_json, parse_time_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    cv.extract_time_ms || null
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
 */
export function getAllCVs(): CVSummary[] {
  const database = getDatabase();
  const stmt = database.prepare(`
    SELECT id, file_name, contact_json, parse_confidence, created_at
    FROM cvs
    ORDER BY created_at DESC
  `);
  return stmt.all() as CVSummary[];
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
