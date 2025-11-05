import { desc, eq } from 'drizzle-orm';
import type { SqliteDrizzleDatabase } from '../db/sqlite';
import { connectionProfileTags, connectionProfiles } from '../schema';
import type {
  ConnectionProfile,
  ConnectionProfileSearch,
} from '../../../../shared/profiles/profile.schemas';

export type ConnectionProfileRecord = ConnectionProfile;

const mapProfileRow = (row: typeof connectionProfiles.$inferSelect): ConnectionProfileRecord => ({
  id: row.id,
  name: row.name,
  kind: row.kind as ConnectionProfile['kind'],
  host: row.host,
  port: row.port,
  environment: row.environment as ConnectionProfile['environment'],
  credentialPolicy: row.credentialPolicy as ConnectionProfile['credentialPolicy'],
  redisAuth: {
    mode: row.redisAuthMode as ConnectionProfile['redisAuth']['mode'],
    ...(row.redisAuthUsername ? { username: row.redisAuthUsername } : {}),
    hasPassword: row.redisAuthHasPassword,
  },
  redisTls: {
    enabled: row.redisTlsEnabled,
    ...(row.redisTlsServername ? { servername: row.redisTlsServername } : {}),
    ...(row.redisTlsCaPath ? { caPath: row.redisTlsCaPath } : {}),
  },
  memcachedAuth: {
    mode: row.memcachedAuthMode as ConnectionProfile['memcachedAuth']['mode'],
    ...(row.memcachedAuthUsername ? { username: row.memcachedAuthUsername } : {}),
    hasPassword: row.memcachedAuthHasPassword,
  },
  favorite: row.favorite,
  tags: [],
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const attachTags = (
  profiles: ConnectionProfileRecord[],
  tagRows: Array<typeof connectionProfileTags.$inferSelect>,
) => {
  const map = new Map<string, string[]>();
  tagRows.forEach((row) => {
    const tags = map.get(row.profileId) ?? [];
    tags.push(row.tag);
    map.set(row.profileId, tags);
  });

  profiles.forEach((profile) => {
    profile.tags = map.get(profile.id) ?? [];
  });
};

export const getProfileById = (db: SqliteDrizzleDatabase, id: string) => {
  const profiles = db
    .select()
    .from(connectionProfiles)
    .where(eq(connectionProfiles.id, id))
    .all();
  if (profiles.length === 0) {
    return null;
  }

  const tags = db
    .select()
    .from(connectionProfileTags)
    .where(eq(connectionProfileTags.profileId, id))
    .all();

  const profile = mapProfileRow(profiles[0]);
  attachTags([profile], tags);
  return profile;
};

export const listProfiles = (db: SqliteDrizzleDatabase) => {
  const profiles = db
    .select()
    .from(connectionProfiles)
    .orderBy(desc(connectionProfiles.updatedAt))
    .all();
  const tagRows = db.select().from(connectionProfileTags).all();
  const mapped = profiles.map(mapProfileRow);
  attachTags(mapped, tagRows);
  return mapped;
};

export const createProfile = (
  db: SqliteDrizzleDatabase,
  payload: ConnectionProfileRecord,
) => {
  return db.transaction((tx) => {
    tx.insert(connectionProfiles).values({
      id: payload.id,
      name: payload.name,
      kind: payload.kind,
      host: payload.host,
      port: payload.port,
      environment: payload.environment,
      credentialPolicy: payload.credentialPolicy,
      redisAuthMode: payload.redisAuth.mode,
      redisAuthUsername: payload.redisAuth.username ?? null,
      redisAuthHasPassword: payload.redisAuth.hasPassword ?? false,
      redisTlsEnabled: payload.redisTls.enabled,
      redisTlsServername: payload.redisTls.servername ?? null,
      redisTlsCaPath: payload.redisTls.caPath ?? null,
      memcachedAuthMode: payload.memcachedAuth.mode,
      memcachedAuthUsername: payload.memcachedAuth.username ?? null,
      memcachedAuthHasPassword: payload.memcachedAuth.hasPassword ?? false,
      favorite: payload.favorite,
      createdAt: payload.createdAt,
      updatedAt: payload.updatedAt,
    }).run();

    if (payload.tags.length > 0) {
      tx.insert(connectionProfileTags).values(
        payload.tags.map((tag) => ({
          profileId: payload.id,
          tag,
        })),
      ).run();
    }

    return getProfileById(tx, payload.id);
  });
};

export const updateProfile = (
  db: SqliteDrizzleDatabase,
  id: string,
  patch: Partial<Omit<ConnectionProfileRecord, 'id' | 'tags' | 'createdAt' | 'redisAuth' | 'memcachedAuth'>>,
) => {
  db
    .update(connectionProfiles)
    .set({
      ...patch,
    })
    .where(eq(connectionProfiles.id, id))
    .run();
  return getProfileById(db, id);
};

export const updateProfileAuthSettings = (
  db: SqliteDrizzleDatabase,
  id: string,
  authPatch: {
    credentialPolicy?: ConnectionProfile['credentialPolicy'];
    redisAuth?: ConnectionProfile['redisAuth'];
    redisTls?: ConnectionProfile['redisTls'];
    memcachedAuth?: ConnectionProfile['memcachedAuth'];
    updatedAt: string;
  },
) => {
  const setPayload: Partial<typeof connectionProfiles.$inferInsert> = {
    updatedAt: authPatch.updatedAt,
  };

  if (authPatch.credentialPolicy !== undefined) {
    setPayload.credentialPolicy = authPatch.credentialPolicy;
  }
  if (authPatch.redisAuth !== undefined) {
    setPayload.redisAuthMode = authPatch.redisAuth.mode;
    setPayload.redisAuthUsername = authPatch.redisAuth.username ?? null;
    setPayload.redisAuthHasPassword = authPatch.redisAuth.hasPassword ?? false;
  }
  if (authPatch.redisTls !== undefined) {
    setPayload.redisTlsEnabled = authPatch.redisTls.enabled;
    setPayload.redisTlsServername = authPatch.redisTls.servername ?? null;
    setPayload.redisTlsCaPath = authPatch.redisTls.caPath ?? null;
  }
  if (authPatch.memcachedAuth !== undefined) {
    setPayload.memcachedAuthMode = authPatch.memcachedAuth.mode;
    setPayload.memcachedAuthUsername = authPatch.memcachedAuth.username ?? null;
    setPayload.memcachedAuthHasPassword = authPatch.memcachedAuth.hasPassword ?? false;
  }

  db
    .update(connectionProfiles)
    .set(setPayload)
    .where(eq(connectionProfiles.id, id))
    .run();
  return getProfileById(db, id);
};

export const deleteProfile = (db: SqliteDrizzleDatabase, id: string) => {
  const result = db.delete(connectionProfiles).where(eq(connectionProfiles.id, id)).run();
  return result.changes > 0 ? id : null;
};

export const setProfileTags = (
  db: SqliteDrizzleDatabase,
  id: string,
  tags: string[],
) => {
  return db.transaction((tx) => {
    const now = new Date().toISOString();
    const updateResult = tx
      .update(connectionProfiles)
      .set({ updatedAt: now })
      .where(eq(connectionProfiles.id, id))
      .run();
    if (updateResult.changes === 0) {
      return null;
    }
    tx.delete(connectionProfileTags).where(eq(connectionProfileTags.profileId, id)).run();
    if (tags.length > 0) {
      tx
        .insert(connectionProfileTags)
        .values(tags.map((tag) => ({ profileId: id, tag })))
        .run();
    }
    return getProfileById(tx, id);
  });
};

export const setProfileFavorite = (
  db: SqliteDrizzleDatabase,
  id: string,
  favorite: boolean,
) => {
  const now = new Date().toISOString();
  const result = db
    .update(connectionProfiles)
    .set({ favorite, updatedAt: now })
    .where(eq(connectionProfiles.id, id))
    .run();
  if (result.changes === 0) {
    return null;
  }
  return getProfileById(db, id);
};

const normalizeSearchText = (value: string) => value.trim().toLowerCase();

export const searchProfiles = (
  db: SqliteDrizzleDatabase,
  search: ConnectionProfileSearch,
) => {
  const profiles = listProfiles(db);
  const query = search.query ? normalizeSearchText(search.query) : '';
  const tags = (search.tags ?? []).map(normalizeSearchText).filter(Boolean);

  return profiles.filter((profile) => {
    if (search.favoritesOnly && !profile.favorite) {
      return false;
    }

    if (query) {
      const searchable = [
        profile.name,
        profile.host,
        profile.kind,
        ...profile.tags,
      ]
        .map(normalizeSearchText)
        .join(' ');
      if (!searchable.includes(query)) {
        return false;
      }
    }

    if (tags.length > 0) {
      const profileTags = profile.tags.map(normalizeSearchText);
      const hasAllTags = tags.every((tag) => profileTags.includes(tag));
      if (!hasAllTags) {
        return false;
      }
    }

    return true;
  });
};
