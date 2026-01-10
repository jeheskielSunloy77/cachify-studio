import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../app/App';
import type { RendererApi } from '@/preload/api';
import type {
  RedisInspectDoneEvent,
  RedisInspectProgressEvent,
  RedisKeysSearchDoneEvent,
  RedisKeysSearchProgressEvent,
} from '@/shared/ipc/ipc.contract';

const ok = <T,>(data: T) => ({ ok: true as const, data });
const fail = (code: string, message: string) => ({
  ok: false as const,
  error: { code, message },
});

const buildApi = (overrides: Partial<RendererApi> = {}): RendererApi => {
  const base = {
    ping: async () => ok({ pong: 'pong', serverTime: Date.now() }),
    profiles: {
      list: async () => ok([]),
      search: async () => ok([]),
      create: vi.fn(async () =>
        ok({
          id: 'profile-1',
          name: 'Redis',
          kind: 'redis',
          environment: 'local',
          host: 'localhost',
          port: 6379,
          tags: [],
          credentialPolicy: 'promptEverySession',
          redisAuth: { mode: 'none', hasPassword: false },
          redisTls: { enabled: false },
          memcachedAuth: { mode: 'none', hasPassword: false },
          favorite: false,
          createdAt: 'now',
          updatedAt: 'now',
        }),
      ),
      update: vi.fn(async () =>
        ok({
          id: 'profile-1',
          name: 'Redis',
          kind: 'redis',
          environment: 'local',
          host: 'localhost',
          port: 6379,
          tags: [],
          credentialPolicy: 'promptEverySession',
          redisAuth: { mode: 'none', hasPassword: false },
          redisTls: { enabled: false },
          memcachedAuth: { mode: 'none', hasPassword: false },
          favorite: false,
          createdAt: 'now',
          updatedAt: 'now',
        }),
      ),
      delete: vi.fn(async () => ok({ id: 'profile-1' })),
      toggleFavorite: vi.fn(async () =>
        ok({
          id: 'profile-1',
          name: 'Redis',
          kind: 'redis',
          environment: 'local',
          host: 'localhost',
          port: 6379,
          tags: [],
          credentialPolicy: 'promptEverySession',
          redisAuth: { mode: 'none', hasPassword: false },
          redisTls: { enabled: false },
          memcachedAuth: { mode: 'none', hasPassword: false },
          favorite: true,
          createdAt: 'now',
          updatedAt: 'now',
        }),
      ),
      setTags: vi.fn(async () =>
        ok({
          id: 'profile-1',
          name: 'Redis',
          kind: 'redis',
          environment: 'local',
          host: 'localhost',
          port: 6379,
          tags: [],
          credentialPolicy: 'promptEverySession',
          redisAuth: { mode: 'none', hasPassword: false },
          redisTls: { enabled: false },
          memcachedAuth: { mode: 'none', hasPassword: false },
          favorite: false,
          createdAt: 'now',
          updatedAt: 'now',
        }),
      ),
    },
    profileSecrets: {
      storageStatus: async () =>
        ok({
          backend: 'kwallet',
          canPersistCredentials: true,
        }),
      save: vi.fn(async () =>
        ok({ profileId: '11111111-1111-4111-8111-111111111111', type: 'redis' as const }),
      ),
      load: vi.fn(async () =>
        ok({
          profileId: '11111111-1111-4111-8111-111111111111',
          type: 'redis' as const,
          secret: { password: 'secret' },
        }),
      ),
      delete: vi.fn(async () =>
        ok({ profileId: '11111111-1111-4111-8111-111111111111', type: 'redis' as const }),
      ),
    },
    connections: {
      connect: vi.fn(async () =>
        ok({
          state: 'connected' as const,
          activeProfileId: 'profile-1',
          pendingProfileId: null,
          activeKind: 'redis' as const,
          environmentLabel: 'local' as const,
          safetyMode: 'readOnly' as const,
          safetyUpdatedAt: 'now',
          lastConnectionError: null,
          updatedAt: 'now',
        }),
      ),
      disconnect: vi.fn(async () =>
        ok({
          state: 'disconnected' as const,
          activeProfileId: null,
          pendingProfileId: null,
          activeKind: null,
          environmentLabel: null,
          safetyMode: 'readOnly' as const,
          safetyUpdatedAt: 'now',
          lastConnectionError: null,
          updatedAt: 'now',
        }),
      ),
      switch: vi.fn(async () =>
        ok({
          state: 'connected' as const,
          activeProfileId: 'profile-1',
          pendingProfileId: null,
          activeKind: 'redis' as const,
          environmentLabel: 'local' as const,
          safetyMode: 'readOnly' as const,
          safetyUpdatedAt: 'now',
          lastConnectionError: null,
          updatedAt: 'now',
        }),
      ),
      getStatus: vi.fn(async () =>
        ok({
          state: 'connected' as const,
          activeProfileId: 'profile-1',
          pendingProfileId: null,
          activeKind: 'redis' as const,
          environmentLabel: 'local' as const,
          safetyMode: 'readOnly' as const,
          safetyUpdatedAt: 'now',
          lastConnectionError: null,
          updatedAt: 'now',
        }),
      ),
      onStatusChanged: vi.fn(
        (): (() => void) => () => undefined,
      ),
    },
    mutations: {
      unlock: vi.fn(async () =>
        ok({
          state: 'connected' as const,
          activeProfileId: 'profile-1',
          pendingProfileId: null,
          activeKind: 'redis' as const,
          environmentLabel: 'local' as const,
          safetyMode: 'unlocked' as const,
          safetyUpdatedAt: 'now',
          lastConnectionError: null,
          updatedAt: 'now',
        }),
      ),
      relock: vi.fn(async () =>
        ok({
          state: 'connected' as const,
          activeProfileId: 'profile-1',
          pendingProfileId: null,
          activeKind: 'redis' as const,
          environmentLabel: 'local' as const,
          safetyMode: 'readOnly' as const,
          safetyUpdatedAt: 'now',
          lastConnectionError: null,
          updatedAt: 'now',
        }),
      ),
    },
    redisKeys: {
      startSearch: vi.fn(async () =>
        ok({
          jobId: 'job-1',
          startedAt: new Date().toISOString(),
        }),
      ),
      onSearchProgress: vi.fn(
        (): (() => void) => () => undefined,
      ),
      onSearchDone: vi.fn(
        (): (() => void) => () => undefined,
      ),
    },
    redisInspect: {
      start: vi.fn(async () =>
        ok({
          jobId: 'inspect-1',
          startedAt: new Date().toISOString(),
        }),
      ),
      onProgress: vi.fn(
        (): (() => void) => () => undefined,
      ),
      onDone: vi.fn(
        (): (() => void) => () => undefined,
      ),
    },
    jobs: {
      cancel: vi.fn(async ({ jobId }: { jobId: string }) =>
        ok({
          jobId,
          cancelled: true,
        }),
      ),
    },
  };

  return {
    ...base,
    ...overrides,
  } as RendererApi;
};

