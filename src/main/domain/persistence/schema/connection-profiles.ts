import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const connectionProfiles = sqliteTable('connection_profiles', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  kind: text('kind').notNull(),
  host: text('host').notNull(),
  port: integer('port').notNull(),
  favorite: integer('favorite', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const connectionProfileTags = sqliteTable(
  'connection_profile_tags',
  {
    profileId: text('profile_id')
      .notNull()
      .references(() => connectionProfiles.id, { onDelete: 'cascade' }),
    tag: text('tag').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.profileId, table.tag] }),
  }),
);
