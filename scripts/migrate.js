import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const dbPath = process.env.DATABASE_PATH || './data/sciclub.sqlite';
const resolvedDbPath = path.resolve(process.cwd(), dbPath);
const dir = path.dirname(resolvedDbPath);

if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

console.log(`📦 Connexion à la base SQLite : ${resolvedDbPath}`);
const db = new DatabaseSync(resolvedDbPath);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

const schemaPath = path.resolve(process.cwd(), 'apps/bot/src/database/schema.sql');
if (fs.existsSync(schemaPath)) {
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schemaSql);
  console.log('✅ Schéma de base de données SciClub migré avec succès !');
} else {
  console.error(`❌ Schéma SQL introuvable à : ${schemaPath}`);
  process.exit(1);
}
