// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getDatabase: vi.fn(() => ({ __db: true })),
  listSavedSearches: vi.fn(),
  getSavedSearchById: vi.fn(),
  createSavedSearch: vi.fn(),
  deleteSavedSearch: vi.fn(),
  randomUUID: vi.fn(() => '11111111-1111-4111-8111-111111111111'),
}));

vi.mock('../domain/persistence/db/connection', () => ({
  getDatabase: mocks.getDatabase,
}));

vi.mock('../domain/persistence/repositories/saved-searches.repository', () => ({
  listSavedSearches: mocks.listSavedSearches,
  getSavedSearchById: mocks.getSavedSearchById,
  createSavedSearch: mocks.createSavedSearch,
  deleteSavedSearch: mocks.deleteSavedSearch,
}));

vi.mock('node:crypto', () => ({
  randomUUID: mocks.randomUUID,
}));

import { savedSearchesService } from '../domain/persistence/services/saved-searches.service';

describe('saved searches service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects invalid create payloads with validation errors', async () => {
    const result = await savedSearchesService.create({
      query: '   ',
      prefix: 'x',
    });

    expect(result.ok).toBe(false);
  });

  it('normalizes scope fields and creates deterministic name', async () => {
    mocks.createSavedSearch.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      name: 'session:* [connection:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa | prefix:service:session]',
      query: 'session:*',
      connectionProfileId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      prefix: 'service:session',
      createdAt: 'now',
      updatedAt: 'now',
    });

    const result = await savedSearchesService.create({
      query: '  session:* ',
      connectionProfileId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      prefix: ' service:session ',
    });

    expect(result.ok).toBe(true);
    expect(mocks.createSavedSearch).toHaveBeenCalledTimes(1);
    const payload = mocks.createSavedSearch.mock.calls[0]?.[1];
    expect(payload.query).toBe('session:*');
    expect(payload.prefix).toBe('service:session');
    expect(payload.name).toBe(
      'session:* [connection:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa | prefix:service:session]',
    );
  });

  it('returns not found envelope on delete miss', async () => {
    mocks.deleteSavedSearch.mockResolvedValue(null);
    const result = await savedSearchesService.delete('11111111-1111-4111-8111-111111111112');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_FOUND');
    }
  });
});
