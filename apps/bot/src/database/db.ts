import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Assure que le répertoire parent de la base SQLite existe
const dbFullPath = path.resolve(process.cwd(), env.DATABASE_PATH);
const dbDir = path.dirname(dbFullPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new DatabaseSync(dbFullPath);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// Exécution du schéma initial
try {
  let schemaPath = path.resolve(__dirname, 'schema.sql');
  if (!fs.existsSync(schemaPath)) {
    schemaPath = path.resolve(__dirname, '../database/schema.sql');
  }
  if (!fs.existsSync(schemaPath)) {
    schemaPath = path.resolve(process.cwd(), 'apps/bot/src/database/schema.sql');
  }

    if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schemaSql);
    try { db.exec('ALTER TABLE projects ADD COLUMN department_id TEXT;'); } catch {}
    try { db.exec('ALTER TABLE resources ADD COLUMN department_id TEXT;'); } catch {}
    logger.info('📦 Schéma SQLite SciClub initialisé avec succès.');
  } else {
    logger.warn(`⚠️ Fichier schema.sql introuvable à ${schemaPath}.`);
  }
} catch (error) {
  logger.error({ error }, '❌ Erreur lors de l\'initialisation du schéma SQLite :');
  throw error;
}
