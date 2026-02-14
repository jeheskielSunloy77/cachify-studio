// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  savedSearchesCreateChannel,
  savedSearchesCreateResponseSchema,
  savedSearchesListChannel,
  savedSearchesListResponseSchema,
} from '../../shared/ipc/ipc.contract';

const mocks = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();
  return {
    handlers,
    ipcMainHandle: vi.fn((channel: string, handler: (...args: unknown[]) => Promise<unknown>) => {
      handlers.set(channel, handler);
    }),
    getPersistenceStatus: vi.fn<
      () => { ready: boolean; code?: string; diagnosticId?: string }
    >(() => ({ ready: true })),
    getDatabase: vi.fn(() => ({ __db: true })),
    profilesService: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      search: vi.fn(),
      setTags: vi.fn(),
      toggleFavorite: vi.fn(),
    },
    savedSearchesService: {
      list: vi.fn(),
      create: vi.fn(),
      getById: vi.fn(),
      delete: vi.fn(),
    },
    profileSecrets: {
      getStorageStatus: vi.fn(),
      save: vi.fn(),
      load: vi.fn(),
      delete: vi.fn(),
    },
    connectionSessionService: {
      subscribe: vi.fn((): (() => void) => () => undefined),
      getStatus: vi.fn(() => ({
        state: 'disconnected',
        activeProfileId: null,
        pendingProfileId: null,
        activeKind: null,
        environmentLabel: null,
        safetyMode: 'readOnly',
        safetyUpdatedAt: 'now',
        lastConnectionError: null,
        updatedAt: 'now',
      })),
      connect: vi.fn(),
      disconnect: vi.fn(async () => ({
        ok: true,
        data: {
          state: 'disconnected',
          activeProfileId: null,
          pendingProfileId: null,
          activeKind: null,
          environmentLabel: null,
          safetyMode: 'readOnly',
          safetyUpdatedAt: 'now',
          lastConnectionError: null,
          updatedAt: 'now',
        },
      })),
      switch: vi.fn(),
      unlockMutations: vi.fn(),
      relockMutations: vi.fn(),
      executeRedisStringSet: vi.fn(),
      executeRedisHashSetField: vi.fn(),
      executeRedisListPush: vi.fn(),
      executeRedisSetAdd: vi.fn(),
      executeRedisZSetAdd: vi.fn(),
      executeRedisStreamAdd: vi.fn(),
      executeRedisKeyDelete: vi.fn(),
      executeMemcachedGet: vi.fn(),
      executeMemcachedSet: vi.fn(),
      executeMemcachedStats: vi.fn(),
      executeRedisCommand: vi.fn(),
    },
  };
});

vi.mock('electron', () => ({
  ipcMain: {
    handle: mocks.ipcMainHandle,
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
  clipboard: {
    writeText: vi.fn(),
  },
}));

vi.mock('../domain/persistence/db/connection', () => ({
  getPersistenceStatus: mocks.getPersistenceStatus,
  getDatabase: mocks.getDatabase,
}));

vi.mock('../domain/persistence/services/connection-profiles.service', () => ({
  profilesService: mocks.profilesService,
}));

vi.mock('../domain/persistence/services/saved-searches.service', () => ({
  savedSearchesService: mocks.savedSearchesService,
}));

vi.mock('../domain/security/secrets', () => ({
  profileSecrets: mocks.profileSecrets,
}));

vi.mock('../domain/cache/session/connection-session.service', () => ({
  connectionSessionService: mocks.connectionSessionService,
}));

vi.mock('../domain/app.service', () => ({
  getPingPayload: () => ({ pong: 'pong', serverTime: Date.now() }),
}));

vi.mock('../domain/cache/explorer/redis-key-discovery.service', () => ({
  runRedisKeyDiscoveryJob: vi.fn(),
}));

vi.mock('../domain/cache/inspector/redis-inspector.service', () => ({
  runRedisInspectJob: vi.fn(),
  buildRedisInspectCopyPayload: vi.fn(() => ({
    text: 'copy',
    modeUsed: 'safeRedacted',
    copiedBytes: 4,
    redactionApplied: true,
  })),
}));

vi.mock('../domain/cache/inspector/memcached-inspector.service', () => ({
  normalizeMemcachedGetResult: vi.fn(),
  normalizeMemcachedStatsResult: vi.fn(),
}));

describe('registerIpcHandlers saved search channels', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.handlers.clear();
    mocks.getPersistenceStatus.mockReturnValue({ ready: true });
    const mod = await import('../ipc/register-handlers');
    mod.registerIpcHandlers();
  });

  it('returns validation envelope for invalid saved-search create payload', async () => {
    const handler = mocks.handlers.get(savedSearchesCreateChannel);
    const response = await handler?.({}, { search: { query: '' } });
    const parsed = savedSearchesCreateResponseSchema.safeParse(response);

    expect(parsed.success).toBe(true);
    if (parsed.success && 'error' in parsed.data) {
      expect(parsed.data.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('returns success envelope for saved-search list', async () => {
    mocks.savedSearchesService.list.mockResolvedValue([
      {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'session:* [prefix:session]',
        query: 'session:*',
        connectionProfileId: null,
        prefix: 'session',
        createdAt: '2026-02-13T10:00:00.000Z',
        updatedAt: '2026-02-13T10:00:00.000Z',
      },
    ]);

    const handler = mocks.handlers.get(savedSearchesListChannel);
    const response = await handler?.({}, {});
    const parsed = savedSearchesListResponseSchema.safeParse(response);

    expect(parsed.success).toBe(true);
    if (parsed.success && 'data' in parsed.data) {
      expect(parsed.data.data).toHaveLength(1);
      expect(parsed.data.data[0]?.query).toBe('session:*');
    }
  });

  it('returns persistence envelope when storage is unavailable', async () => {
    mocks.getPersistenceStatus.mockReturnValue({
      ready: false,
      code: 'PERSISTENCE_INIT_FAILED',
      diagnosticId: 'diag-saved-search',
    });

    const handler = mocks.handlers.get(savedSearchesListChannel);
    const response = await handler?.({}, {});
    const parsed = savedSearchesListResponseSchema.safeParse(response);

    expect(parsed.success).toBe(true);
    if (parsed.success && 'error' in parsed.data) {
      expect(parsed.data.error.code).toBe('PERSISTENCE_INIT_FAILED');
    }
  });
});
