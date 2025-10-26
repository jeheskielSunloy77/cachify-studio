// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getDatabase: vi.fn(() => ({ __db: true })),
  listProfiles: vi.fn(),
  searchProfiles: vi.fn(),
  createProfile: vi.fn(),
  updateProfile: vi.fn(),
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
  createProfile: mocks.createProfile,
  updateProfile: mocks.updateProfile,
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
});
