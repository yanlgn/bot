import pg from 'pg';
const { Pool } = pg;

export const DEFAULT_NEON_DATABASE_URL =
  'postgresql://neondb_owner:npg_G5xW4efCHtDL@ep-polished-sunset-ba16mybc-pooler.c-8.eu-central-1.aws.neon.tech/neondb?sslmode=require';

export function getDatabaseUrl(): string {
  return process.env.DATABASE_URL || DEFAULT_NEON_DATABASE_URL;
}

export function toPgSql(sql: string): string {
  let paramIdx = 1;
  let converted = sql
    .replace(/\?/g, () => `$${paramIdx++}`)
    .replace(/datetime\('now',\s*'\+(\d+)\s*days?'\)/gi, "NOW() + INTERVAL '$1 days'")
    .replace(/datetime\('now'\)/gi, 'NOW()')
    .replace(/datetime\((\w+)\)/gi, '$1')
    .replace(/\bis_archived\s*=\s*0\b/gi, 'is_archived = false')
    .replace(/\bis_archived\s*=\s*1\b/gi, 'is_archived = true')
    .replace(/\battended\s*=\s*0\b/gi, 'attended = false')
    .replace(/\battended\s*=\s*1\b/gi, 'attended = true');

  if (/INSERT\s+OR\s+IGNORE\s+INTO/i.test(converted)) {
    converted = converted.replace(/INSERT\s+OR\s+IGNORE\s+INTO/i, 'INSERT INTO');
    if (!/ON\s+CONFLICT/i.test(converted)) {
      converted = converted + ' ON CONFLICT DO NOTHING';
    }
  }
  return converted;
}

export function createNeonPool(url?: string): pg.Pool {
  const connectionString = url || getDatabaseUrl();
  return new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
}

export interface IDatabaseClient {
  pool: pg.Pool;
  prepare(sql: string): {
    all<T = any>(...params: any[]): Promise<T[]>;
    get<T = any>(...params: any[]): Promise<T | undefined>;
    run(...params: any[]): Promise<{ changes: number }>;
  };
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  queryOne<T = any>(sql: string, params?: any[]): Promise<T | undefined>;
  execute(sql: string, params?: any[]): Promise<{ changes: number }>;
  exec(sql: string): Promise<void>;
}

export function createDatabaseAdapter(poolInstance: pg.Pool): IDatabaseClient {
  return {
    pool: poolInstance,
    prepare(sql: string) {
      const pgSql = toPgSql(sql);
      return {
        async all<T = any>(...params: any[]): Promise<T[]> {
          const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
          const res = await poolInstance.query(pgSql, flatParams);
          return res.rows as T[];
        },
        async get<T = any>(...params: any[]): Promise<T | undefined> {
          const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
          const res = await poolInstance.query(pgSql, flatParams);
          return res.rows[0] as T | undefined;
        },
        async run(...params: any[]): Promise<{ changes: number }> {
          const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
          const res = await poolInstance.query(pgSql, flatParams);
          return { changes: res.rowCount ?? 0 };
        }
      };
    },
    async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
      const pgSql = toPgSql(sql);
      const res = await poolInstance.query(pgSql, params);
      return res.rows as T[];
    },
    async queryOne<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
      const pgSql = toPgSql(sql);
      const res = await poolInstance.query(pgSql, params);
      return res.rows[0] as T | undefined;
    },
    async execute(sql: string, params: any[] = []): Promise<{ changes: number }> {
      const pgSql = toPgSql(sql);
      const res = await poolInstance.query(pgSql, params);
      return { changes: res.rowCount ?? 0 };
    },
    async exec(sql: string): Promise<void> {
      await poolInstance.query(sql);
    }
  };
}
