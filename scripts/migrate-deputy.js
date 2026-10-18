import { createNeonPool } from '@sciclub/shared/database';

async function migrate() {
  const pool = createNeonPool();
  try {
    console.log('Adding deputy_role_id to departments...');
    await pool.query('ALTER TABLE departments ADD COLUMN IF NOT EXISTS deputy_role_id TEXT');
    console.log('Updating department_members check constraint...');
    await pool.query('ALTER TABLE department_members DROP CONSTRAINT IF EXISTS department_members_role_check');
    await pool.query("ALTER TABLE department_members ADD CONSTRAINT department_members_role_check CHECK(role IN ('leader', 'deputy', 'member'))");
    console.log('Migration completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
