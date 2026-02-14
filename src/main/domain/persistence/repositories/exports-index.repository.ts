import { desc, eq } from 'drizzle-orm';
import type { SqliteDrizzleDatabase } from '../db/sqlite';
import { exportArtifacts } from '../schema';

export type ExportArtifactRecord = {
  id: string;
  filePath: string;
  createdAt: string;
  profileId: string | null;
  key: string;
  redactionPolicy: string;
  redactionPolicyVersion: string;
  previewMode: 'safeRedacted';
};

const mapExportArtifactRow = (
  row: typeof exportArtifacts.$inferSelect,
): ExportArtifactRecord => ({
  id: row.id,
  filePath: row.filePath,
  createdAt: row.createdAt,
  profileId: row.profileId ?? null,
  key: row.key,
  redactionPolicy: row.redactionPolicy,
  redactionPolicyVersion: row.redactionPolicyVersion,
  previewMode: row.previewMode as ExportArtifactRecord['previewMode'],
});

export const getExportArtifactById = (db: SqliteDrizzleDatabase, id: string) => {
  const rows = db
    .select()
    .from(exportArtifacts)
    .where(eq(exportArtifacts.id, id))
    .all();
  if (rows.length === 0) {
    return null;
  }
  return mapExportArtifactRow(rows[0]);
};

export const listExportArtifacts = (db: SqliteDrizzleDatabase) => {
  const rows = db
    .select()
    .from(exportArtifacts)
    .orderBy(desc(exportArtifacts.createdAt))
    .all();
  return rows.map(mapExportArtifactRow);
};

export const createExportArtifact = (
  db: SqliteDrizzleDatabase,
  payload: ExportArtifactRecord,
) => {
  db
    .insert(exportArtifacts)
    .values({
      id: payload.id,
      filePath: payload.filePath,
      createdAt: payload.createdAt,
      profileId: payload.profileId,
      key: payload.key,
      redactionPolicy: payload.redactionPolicy,
      redactionPolicyVersion: payload.redactionPolicyVersion,
      previewMode: payload.previewMode,
    })
    .run();
  return getExportArtifactById(db, payload.id);
};
