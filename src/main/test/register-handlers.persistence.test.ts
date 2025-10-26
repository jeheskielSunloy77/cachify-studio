// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { profilesCreateChannel, profilesCreateResponseSchema, profilesListChannel, profilesListResponseSchema } from '../../shared/ipc/ipc.contract';

const mocks = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();
  return {
    handlers,
    ipcMainHandle: vi.fn((channel: string, handler: (...args: unknown[]) => Promise<unknown>) => {
      handlers.set(channel, handler);
    }),
    getPersistenceStatus: vi.fn(),
    profilesService: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      search: vi.fn(),
      setTags: vi.fn(),
      toggleFavorite: vi.fn(),
    },
  };
});

vi.mock('electron', () => ({
  ipcMain: {
    handle: mocks.ipcMainHandle,
  },
}));

vi.mock('../domain/persistence/db/connection', () => ({
  getPersistenceStatus: mocks.getPersistenceStatus,
}));

vi.mock('../domain/persistence/services/connection-profiles.service', () => ({
  profilesService: mocks.profilesService,
}));

vi.mock('../domain/app.service', () => ({
  getPingPayload: () => ({ pong: 'pong', serverTime: Date.now() }),
}));

describe('registerIpcHandlers persistence gating', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.handlers.clear();
    mocks.getPersistenceStatus.mockReturnValue({
      ready: false,
      code: 'PERSISTENCE_INIT_FAILED',
      diagnosticId: 'diag-test',
    });
    const mod = await import('../ipc/register-handlers');
    mod.registerIpcHandlers();
  });

  it('returns persistence envelope for profiles:list when persistence is unavailable', async () => {
    const handler = mocks.handlers.get(profilesListChannel);
    expect(handler).toBeDefined();
    const response = await handler?.({}, {});

    const parsed = profilesListResponseSchema.safeParse(response);
    expect(parsed.success).toBe(true);
    if (parsed.success && 'error' in parsed.data) {
      expect(parsed.data.error.code).toBe('PERSISTENCE_INIT_FAILED');
    }
  });

  it('returns persistence envelope for profiles:create when persistence is unavailable', async () => {
    const handler = mocks.handlers.get(profilesCreateChannel);
    expect(handler).toBeDefined();
    const response = await handler?.({}, {
      profile: { name: 'Prod', kind: 'redis', host: 'localhost', port: 6379 },
    });

    const parsed = profilesCreateResponseSchema.safeParse(response);
    expect(parsed.success).toBe(true);
    if (parsed.success && 'error' in parsed.data) {
      expect(parsed.data.error.code).toBe('PERSISTENCE_INIT_FAILED');
    }
  });
});
