import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
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

const exportArtifactRecordSchema = z
  .object({
    id: z.string().uuid(),
    filePath: z.string().min(1),
    createdAt: z.string().min(1),
    profileId: z.string().uuid().nullable(),
    key: z.string().min(1),
    redactionPolicy: z.string().min(1),
    redactionPolicyVersion: z.string().min(1),
    previewMode: z.literal('safeRedacted'),
  })
  .strict();

const ensureMetadataOnlyArtifact = (payload: unknown): ExportArtifactRecord => {
  const parsed = exportArtifactRecordSchema.safeParse(payload);
  if (parsed.success) {
    return {
      ...parsed.data,
      profileId: parsed.data.profileId ?? null,
    };
  }

  const unrecognizedKeys = parsed.error.issues
    .filter((issue) => issue.code === 'unrecognized_keys')
    .flatMap((issue) =>
      issue.code === 'unrecognized_keys'
        ? issue.keys
        : [],
    );

  if (
    unrecognizedKeys.some((key) => /value|payload|body|content|preview/i.test(key))
  ) {
    throw new Error(
      `EXPORT_VALUE_PERSISTENCE_BLOCKED: Export index accepts metadata only (key: ${unrecognizedKeys.join(', ')}).`,
    );
  }

  throw new Error('EXPORT_ARTIFACT_METADATA_INVALID');
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
  const artifact = ensureMetadataOnlyArtifact(payload);
  db
    .insert(exportArtifacts)
    .values({
      id: artifact.id,
      filePath: artifact.filePath,
      createdAt: artifact.createdAt,
      profileId: artifact.profileId,
      key: artifact.key,
      redactionPolicy: artifact.redactionPolicy,
      redactionPolicyVersion: artifact.redactionPolicyVersion,
      previewMode: artifact.previewMode,
    })
    .run();
  return getExportArtifactById(db, artifact.id);
};
