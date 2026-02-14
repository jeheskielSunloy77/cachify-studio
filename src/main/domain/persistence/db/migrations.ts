import SqliteDatabase from 'better-sqlite3';

type Migration = {
  id: string;
  sql: string;
};

const migrations: Migration[] = [
  {
    id: '0001_create_connection_profiles',
    sql: `
      CREATE TABLE IF NOT EXISTS connection_profiles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        kind TEXT NOT NULL,
        host TEXT NOT NULL,
        port INTEGER NOT NULL,
        favorite INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS connection_profile_tags (
        profile_id TEXT NOT NULL,
        tag TEXT NOT NULL,
        PRIMARY KEY (profile_id, tag),
        FOREIGN KEY (profile_id) REFERENCES connection_profiles(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_connection_profiles_updated_at
        ON connection_profiles(updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_connection_profile_tags_tag
        ON connection_profile_tags(tag);
    `,
  },
  {
    id: '0002_add_profile_auth_metadata',
    sql: `
      ALTER TABLE connection_profiles ADD COLUMN credential_policy TEXT NOT NULL DEFAULT 'save';
      ALTER TABLE connection_profiles ADD COLUMN redis_auth_mode TEXT NOT NULL DEFAULT 'none';
      ALTER TABLE connection_profiles ADD COLUMN redis_auth_username TEXT;
      ALTER TABLE connection_profiles ADD COLUMN redis_auth_has_password INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE connection_profiles ADD COLUMN memcached_auth_mode TEXT NOT NULL DEFAULT 'none';
      ALTER TABLE connection_profiles ADD COLUMN memcached_auth_username TEXT;
      ALTER TABLE connection_profiles ADD COLUMN memcached_auth_has_password INTEGER NOT NULL DEFAULT 0;
    `,
  },
  {
    id: '0003_add_redis_tls_metadata',
    sql: `
      ALTER TABLE connection_profiles ADD COLUMN redis_tls_enabled INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE connection_profiles ADD COLUMN redis_tls_servername TEXT;
      ALTER TABLE connection_profiles ADD COLUMN redis_tls_ca_path TEXT;
    `,
  },
  {
    id: '0004_add_environment_label',
    sql: `
      ALTER TABLE connection_profiles ADD COLUMN environment_label TEXT NOT NULL DEFAULT 'local';
    `,
  },
  {
    id: '0005_create_saved_searches',
    sql: `
      CREATE TABLE IF NOT EXISTS saved_searches (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        query TEXT NOT NULL,
        connection_profile_id TEXT,
        prefix TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (connection_profile_id) REFERENCES connection_profiles(id) ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS idx_saved_searches_updated_at
        ON saved_searches(updated_at DESC);
    `,
  },
  {
    id: '0006_create_export_artifacts_index',
    sql: `
      CREATE TABLE IF NOT EXISTS export_artifacts (
        id TEXT PRIMARY KEY,
        file_path TEXT NOT NULL,
        created_at TEXT NOT NULL,
        profile_id TEXT,
        redis_key TEXT NOT NULL,
        redaction_policy TEXT NOT NULL,
        redaction_policy_version TEXT NOT NULL,
        preview_mode TEXT NOT NULL,
        FOREIGN KEY (profile_id) REFERENCES connection_profiles(id) ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS idx_export_artifacts_created_at
        ON export_artifacts(created_at DESC);
    `,
  },
];

type SqliteDatabaseInstance = InstanceType<typeof SqliteDatabase>;

export const applyMigrations = (db: SqliteDatabaseInstance) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedRows = db
    .prepare('SELECT id FROM schema_migrations')
    .all() as Array<{ id: string }>;
  const applied = new Set(appliedRows.map((row) => row.id));

  const insertMigration = db.prepare(
    'INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)',
  );

  const apply = db.transaction((migration: Migration) => {
    db.exec(migration.sql);
    insertMigration.run(migration.id, new Date().toISOString());
  });

  migrations.forEach((migration) => {
    if (!applied.has(migration.id)) {
      apply(migration);
    }
  });
};
