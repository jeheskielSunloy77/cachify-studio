// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  preferencesGetChannel,
  preferencesGetResponseSchema,
  preferencesUpdateChannel,
  preferencesUpdateResponseSchema,
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
    preferencesService: {
      get: vi.fn(),
      update: vi.fn(),
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

vi.mock('../domain/persistence/services/preferences.service', () => ({
  preferencesService: mocks.preferencesService,
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

vi.mock('../domain/exports/markdown-bundle.service', () => ({
  createMarkdownBundle: vi.fn(),
}));

vi.mock('../domain/persistence/repositories/exports-index.repository', () => ({
  createExportArtifact: vi.fn(),
}));

describe('registerIpcHandlers preferences channels', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.handlers.clear();
    mocks.preferencesService.get.mockReturnValue({
      version: 1,
      explorer: { decodePipelineId: 'raw-text' },
      desktop: {
        globalShortcutAccelerator: 'CommandOrControl+Shift+K',
        density: 'comfortable',
      },
    });
    mocks.preferencesService.update.mockReturnValue({
      ok: true,
      data: {
        version: 1,
        explorer: { decodePipelineId: 'json-pretty' },
        desktop: {
          globalShortcutAccelerator: 'CommandOrControl+Shift+K',
          density: 'comfortable',
        },
      },
    });

    const mod = await import('../ipc/register-handlers');
    mod.registerIpcHandlers();
  });

  it('returns preferences snapshot envelope for preferences:get', async () => {
    const handler = mocks.handlers.get(preferencesGetChannel);
    const response = await handler?.({}, {});
    const parsed = preferencesGetResponseSchema.safeParse(response);

    expect(parsed.success).toBe(true);
    if (parsed.success && 'data' in parsed.data) {
      expect(parsed.data.data.explorer.decodePipelineId).toBe('raw-text');
    }
  });

  it('validates payload and returns errors for malformed preferences:update requests', async () => {
    const handler = mocks.handlers.get(preferencesUpdateChannel);
    const response = await handler?.({}, { preferences: { explorer: { decodePipelineId: 'bad' } } });
    const parsed = preferencesUpdateResponseSchema.safeParse(response);

    expect(parsed.success).toBe(true);
    if (parsed.success && 'error' in parsed.data) {
      expect(parsed.data.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('returns updated preferences envelope for valid preferences:update requests', async () => {
    const handler = mocks.handlers.get(preferencesUpdateChannel);
    const response = await handler?.({}, {
      preferences: {
        explorer: {
          decodePipelineId: 'json-pretty',
        },
      },
    });
    const parsed = preferencesUpdateResponseSchema.safeParse(response);

    expect(parsed.success).toBe(true);
    if (parsed.success && 'data' in parsed.data) {
      expect(parsed.data.data.explorer.decodePipelineId).toBe('json-pretty');
    }
    expect(mocks.preferencesService.update).toHaveBeenCalledWith({
      explorer: {
        decodePipelineId: 'json-pretty',
      },
    });
  });
});
