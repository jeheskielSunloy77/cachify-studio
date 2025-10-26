import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { applyMigrations } from './migrations';
import { createSqliteDatabase } from './sqlite';

export const createTestDatabase = () => {
  const dbPath = join(tmpdir(), `cachify-test-${randomUUID()}.sqlite`);
  const { sqlite, db } = createSqliteDatabase(dbPath);
  applyMigrations(sqlite);
  return { sqlite, db, dbPath };
};
