import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { connectionProfiles } from './connection-profiles';

export const savedSearches = sqliteTable(
  'saved_searches',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    query: text('query').notNull(),
    connectionProfileId: text('connection_profile_id').references(() => connectionProfiles.id, {
      onDelete: 'set null',
    }),
    prefix: text('prefix'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => ({
    updatedAtIdx: index('idx_saved_searches_updated_at').on(table.updatedAt),
  }),
);
