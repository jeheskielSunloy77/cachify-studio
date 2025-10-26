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
