import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ Erreur: la variable d\'environnement DATABASE_URL est requise.');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

const schema = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    discriminator TEXT DEFAULT '0',
    avatar TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    discriminator TEXT DEFAULT '0',
    avatar TEXT,
    access_token TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

  CREATE TABLE IF NOT EXISTS guilds (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT,
    owner_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS guild_configs (
    guild_id TEXT PRIMARY KEY,
    config_json TEXT NOT NULL,
    version INTEGER DEFAULT 1,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS members (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    nickname TEXT,
    joined_at TIMESTAMPTZ,
    PRIMARY KEY (guild_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS roles_cache (
    id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL,
    name TEXT NOT NULL,
    color BIGINT DEFAULT 0,
    position INTEGER DEFAULT 0,
    permissions TEXT DEFAULT '0'
  );

  CREATE TABLE IF NOT EXISTS channels_cache (
    id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    parent_id TEXT,
    position INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS departments (
    id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL,
    name TEXT NOT NULL,
    short_name TEXT,
    icon TEXT DEFAULT '🔬',
    color TEXT DEFAULT '#E5092E',
    description TEXT DEFAULT '',
    leader_role_id TEXT,
    deputy_role_id TEXT,
    member_role_id TEXT,
    category_id TEXT,
    is_archived BOOLEAN DEFAULT FALSE,
    is_recruiting BOOLEAN DEFAULT TRUE,
    max_members INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );

  ALTER TABLE departments ADD COLUMN IF NOT EXISTS is_recruiting BOOLEAN DEFAULT TRUE;
  ALTER TABLE departments ADD COLUMN IF NOT EXISTS max_members INTEGER DEFAULT 0;

  CREATE TABLE IF NOT EXISTS department_panels (
    id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    title TEXT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS suggestion_configs (
    guild_id TEXT PRIMARY KEY,
    submission_channel_id TEXT,
    review_channel_id TEXT,
    panel_message_id TEXT,
    title TEXT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS suggestions (
    id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    benefits TEXT,
    status TEXT CHECK(status IN ('pending', 'approved', 'rejected', 'in_discussion')) DEFAULT 'pending',
    discord_message_id TEXT,
    review_notes TEXT,
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS department_members (
    department_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    role TEXT CHECK(role IN ('leader', 'deputy', 'member')) DEFAULT 'member',
    status TEXT CHECK(status IN ('pending', 'approved', 'rejected')) DEFAULT 'approved',
    motivation TEXT,
    skills TEXT,
    availability TEXT,
    requested_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    PRIMARY KEY (department_id, user_id),
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
  );

  ALTER TABLE department_members ADD COLUMN IF NOT EXISTS first_name TEXT;
  ALTER TABLE department_members ADD COLUMN IF NOT EXISTS last_name TEXT;
  ALTER TABLE department_members ADD COLUMN IF NOT EXISTS email TEXT;

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL,
    department_id TEXT,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    leader_id TEXT NOT NULL,
    channel_id TEXT,
    status TEXT CHECK(status IN ('idea', 'in_progress', 'paused', 'completed', 'archived')) DEFAULT 'idea',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS project_members (
    project_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT DEFAULT 'contributor',
    joined_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (project_id, user_id),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    type TEXT CHECK(type IN ('conference', 'workshop', 'competition', 'field_trip', 'hackathon', 'training')) NOT NULL,
    scheduled_start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    location TEXT NOT NULL,
    speaker TEXT,
    max_participants INTEGER,
    target_audience TEXT,
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_pattern TEXT,
    allow_cancellation BOOLEAN DEFAULT TRUE,
    status TEXT CHECK(status IN ('draft', 'published', 'cancelled', 'completed')) DEFAULT 'published',
    channel_id TEXT,
    discord_message_id TEXT,
    participant_role_id TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );

  ALTER TABLE events ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ;
  ALTER TABLE events ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE;
  ALTER TABLE events ADD COLUMN IF NOT EXISTS recurrence_pattern TEXT;
  ALTER TABLE events ADD COLUMN IF NOT EXISTS allow_cancellation BOOLEAN DEFAULT TRUE;
  ALTER TABLE events ADD COLUMN IF NOT EXISTS discord_message_id TEXT;

  CREATE TABLE IF NOT EXISTS event_sessions (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    guild_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    scheduled_start_time TIMESTAMPTZ,
    scheduled_end_time TIMESTAMPTZ,
    max_participants INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_event ON event_sessions(event_id);

  CREATE TABLE IF NOT EXISTS event_participants (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    session_id TEXT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    notes TEXT,
    status TEXT CHECK(status IN ('registered', 'cancelled')) DEFAULT 'registered',
    registered_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    attended BOOLEAN DEFAULT FALSE,
    UNIQUE(event_id, user_id)
  );

  ALTER TABLE event_participants ADD COLUMN IF NOT EXISTS id TEXT;
  ALTER TABLE event_participants ADD COLUMN IF NOT EXISTS session_id TEXT;
  ALTER TABLE event_participants ADD COLUMN IF NOT EXISTS guild_id TEXT;
  ALTER TABLE event_participants ADD COLUMN IF NOT EXISTS first_name TEXT;
  ALTER TABLE event_participants ADD COLUMN IF NOT EXISTS last_name TEXT;
  ALTER TABLE event_participants ADD COLUMN IF NOT EXISTS email TEXT;
  ALTER TABLE event_participants ADD COLUMN IF NOT EXISTS notes TEXT;
  ALTER TABLE event_participants ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'registered';

  CREATE TABLE IF NOT EXISTS resources (
    id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL,
    department_id TEXT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    url TEXT NOT NULL,
    category TEXT CHECK(category IN ('ia', 'robotique', 'programmation', 'physique', 'chimie', 'biologie', 'mathematiques', 'astronomie')) NOT NULL,
    tags TEXT DEFAULT '[]',
    author_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS candidatures (
    id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    study_field TEXT NOT NULL,
    motivation TEXT NOT NULL,
    interests TEXT DEFAULT '[]',
    availability TEXT,
    status TEXT CHECK(status IN ('pending', 'accepted', 'rejected')) DEFAULT 'pending',
    discord_message_id TEXT,
    review_notes TEXT,
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );

  ALTER TABLE candidatures ADD COLUMN IF NOT EXISTS first_name TEXT;
  ALTER TABLE candidatures ADD COLUMN IF NOT EXISTS last_name TEXT;
  ALTER TABLE candidatures ADD COLUMN IF NOT EXISTS email TEXT;
  ALTER TABLE candidatures ADD COLUMN IF NOT EXISTS availability TEXT;
  ALTER TABLE candidatures ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
  ALTER TABLE candidatures ADD COLUMN IF NOT EXISTS discord_message_id TEXT;
  ALTER TABLE candidatures ADD COLUMN IF NOT EXISTS review_notes TEXT;

  CREATE TABLE IF NOT EXISTS candidature_configs (
    guild_id TEXT PRIMARY KEY,
    submission_channel_id TEXT,
    review_channel_id TEXT,
    panel_message_id TEXT,
    member_role_id TEXT,
    title TEXT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS candidature_panels (
    id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    title TEXT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS warnings (
    id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    moderator_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sanctions (
    id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    moderator_id TEXT NOT NULL,
    type TEXT CHECK(type IN ('warn', 'mute', 'kick', 'ban')) NOT NULL,
    reason TEXT NOT NULL,
    duration_minutes INTEGER,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS points (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    balance INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (guild_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT,
    details TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS backups (
    id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    filepath TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  );
`;

async function main() {
  console.log('Connecting to Neon PostgreSQL...');
  await pool.query(schema);
  console.log('Schema initialized successfully!');

  const tables = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);

  console.log('\nVerified tables in Neon:');
  tables.rows.forEach(r => console.log('  ✓ ' + r.table_name));

  await pool.end();
}

main().catch(err => {
  console.error('Fatal initialization error:', err);
  process.exit(1);
});
