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
  patch: Partial<Omit<ConnectionProfileRecord, 'id' | 'tags' | 'createdAt'>>,
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
