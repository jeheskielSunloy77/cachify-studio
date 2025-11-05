// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { profileCreateSchema } from '../../shared/profiles/profile.schemas';
import { createTestDatabase } from '../domain/persistence/db/test-utils';
import {
  createProfile,
  deleteProfile,
  getProfileById,
  listProfiles,
  searchProfiles,
  setProfileFavorite,
  setProfileTags,
} from '../domain/persistence/repositories/connection-profiles.repository';

describe('connection profiles repository', () => {
  it('creates profiles and lists them with tags', async () => {
    const { db, sqlite } = createTestDatabase();
    const now = new Date().toISOString();

    await createProfile(db, {
      id: 'profile-1',
      name: 'Prod Redis',
      kind: 'redis',
      host: 'prod.cache.local',
      port: 6379,
      environment: 'local',
      credentialPolicy: 'save',
      redisAuth: { mode: 'none', hasPassword: false },
      redisTls: { enabled: false },
      memcachedAuth: { mode: 'none', hasPassword: false },
      favorite: false,
      tags: ['prod', 'payments'],
      createdAt: now,
      updatedAt: now,
    });

    const profiles = await listProfiles(db);
    expect(profiles).toHaveLength(1);
    expect(profiles[0]?.tags).toEqual(['prod', 'payments']);

    sqlite.close();
  });

  it('filters profiles by search, tags, and favorites', async () => {
    const { db, sqlite } = createTestDatabase();
    const now = new Date().toISOString();

    await createProfile(db, {
      id: 'profile-1',
      name: 'Prod Redis',
      kind: 'redis',
      host: 'prod.cache.local',
      port: 6379,
      environment: 'local',
      credentialPolicy: 'save',
      redisAuth: { mode: 'none', hasPassword: false },
      redisTls: { enabled: false },
      memcachedAuth: { mode: 'none', hasPassword: false },
      favorite: false,
      tags: ['prod', 'payments'],
      createdAt: now,
      updatedAt: now,
    });
    await createProfile(db, {
      id: 'profile-2',
      name: 'QA Redis',
      kind: 'redis',
      host: 'qa.cache.local',
      port: 6380,
      environment: 'local',
      credentialPolicy: 'save',
      redisAuth: { mode: 'none', hasPassword: false },
      redisTls: { enabled: false },
      memcachedAuth: { mode: 'none', hasPassword: false },
      favorite: false,
      tags: ['qa'],
      createdAt: now,
      updatedAt: now,
    });

    const initial = await getProfileById(db, 'profile-1');
    await new Promise((resolve) => setTimeout(resolve, 2));
    const favoriteUpdated = await setProfileFavorite(db, 'profile-1', true);
    await setProfileTags(db, 'profile-2', ['qa', 'smoke']);

    const favoriteOnly = await searchProfiles(db, {
      favoritesOnly: true,
    });
    expect(favoriteOnly).toHaveLength(1);
    expect(favoriteOnly[0]?.name).toBe('Prod Redis');

    const tagFilter = await searchProfiles(db, { tags: ['smoke'] });
    expect(tagFilter).toHaveLength(1);
    expect(tagFilter[0]?.name).toBe('QA Redis');

    const queryFilter = await searchProfiles(db, { query: 'prod' });
    expect(queryFilter).toHaveLength(1);
    expect(queryFilter[0]?.name).toBe('Prod Redis');
    expect(favoriteUpdated?.updatedAt).not.toBe(initial?.updatedAt);

    sqlite.close();
  });

  it('returns null when deleting a missing profile', async () => {
    const { db, sqlite } = createTestDatabase();

    const deleted = await deleteProfile(db, 'missing-id');
    expect(deleted).toBeNull();

    sqlite.close();
  });

  it('rejects invalid profile port via schema validation', () => {
    const parsed = profileCreateSchema.safeParse({
      name: 'Invalid',
      kind: 'redis',
      host: 'localhost',
      port: 70000,
      tags: [],
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects empty host via schema validation', () => {
    const parsed = profileCreateSchema.safeParse({
      name: 'Invalid',
      kind: 'redis',
      host: '',
      port: 6379,
      tags: [],
    });
    expect(parsed.success).toBe(false);
  });

  it('does not persist secret password fields in SQLite rows', async () => {
    const { db, sqlite } = createTestDatabase();
    const now = new Date().toISOString();

    await createProfile(db, {
      id: 'profile-secret',
      name: 'Secret Redis',
      kind: 'redis',
      host: 'secret.cache.local',
      port: 6379,
      environment: 'local',
      credentialPolicy: 'save',
      redisAuth: { mode: 'password', username: 'default', hasPassword: true },
      redisTls: { enabled: false },
      memcachedAuth: { mode: 'none', hasPassword: false },
      favorite: false,
      tags: [],
      createdAt: now,
      updatedAt: now,
    });

    const columns = sqlite.prepare('PRAGMA table_info(connection_profiles)').all() as Array<{
      name: string;
    }>;
    expect(columns.some((column) => column.name === 'password')).toBe(false);
    expect(columns.some((column) => column.name === 'redis_auth_password')).toBe(false);

    const row = sqlite
      .prepare('SELECT * FROM connection_profiles WHERE id = ?')
      .get('profile-secret') as Record<string, unknown>;
    expect(Object.keys(row)).toContain('redis_auth_has_password');
    expect(Object.keys(row)).toContain('memcached_auth_has_password');
    expect(Object.keys(row).some((key) => key === 'redis_auth_password')).toBe(false);
    expect(Object.keys(row).some((key) => key === 'memcached_auth_password')).toBe(false);

    sqlite.close();
  });
});
