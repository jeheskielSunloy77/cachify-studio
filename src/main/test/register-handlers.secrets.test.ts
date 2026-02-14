// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  profileSecretsLoadChannel,
  profileSecretsLoadResponseSchema,
  profileSecretsSaveChannel,
  profileSecretsSaveResponseSchema,
  profileSecretsStorageStatusChannel,
  profileSecretsStorageStatusResponseSchema,
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
      unlockMutations: vi.fn(async () => ({
        ok: true,
        data: {
          state: 'connected',
          activeProfileId: 'x',
          pendingProfileId: null,
          activeKind: 'redis',
          environmentLabel: 'local',
          safetyMode: 'unlocked',
          safetyUpdatedAt: 'now',
          lastConnectionError: null,
          updatedAt: 'now',
        },
      })),
      relockMutations: vi.fn(async () => ({
        ok: true,
        data: {
          state: 'connected',
          activeProfileId: 'x',
          pendingProfileId: null,
          activeKind: 'redis',
          environmentLabel: 'local',
          safetyMode: 'readOnly',
          safetyUpdatedAt: 'now',
          lastConnectionError: null,
          updatedAt: 'now',
        },
      })),
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

describe('registerIpcHandlers secret channels', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.handlers.clear();
    const mod = await import('../ipc/register-handlers');
    mod.registerIpcHandlers();
  });

  it('returns storage capability envelope', async () => {
    mocks.profileSecrets.getStorageStatus.mockReturnValue({
      backend: 'kwallet',
      canPersistCredentials: true,
    });
    const handler = mocks.handlers.get(profileSecretsStorageStatusChannel);
    const response = await handler?.({}, {});
    const parsed = profileSecretsStorageStatusResponseSchema.safeParse(response);
    expect(parsed.success).toBe(true);
    if (parsed.success && 'data' in parsed.data) {
      expect(parsed.data.data.backend).toBe('kwallet');
    }
  });

  it('returns save error envelope for disabled credential persistence', async () => {
    mocks.profileSecrets.save.mockReturnValue({
      ok: false,
      error: {
        code: 'CREDENTIAL_SAVE_DISABLED',
        message: 'Use prompt every session.',
      },
    });
    const handler = mocks.handlers.get(profileSecretsSaveChannel);
    const response = await handler?.({}, {
      profileId: '11111111-1111-4111-8111-111111111111',
      type: 'redis',
      secret: { password: 'x' },
    });
    const parsed = profileSecretsSaveResponseSchema.safeParse(response);
    expect(parsed.success).toBe(true);
    if (parsed.success && 'error' in parsed.data) {
      expect(parsed.data.error.code).toBe('CREDENTIAL_SAVE_DISABLED');
    }
  });

  it('loads credentials from secure store envelope', async () => {
    mocks.profileSecrets.load.mockReturnValue({
      ok: true,
      data: {
        profileId: '11111111-1111-4111-8111-111111111111',
        type: 'redis',
        secret: {
          username: 'default',
          password: 'top-secret',
        },
      },
    });
    const handler = mocks.handlers.get(profileSecretsLoadChannel);
    const response = await handler?.({}, {
      profileId: '11111111-1111-4111-8111-111111111111',
      type: 'redis',
    });
    const parsed = profileSecretsLoadResponseSchema.safeParse(response);
    expect(parsed.success).toBe(true);
    if (parsed.success && 'data' in parsed.data) {
      expect(parsed.data.data.secret.password).toBe('top-secret');
    }
  });
});
