// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  memcachedSetChannel,
  memcachedSetResponseSchema,
  redisStreamAddChannel,
  redisStringSetChannel,
  redisStringSetResponseSchema,
} from '../../shared/ipc/ipc.contract';

const mocks = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();
  return {
    handlers,
    ipcMainHandle: vi.fn((channel: string, handler: (...args: unknown[]) => Promise<unknown>) => {
      handlers.set(channel, handler);
    }),
    getPersistenceStatus: vi.fn(() => ({ ready: true })),
    profilesService: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      search: vi.fn(),
      setTags: vi.fn(),
      toggleFavorite: vi.fn(),
    },
    profileSecrets: {
      getStorageStatus: vi.fn(() => ({ backend: 'kwallet', canPersistCredentials: true })),
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
        safetyReason: 'read-only',
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
      executeMemcachedSet: vi.fn(),
      executeMemcachedGet: vi.fn(),
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
}));

vi.mock('../domain/persistence/services/connection-profiles.service', () => ({
  profilesService: mocks.profilesService,
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

describe('registerIpcHandlers mutation channels', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.handlers.clear();
    const mod = await import('../ipc/register-handlers');
    mod.registerIpcHandlers();
  });

  it('returns blocked envelope for redis string set when read-only', async () => {
    mocks.connectionSessionService.executeRedisStringSet.mockResolvedValue({
      ok: false,
      error: {
        code: 'MUTATION_BLOCKED_READ_ONLY',
        message: 'Mutations are blocked while safety mode is read-only.',
      },
    });

    const handler = mocks.handlers.get(redisStringSetChannel);
    const response = await handler?.({}, { key: 'guard:key', value: 'next' });
    const parsed = redisStringSetResponseSchema.safeParse(response);

    expect(parsed.success).toBe(true);
    if (parsed.success && 'error' in parsed.data) {
      expect(parsed.data.error.code).toBe('MUTATION_BLOCKED_READ_ONLY');
    }
  });

  it('returns validation envelope for redis stream add invalid payload', async () => {
    const handler = mocks.handlers.get(redisStreamAddChannel);
    const response = await handler?.({}, { key: 'stream:key', entries: [] });

    expect(response).toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.objectContaining({
          code: 'VALIDATION_ERROR',
        }),
      }),
    );
  });

  it('returns success envelope for memcached:set', async () => {
    mocks.connectionSessionService.executeMemcachedSet.mockResolvedValue({
      ok: true,
      data: {
        key: 'session:42',
        stored: true,
        flags: 0,
        ttlSeconds: 0,
        bytes: 11,
      },
    });

    const handler = mocks.handlers.get(memcachedSetChannel);
    const response = await handler?.({}, { key: 'session:42', value: '{"ok":true}' });
    const parsed = memcachedSetResponseSchema.safeParse(response);

    expect(parsed.success).toBe(true);
    if (parsed.success && 'data' in parsed.data) {
      expect(parsed.data.data.key).toBe('session:42');
      expect(parsed.data.data.stored).toBe(true);
    }
  });
});
