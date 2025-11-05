// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getDatabase: vi.fn(() => ({ __db: true })),
  listProfiles: vi.fn(),
  searchProfiles: vi.fn(),
  getProfileById: vi.fn(),
  createProfile: vi.fn(),
  updateProfile: vi.fn(),
  updateProfileAuthSettings: vi.fn(),
  deleteProfile: vi.fn(),
  setProfileTags: vi.fn(),
  setProfileFavorite: vi.fn(),
  randomUUID: vi.fn(() => 'profile-uuid'),
}));

vi.mock('../domain/persistence/db/connection', () => ({
  getDatabase: mocks.getDatabase,
}));

vi.mock('../domain/persistence/repositories/connection-profiles.repository', () => ({
  listProfiles: mocks.listProfiles,
  searchProfiles: mocks.searchProfiles,
  getProfileById: mocks.getProfileById,
  createProfile: mocks.createProfile,
  updateProfile: mocks.updateProfile,
  updateProfileAuthSettings: mocks.updateProfileAuthSettings,
  deleteProfile: mocks.deleteProfile,
  setProfileTags: mocks.setProfileTags,
  setProfileFavorite: mocks.setProfileFavorite,
}));

vi.mock('node:crypto', () => ({
  randomUUID: mocks.randomUUID,
}));

import { profilesService } from '../domain/persistence/services/connection-profiles.service';

describe('connection profiles service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects invalid create payloads with validation errors', async () => {
    const result = await profilesService.create({
      name: '',
      kind: 'redis',
      host: '',
      port: 70000,
    });

    expect(result.ok).toBe(false);
  });

  it('normalizes and de-duplicates tags before create', async () => {
    mocks.createProfile.mockResolvedValue({
      id: 'profile-uuid',
      name: 'Prod',
      kind: 'redis',
      host: 'prod.cache.local',
      port: 6379,
      favorite: false,
      tags: ['prod', 'payments'],
      createdAt: 'now',
      updatedAt: 'now',
    });

    const result = await profilesService.create({
      name: 'Prod',
      kind: 'redis',
      host: 'prod.cache.local',
      port: 6379,
      tags: [' prod ', 'payments', 'prod'],
    });

    expect(result.ok).toBe(true);
    expect(mocks.createProfile).toHaveBeenCalledTimes(1);
    expect(mocks.createProfile.mock.calls[0]?.[1]?.tags).toEqual(['prod', 'payments']);
  });

  it('returns NOT_FOUND when delete target does not exist', async () => {
    mocks.deleteProfile.mockResolvedValue(null);

    const result = await profilesService.delete('missing-id');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_FOUND');
    }
  });

  it('rejects update when merged profile state violates kind/tls constraints', async () => {
    mocks.getProfileById.mockReturnValue({
      id: 'profile-1',
      name: 'Memcached QA',
      kind: 'memcached',
      host: 'qa.cache.local',
      port: 11211,
      environment: 'staging',
      credentialPolicy: 'save',
      redisAuth: { mode: 'none', hasPassword: false },
      redisTls: { enabled: false },
      memcachedAuth: { mode: 'none', hasPassword: false },
      favorite: false,
      tags: ['qa'],
      createdAt: 'now',
      updatedAt: 'now',
    });

    const result = await profilesService.update('profile-1', {
      redisTls: { enabled: true },
    });

    expect(result.ok).toBe(false);
    expect(mocks.updateProfile).not.toHaveBeenCalled();
    expect(mocks.updateProfileAuthSettings).not.toHaveBeenCalled();
  });
});
