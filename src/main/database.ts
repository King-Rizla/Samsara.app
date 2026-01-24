import Database from 'better-sqlite3';
import { app } from 'electron';
import * as path from 'path';

let db: Database.Database | null = null;

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
