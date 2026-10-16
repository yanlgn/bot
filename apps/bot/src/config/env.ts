import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Charge le .env depuis la racine du monorepo ou le dossier courant
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config();

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  DISCORD_BOT_TOKEN: z.string().min(1, 'DISCORD_BOT_TOKEN est requis'),
  DISCORD_CLIENT_ID: z.string().min(1, 'DISCORD_CLIENT_ID est requis'),
  DATABASE_PATH: z.string().default('./data/sciclub.sqlite'),
  CONFIG_PATH: z.string().default('./config/guilds'),
  BACKUP_PATH: z.string().default('./config/backups')
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Erreur de configuration des variables d\'environnement du bot :');
  console.error(parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
