// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createTestDatabase } from '../domain/persistence/db/test-utils';
import {
  createSavedSearch,
  deleteSavedSearch,
  getSavedSearchById,
  listSavedSearches,
} from '../domain/persistence/repositories/saved-searches.repository';
import { createProfile } from '../domain/persistence/repositories/connection-profiles.repository';

describe('saved searches repository', () => {
  it('creates, lists, and fetches saved searches with scope mapping', async () => {
    const { db, sqlite } = createTestDatabase();
    await createProfile(db, {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      name: 'Redis Scope',
      kind: 'redis',
      host: 'localhost',
      port: 6379,
      environment: 'local',
      credentialPolicy: 'save',
      redisAuth: { mode: 'none', hasPassword: false },
      redisTls: { enabled: false },
      memcachedAuth: { mode: 'none', hasPassword: false },
      favorite: false,
      tags: [],
      createdAt: '2026-02-13T09:59:00.000Z',
      updatedAt: '2026-02-13T09:59:00.000Z',
    });

    await createSavedSearch(db, {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'user lookup [prefix:users]',
      query: 'users:*',
      connectionProfileId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      prefix: 'users',
      createdAt: '2026-02-13T10:00:00.000Z',
      updatedAt: '2026-02-13T10:00:00.000Z',
    });

    await createSavedSearch(db, {
      id: '22222222-2222-4222-8222-222222222222',
      name: 'global session lookup',
      query: 'session:*',
      connectionProfileId: null,
      prefix: null,
      createdAt: '2026-02-13T10:00:01.000Z',
      updatedAt: '2026-02-13T10:00:01.000Z',
    });

    const listed = await listSavedSearches(db);
    expect(listed).toHaveLength(2);
    expect(listed[0]?.id).toBe('22222222-2222-4222-8222-222222222222');
    expect(listed[1]?.connectionProfileId).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

    const byId = await getSavedSearchById(db, '11111111-1111-4111-8111-111111111111');
    expect(byId?.query).toBe('users:*');
    expect(byId?.prefix).toBe('users');

    sqlite.close();
  });

  it('returns null when deleting unknown saved search', async () => {
    const { db, sqlite } = createTestDatabase();
    const deleted = await deleteSavedSearch(db, '33333333-3333-4333-8333-333333333333');
    expect(deleted).toBeNull();
    sqlite.close();
  });
});
