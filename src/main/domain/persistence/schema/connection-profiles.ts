import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const connectionProfiles = sqliteTable('connection_profiles', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  kind: text('kind').notNull(),
  host: text('host').notNull(),
  port: integer('port').notNull(),
  environment: text('environment_label').notNull().default('local'),
  credentialPolicy: text('credential_policy').notNull().default('save'),
  redisAuthMode: text('redis_auth_mode').notNull().default('none'),
  redisAuthUsername: text('redis_auth_username'),
  redisAuthHasPassword: integer('redis_auth_has_password', { mode: 'boolean' })
    .notNull()
    .default(false),
  redisTlsEnabled: integer('redis_tls_enabled', { mode: 'boolean' }).notNull().default(false),
  redisTlsServername: text('redis_tls_servername'),
  redisTlsCaPath: text('redis_tls_ca_path'),
  memcachedAuthMode: text('memcached_auth_mode').notNull().default('none'),
  memcachedAuthUsername: text('memcached_auth_username'),
  memcachedAuthHasPassword: integer('memcached_auth_has_password', { mode: 'boolean' })
    .notNull()
    .default(false),
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
