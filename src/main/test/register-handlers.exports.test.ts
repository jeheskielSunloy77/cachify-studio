// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type RedisInspectorResult,
  exportsMarkdownCreateChannel,
  exportsMarkdownCreateResponseSchema,
} from '../../shared/ipc/ipc.contract';

const noneResultPayload: RedisInspectorResult = {
  key: 'missing:key',
  type: 'none' as const,
  ttlSeconds: -2,
  isPartial: false as const,
  capReached: false as const,
  previewBytes: 0 as const,
  maxDepthApplied: null,
  redaction: {
    policyId: 'safe-default-redaction',
    policyVersion: '1.0.0',
    policySummary: 'Masks JWT, bearer tokens, sensitive key/value pairs, and high-entropy tokens.',
    redactedSegments: 0,
    redactionApplied: false,
  },
  fetchedCount: 0 as const,
  reason: 'Key does not exist.',
};

const mocks = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();
  return {
    handlers,
    ipcMainHandle: vi.fn((channel: string, handler: (...args: unknown[]) => Promise<unknown>) => {
      handlers.set(channel, handler);
    }),
    getPersistenceStatus: vi.fn(() => ({ ready: true })),
    getDatabase: vi.fn(() => ({ __db: true })),
    createExportArtifact: vi.fn(),
    createMarkdownBundle: vi.fn(),
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

vi.mock('../domain/persistence/repositories/exports-index.repository', () => ({
  createExportArtifact: mocks.createExportArtifact,
}));

vi.mock('../domain/exports/markdown-bundle.service', () => ({
  createMarkdownBundle: mocks.createMarkdownBundle,
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

describe('registerIpcHandlers exports markdown channel', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.handlers.clear();
    mocks.getPersistenceStatus.mockReturnValue({ ready: true });
    const mod = await import('../ipc/register-handlers');
    mod.registerIpcHandlers();
  });

  it('returns validation envelope for invalid exports payload', async () => {
    const handler = mocks.handlers.get(exportsMarkdownCreateChannel);
    const response = await handler?.({}, {});
    const parsed = exportsMarkdownCreateResponseSchema.safeParse(response);

    expect(parsed.success).toBe(true);
    if (parsed.success && 'error' in parsed.data) {
      expect(parsed.data.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('returns write failure envelope when markdown bundle write fails', async () => {
    mocks.createMarkdownBundle.mockReturnValue({
      ok: false,
      error: {
        code: 'EXPORT_WRITE_FAILED',
        message: 'Failed to write Markdown bundle.',
      },
    });

    const handler = mocks.handlers.get(exportsMarkdownCreateChannel);
    const response = await handler?.({}, {
      result: noneResultPayload,
      environmentLabel: 'local',
    });
    const parsed = exportsMarkdownCreateResponseSchema.safeParse(response);

    expect(parsed.success).toBe(true);
    if (parsed.success && 'error' in parsed.data) {
      expect(parsed.data.error.code).toBe('EXPORT_WRITE_FAILED');
    }
  });

  it('returns success envelope when bundle is written and indexed', async () => {
    mocks.createMarkdownBundle.mockReturnValue({
      ok: true,
      data: {
        filePath: '/tmp/cachify-export.md',
        fileName: 'cachify-export.md',
        createdAt: '2026-02-13T10:00:00.000Z',
        key: 'missing:key',
        redactionPolicy: 'safe-default-redaction',
        redactionPolicyVersion: '1.0.0',
        previewMode: 'safeRedacted',
      },
    });
    mocks.createExportArtifact.mockReturnValue({
      id: '11111111-1111-4111-8111-111111111111',
      filePath: '/tmp/cachify-export.md',
      createdAt: '2026-02-13T10:00:00.000Z',
      profileId: 'profile-1',
      key: 'missing:key',
      redactionPolicy: 'safe-default-redaction',
      redactionPolicyVersion: '1.0.0',
      previewMode: 'safeRedacted',
    });

    const handler = mocks.handlers.get(exportsMarkdownCreateChannel);
    const response = await handler?.({}, {
      result: noneResultPayload,
      environmentLabel: 'local',
    });
    const parsed = exportsMarkdownCreateResponseSchema.safeParse(response);

    expect(parsed.success).toBe(true);
    if (parsed.success && 'data' in parsed.data) {
      expect(parsed.data.data.id).toBe('11111111-1111-4111-8111-111111111111');
      expect(parsed.data.data.filePath).toBe('/tmp/cachify-export.md');
      expect(parsed.data.data.previewMode).toBe('safeRedacted');
    }
    expect(mocks.createExportArtifact).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        filePath: '/tmp/cachify-export.md',
        key: 'missing:key',
        previewMode: 'safeRedacted',
      }),
    );
    expect(
      (mocks.createExportArtifact.mock.calls[0]?.[1] as Record<string, unknown>)?.value,
    ).toBeUndefined();
  });
});
