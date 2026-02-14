import { desc, eq } from 'drizzle-orm';
import type { SqliteDrizzleDatabase } from '../db/sqlite';
import { savedSearches } from '../schema';
import type { SavedSearch } from '../../../../shared/explorer/saved-searches.schemas';

const mapSavedSearchRow = (row: typeof savedSearches.$inferSelect): SavedSearch => ({
  id: row.id,
  name: row.name,
  query: row.query,
  connectionProfileId: row.connectionProfileId ?? null,
  prefix: row.prefix ?? null,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export const getSavedSearchById = (db: SqliteDrizzleDatabase, id: string) => {
  const rows = db
    .select()
    .from(savedSearches)
    .where(eq(savedSearches.id, id))
    .all();

  if (rows.length === 0) {
    return null;
  }

  return mapSavedSearchRow(rows[0]);
};

export const listSavedSearches = (db: SqliteDrizzleDatabase) => {
  const rows = db
    .select()
    .from(savedSearches)
    .orderBy(desc(savedSearches.updatedAt))
    .all();

  return rows.map(mapSavedSearchRow);
};

export const createSavedSearch = (db: SqliteDrizzleDatabase, payload: SavedSearch) => {
  db
    .insert(savedSearches)
    .values({
      id: payload.id,
      name: payload.name,
      query: payload.query,
      connectionProfileId: payload.connectionProfileId,
      prefix: payload.prefix,
      createdAt: payload.createdAt,
      updatedAt: payload.updatedAt,
    })
    .run();

  return getSavedSearchById(db, payload.id);
};

export const deleteSavedSearch = (db: SqliteDrizzleDatabase, id: string) => {
  const result = db.delete(savedSearches).where(eq(savedSearches.id, id)).run();
  return result.changes > 0 ? id : null;
};
