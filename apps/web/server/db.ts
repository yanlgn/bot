import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createDatabaseAdapter, createNeonPool } from '@sciclub/shared/database';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config();

export const pool = createNeonPool();
export const db = createDatabaseAdapter(pool);
