import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { connectionProfiles } from './connection-profiles';

export const exportArtifacts = sqliteTable(
  'export_artifacts',
  {
    id: text('id').primaryKey(),
    filePath: text('file_path').notNull(),
    createdAt: text('created_at').notNull(),
    profileId: text('profile_id').references(() => connectionProfiles.id, {
      onDelete: 'set null',
    }),
    key: text('redis_key').notNull(),
    redactionPolicy: text('redaction_policy').notNull(),
    redactionPolicyVersion: text('redaction_policy_version').notNull(),
    previewMode: text('preview_mode').notNull(),
  },
  (table) => ({
    createdAtIdx: index('idx_export_artifacts_created_at').on(table.createdAt),
  }),
);