afterEach(() => {
  cleanup();
});

describe('Redis explorer panel', () => {
  it('streams progressive results and allows cancellation', async () => {
    let onProgress: ((event: RedisKeysSearchProgressEvent) => void) | null = null;
    const onSearchProgress = vi.fn(
      (listener: (event: RedisKeysSearchProgressEvent) => void): (() => void) => {
        onProgress = listener;
        return () => undefined;
      },
    );
    const cancel = vi.fn(async ({ jobId }: { jobId: string }) =>
      ok({
        jobId,
        cancelled: true,
      }),
    );
    const startSearch = vi.fn(async () =>
      ok({
        jobId: 'job-1',
        startedAt: new Date().toISOString(),
      }),
    );

    (window as typeof window & { api: RendererApi }).api = buildApi({
      redisKeys: {
        startSearch,
        onSearchProgress,
        onSearchDone: () => () => undefined,
      },
      jobs: { cancel },
    });

    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: 'Start search' }));
    expect(startSearch).toHaveBeenCalledTimes(1);

    onProgress?.({
      jobId: 'job-1',
      status: 'running',
      keys: [
        { key: 'app:users:1', prefixSegments: ['app', 'users', '1'], metadataState: 'pending' },
      ],
      scannedCount: 10,
      emittedCount: 1,
      cursor: '42',
      capReached: false,
      elapsedMs: 40,
    });

    const list = await screen.findByTestId('redis-keys-list');
    await waitFor(() => {
      expect(within(list).getByText('app:users:1')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(cancel).toHaveBeenCalledWith({ jobId: 'job-1' });
  });

  it('shows limit-reached guidance when done event reports caps', async () => {
    let onDone: ((event: RedisKeysSearchDoneEvent) => void) | null = null;
    const onSearchDone = vi.fn(
      (listener: (event: RedisKeysSearchDoneEvent) => void): (() => void) => {
        onDone = listener;
        return () => undefined;
      },
    );

    (window as typeof window & { api: RendererApi }).api = buildApi({
      redisKeys: {
        startSearch: async () =>
          ok({
            jobId: 'job-cap',
            startedAt: new Date().toISOString(),
          }),
        onSearchProgress: () => () => undefined,
        onSearchDone,
      },
    });

    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Start search' }));

    onDone?.({
      jobId: 'job-cap',
      status: 'limit-reached',
      scannedCount: 1000,
      emittedCount: 200,
      capReached: true,
      elapsedMs: 4000,
      continuation: {
        nextCursor: '123',
        message: 'Result cap reached. Refine query or prefix and rerun.',
        suggestedAction: 'refine-search',
      },
    });

    expect(
      await screen.findByText('Result cap reached. Refine query or prefix and rerun.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Limit reached')).toBeInTheDocument();
  });

  it('renders progressive metadata and explicit unavailable fallback states', async () => {
    let onProgress: ((event: RedisKeysSearchProgressEvent) => void) | null = null;
    const onSearchProgress = vi.fn(
      (listener: (event: RedisKeysSearchProgressEvent) => void): (() => void) => {
        onProgress = listener;
        return () => undefined;
      },
    );

    (window as typeof window & { api: RendererApi }).api = buildApi({
      redisKeys: {
        startSearch: async () =>
          ok({
            jobId: 'job-meta',
            startedAt: new Date().toISOString(),
          }),
        onSearchProgress,
        onSearchDone: () => () => undefined,
      },
    });

    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Start search' }));

    onProgress?.({
      jobId: 'job-meta',
      status: 'running',
      keys: [
        { key: 'meta:ok', prefixSegments: ['meta', 'ok'], metadataState: 'pending' },
        { key: 'meta:bad', prefixSegments: ['meta', 'bad'], metadataState: 'pending' },
      ],
      scannedCount: 2,
      emittedCount: 2,
      cursor: '0',
      capReached: false,
      elapsedMs: 50,
    });

    onProgress?.({
      jobId: 'job-meta',
      status: 'running',
      keys: [
        {
          key: 'meta:ok',
          prefixSegments: ['meta', 'ok'],
          type: 'string',
          ttlSeconds: -1,
          metadataState: 'ready',
        },
        {
          key: 'meta:bad',
          prefixSegments: ['meta', 'bad'],
          type: 'unknown',
          ttlSeconds: null,
          metadataState: 'unavailable',
        },
      ],
      scannedCount: 2,
      emittedCount: 2,
      cursor: '0',
      capReached: false,
      elapsedMs: 80,
    });

    expect(await screen.findByText('type: string')).toBeInTheDocument();
    expect(screen.getByText('TTL: persistent')).toBeInTheDocument();
    expect(screen.getByText('TTL: unavailable')).toBeInTheDocument();
  });

  it('renders inspector viewer states for large string and hash previews', async () => {
    let onSearchProgress: ((event: RedisKeysSearchProgressEvent) => void) | null = null;
    let onInspectProgress: ((event: RedisInspectProgressEvent) => void) | null = null;
    let onInspectDone: ((event: RedisInspectDoneEvent) => void) | null = null;

    (window as typeof window & { api: RendererApi }).api = buildApi({
      redisKeys: {
        startSearch: async () =>
          ok({
            jobId: 'job-inspect',
            startedAt: new Date().toISOString(),
          }),
        onSearchProgress: (listener) => {
          onSearchProgress = listener;
          return () => undefined;
        },
        onSearchDone: () => () => undefined,
      },
      redisInspect: {
        start: async () =>
          ok({
            jobId: 'inspect-job',
            startedAt: new Date().toISOString(),
          }),
        onProgress: (listener) => {
          onInspectProgress = listener;
          return () => undefined;
        },
        onDone: (listener) => {
          onInspectDone = listener;
          return () => undefined;
        },
      },
    });

    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: 'Start search' }));
    onSearchProgress?.({
      jobId: 'job-inspect',
      status: 'running',
      keys: [{ key: 'inspect:key', prefixSegments: ['inspect', 'key'], metadataState: 'pending' }],
      scannedCount: 1,
      emittedCount: 1,
      cursor: '0',
      capReached: false,
      elapsedMs: 20,
    });

    await user.click(await screen.findByRole('button', { name: 'Inspect' }));
    onInspectProgress?.({
      jobId: 'inspect-job',
      status: 'running',
      result: {
        key: 'inspect:key',
        type: 'string',
        ttlSeconds: -1,
        isPartial: true,
        capReached: true,
        capReason: 'STRING_PREVIEW_LIMIT',
        fetchedCount: 1,
        byteLength: 1049000,
        value: 'partial-preview',
      },
    });

    expect(await screen.findByText('Cap reached')).toBeInTheDocument();
    expect(screen.getByText('partial-preview')).toBeInTheDocument();
    expect(screen.getByText('Bytes: 1049000 · Fetched count: 1')).toBeInTheDocument();

    onInspectDone?.({
      jobId: 'inspect-job',
      status: 'completed',
      result: {
        key: 'inspect:key',
        type: 'hash',
        ttlSeconds: 42,
        isPartial: false,
        capReached: false,
        fetchedCount: 2,
        totalFields: 2,
        nextCursor: '0',
        hasMore: false,
        entries: [
          { field: 'fieldA', value: 'valueA' },
          { field: 'fieldB', value: 'valueB' },
        ],
      },
    });

    expect(await screen.findByText('fieldA')).toBeInTheDocument();
    expect(screen.getByText('valueB')).toBeInTheDocument();
  });

  it('renders list/set/zset collection inspector variants and partial messaging', async () => {
    let onSearchProgress: ((event: RedisKeysSearchProgressEvent) => void) | null = null;
    let onInspectDone: ((event: RedisInspectDoneEvent) => void) | null = null;

    (window as typeof window & { api: RendererApi }).api = buildApi({
      redisKeys: {
        startSearch: async () =>
          ok({
            jobId: 'job-collections',
            startedAt: new Date().toISOString(),
          }),
        onSearchProgress: (listener) => {
          onSearchProgress = listener;
          return () => undefined;
        },
        onSearchDone: () => () => undefined,
      },
      redisInspect: {
        start: async () =>
          ok({
            jobId: 'inspect-collections',
            startedAt: new Date().toISOString(),
          }),
        onProgress: () => () => undefined,
        onDone: (listener) => {
          onInspectDone = listener;
          return () => undefined;
        },
      },
    });

    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Start search' }));
    onSearchProgress?.({
      jobId: 'job-collections',
      status: 'running',
      keys: [{ key: 'collection:key', prefixSegments: ['collection', 'key'], metadataState: 'pending' }],
      scannedCount: 1,
      emittedCount: 1,
      cursor: '0',
      capReached: false,
      elapsedMs: 10,
    });

    await user.click(await screen.findByRole('button', { name: 'Inspect' }));
    onInspectDone?.({
      jobId: 'inspect-collections',
      status: 'completed',
      result: {
        key: 'collection:key',
        type: 'list',
        ttlSeconds: 10,
        isPartial: true,
        capReached: true,
        capReason: 'COLLECTION_ENTRY_LIMIT',
        fetchedCount: 2,
        totalCount: 5,
        cursor: '2',
        hasMore: true,
        ordering: 'server',
        items: [{ value: 'first' }, { value: 'second' }],
      },
    });

    expect(await screen.findByText('first')).toBeInTheDocument();
    expect(
      screen.getByText('Large result truncated safely. Export raw/partial later for full capture.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Inspect' }));

    onInspectDone?.({
      jobId: 'inspect-collections',
      status: 'completed',
      result: {
        key: 'collection:key',
        type: 'zset',
        ttlSeconds: 10,
        isPartial: false,
        capReached: false,
        fetchedCount: 2,
        totalCount: 2,
        cursor: '0',
        hasMore: false,
        ordering: 'lexical',
        items: [
          { value: 'memberA', score: 1 },
          { value: 'memberB', score: 2 },
        ],
      },
    });

    expect(await screen.findByText('memberA')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders stream inspector rows with truncation messaging', async () => {
    let onSearchProgress: ((event: RedisKeysSearchProgressEvent) => void) | null = null;
    let onInspectDone: ((event: RedisInspectDoneEvent) => void) | null = null;

    (window as typeof window & { api: RendererApi }).api = buildApi({
      redisKeys: {
        startSearch: async () =>
          ok({
            jobId: 'job-stream',
            startedAt: new Date().toISOString(),
          }),
        onSearchProgress: (listener) => {
          onSearchProgress = listener;
          return () => undefined;
        },
        onSearchDone: () => () => undefined,
      },
      redisInspect: {
        start: async () =>
          ok({
            jobId: 'inspect-stream',
            startedAt: new Date().toISOString(),
          }),
        onProgress: () => () => undefined,
        onDone: (listener) => {
          onInspectDone = listener;
          return () => undefined;
        },
      },
    });

    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Start search' }));
    onSearchProgress?.({
      jobId: 'job-stream',
      status: 'running',
      keys: [{ key: 'stream:key', prefixSegments: ['stream', 'key'], metadataState: 'pending' }],
      scannedCount: 1,
      emittedCount: 1,
      cursor: '0',
      capReached: false,
      elapsedMs: 10,
    });
    await user.click(await screen.findByRole('button', { name: 'Inspect' }));

    onInspectDone?.({
      jobId: 'inspect-stream',
      status: 'completed',
      result: {
        key: 'stream:key',
        type: 'stream',
        ttlSeconds: 30,
        isPartial: true,
        capReached: false,
        fetchedCount: 1,
        totalCount: 5,
        truncated: true,
        entries: [
          {
            id: '1710001-0',
            fields: [
              { field: 'event', value: 'created' },
              { field: 'id', value: '1' },
            ],
          },
        ],
      },
    });

    expect(await screen.findByText('1710001-0')).toBeInTheDocument();
    expect(screen.getByText('event')).toBeInTheDocument();
    expect(
      screen.getByText('Stream output is truncated for safety. Refine scope or export for deeper inspection.'),
    ).toBeInTheDocument();
  });

  it('fetches memcached key value and recovers after error retry', async () => {
    const memcachedGet = vi
      .fn()
      .mockImplementationOnce(async () => fail('TIMEOUT', 'Memcached request timed out.'))
      .mockImplementationOnce(async () =>
        ok({
          key: 'session:42',
          found: true,
          valuePreview: '{"ok":true}',
          flags: 7,
          bytes: 11,
          capReached: false,
        }),
      );

    (window as typeof window & { api: RendererApi }).api = buildApi({
      connections: {
        ...buildApi().connections,
        getStatus: async () =>
          ok({
            state: 'connected',
            activeProfileId: 'profile-mc',
            pendingProfileId: null,
            activeKind: 'memcached',
            environmentLabel: 'local',
            safetyMode: 'readOnly',
            safetyUpdatedAt: 'now',
            lastConnectionError: null,
            updatedAt: 'now',
          }),
      },
      memcached: {
        get: memcachedGet,
        getStats: vi.fn(async () => ok({ fetchedAt: new Date().toISOString(), stats: [] })),
      },
    });

    const user = userEvent.setup();
    render(<App />);

    await user.type(await screen.findByLabelText('Memcached key'), 'session:42');
    await user.click(screen.getByRole('button', { name: 'Fetch key' }));

    expect(await screen.findByText('Memcached request timed out.')).toBeInTheDocument();
    expect(memcachedGet).toHaveBeenCalledWith({ key: 'session:42' });

    await user.click(screen.getByRole('button', { name: 'Fetch key' }));

    expect(await screen.findByText('Value fetched.')).toBeInTheDocument();
    expect(screen.getByText('session:42')).toBeInTheDocument();
    expect(screen.getByText('{"ok":true}')).toBeInTheDocument();
    expect(memcachedGet).toHaveBeenCalledTimes(2);
  });

  it('refreshes memcached stats and stays recoverable after timeout', async () => {
    const getStats = vi
      .fn()
      .mockImplementationOnce(async () => fail('TIMEOUT', 'Memcached stats request timed out.'))
      .mockImplementationOnce(async () =>
        ok({
          fetchedAt: new Date().toISOString(),
          stats: [
            { key: 'curr_items', value: '2' },
            { key: 'uptime', value: '500' },
          ],
        }),
      );

    (window as typeof window & { api: RendererApi }).api = buildApi({
      connections: {
        ...buildApi().connections,
        getStatus: async () =>
          ok({
            state: 'connected',
            activeProfileId: 'profile-mc',
            pendingProfileId: null,
            activeKind: 'memcached',
            environmentLabel: 'local',
            safetyMode: 'readOnly',
            safetyUpdatedAt: 'now',
            lastConnectionError: null,
            updatedAt: 'now',
          }),
      },
      memcached: {
        get: vi.fn(async () =>
          ok({
            key: 'session:42',
            found: false,
            valuePreview: null,
            flags: null,
            bytes: null,
            capReached: false,
          }),
        ),
        getStats,
      },
    });

    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: 'Refresh stats' }));
    expect(await screen.findByText('Memcached stats request timed out.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Refresh stats' }));

    expect(await screen.findByText(/Stats refreshed at/i)).toBeInTheDocument();
    expect(screen.getByText('curr_items')).toBeInTheDocument();
    expect(screen.getByText('500')).toBeInTheDocument();
    expect(getStats).toHaveBeenCalledTimes(2);
  });
});
