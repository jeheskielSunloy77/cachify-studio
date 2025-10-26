import SqliteDatabase from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../schema';

export const createSqliteDatabase = (dbPath: string) => {
  const sqlite = new SqliteDatabase(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  return { sqlite, db };
};

export type SqliteDrizzleDatabase = BetterSQLite3Database<typeof schema>;
