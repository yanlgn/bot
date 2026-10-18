import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';

const dbPath = process.env.DATABASE_PATH || './data/sciclub.sqlite';
const resolvedPath = path.resolve(process.cwd(), dbPath);
const dir = path.dirname(resolvedPath);

if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

export const db = new DatabaseSync(resolvedPath);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

try {
  let schemaPath = path.resolve(process.cwd(), 'apps/bot/src/database/schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schemaSql);
  }
} catch (e) {
  // Ignorer si déjà initialisé
}

// Migrations idempotentes de colonnes
try { db.exec('ALTER TABLE projects ADD COLUMN department_id TEXT;'); } catch {}
try { db.exec('ALTER TABLE resources ADD COLUMN department_id TEXT;'); } catch {}

// Table des sessions persistantes pour garantir l'authentification
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      discriminator TEXT DEFAULT '0',
      avatar TEXT,
      access_token TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
  `);
} catch {}


