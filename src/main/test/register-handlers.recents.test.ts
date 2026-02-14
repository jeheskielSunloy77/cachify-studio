// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  recentKeysListChannel,
  recentKeysListResponseSchema,
  recentKeysReopenChannel,
  recentKeysReopenResponseSchema,
} from '../../shared/ipc/ipc.contract';

const mocks = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();
  return {
    handlers,
    ipcMainHandle: vi.fn((channel: string, handler: (...args: unknown[]) => Promise<unknown>) => {
      handlers.set(channel, handler);
    }),
    getPersistenceStatus: vi.fn(() => ({ ready: true })),
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
    recentKeysSessionService: {
      list: vi.fn(),
      reopen: vi.fn(),
      record: vi.fn(),
      reset: vi.fn(),
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
        state: 'connected',
        activeProfileId: 'profile-1',
        pendingProfileId: null,
        activeKind: 'redis',
        environmentLabel: 'local',
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

vi.mock('../domain/cache/session/recent-keys-session.service', () => ({
  recentKeysSessionService: mocks.recentKeysSessionService,
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

describe('registerIpcHandlers recents channels', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.handlers.clear();
    mocks.connectionSessionService.getStatus.mockReturnValue({
      state: 'connected',
      activeProfileId: 'profile-1',
      pendingProfileId: null,
      activeKind: 'redis',
      environmentLabel: 'local',
      safetyMode: 'readOnly',
      safetyUpdatedAt: 'now',
      lastConnectionError: null,
      updatedAt: 'now',
    });
    const mod = await import('../ipc/register-handlers');
    mod.registerIpcHandlers();
  });

  it('returns validation envelope for invalid recents:reopen payload', async () => {
    const handler = mocks.handlers.get(recentKeysReopenChannel);
    const response = await handler?.({}, { key: '' });
    const parsed = recentKeysReopenResponseSchema.safeParse(response);

    expect(parsed.success).toBe(true);
    if (parsed.success && 'error' in parsed.data) {
      expect(parsed.data.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('returns recents list envelope for active redis connection', async () => {
    mocks.recentKeysSessionService.list.mockReturnValue([
      {
        key: 'orders:42',
        type: 'hash',
        ttlSeconds: 120,
        inspectedAt: '2026-02-13T10:00:00.000Z',
      },
    ]);

    const handler = mocks.handlers.get(recentKeysListChannel);
    const response = await handler?.({}, {});
    const parsed = recentKeysListResponseSchema.safeParse(response);

    expect(parsed.success).toBe(true);
    if (parsed.success && 'data' in parsed.data) {
      expect(parsed.data.data).toHaveLength(1);
      expect(parsed.data.data[0]?.key).toBe('orders:42');
    }
  });

  it('returns not-connected envelope when redis session is unavailable', async () => {
    mocks.connectionSessionService.getStatus.mockReturnValue({
      state: 'disconnected',
      activeProfileId: null,
      pendingProfileId: null,
      activeKind: null,
      environmentLabel: null,
      safetyMode: 'readOnly',
      safetyUpdatedAt: 'now',
      lastConnectionError: null,
      updatedAt: 'now',
    });

    const handler = mocks.handlers.get(recentKeysListChannel);
    const response = await handler?.({}, {});
    const parsed = recentKeysListResponseSchema.safeParse(response);

    expect(parsed.success).toBe(true);
    if (parsed.success && 'error' in parsed.data) {
      expect(parsed.data.error.code).toBe('NOT_CONNECTED');
    }
  });
});
