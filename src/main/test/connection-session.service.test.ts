// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getDatabase: vi.fn(() => ({ __db: true })),
  getProfileById: vi.fn(),
  profileSecrets: {
    load: vi.fn(),
  },
  connectRedisClient: vi.fn(),
  connectMemcachedClient: vi.fn(),
}));

vi.mock('../domain/persistence/db/connection', () => ({
  getDatabase: mocks.getDatabase,
}));

vi.mock('../domain/persistence/repositories/connection-profiles.repository', () => ({
  getProfileById: mocks.getProfileById,
}));

vi.mock('../domain/security/secrets', () => ({
  profileSecrets: mocks.profileSecrets,
}));

vi.mock('../domain/cache/clients/redis.client', () => ({
  connectRedisClient: mocks.connectRedisClient,
}));

vi.mock('../domain/cache/clients/memcached.client', () => ({
  connectMemcachedClient: mocks.connectMemcachedClient,
}));

describe('connection session service', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('connects and disconnects a redis profile', async () => {
    mocks.getProfileById.mockReturnValue({
      id: '11111111-1111-4111-8111-111111111111',
      kind: 'redis',
      name: 'Redis',
      host: 'localhost',
      port: 6379,
      environment: 'local',
      tags: [],
      favorite: false,
      credentialPolicy: 'promptEverySession',
      redisAuth: { mode: 'none', hasPassword: false },
      redisTls: { enabled: false },
      memcachedAuth: { mode: 'none', hasPassword: false },
      createdAt: 'now',
      updatedAt: 'now',
    });
    mocks.connectRedisClient.mockResolvedValue({
      disconnect: vi.fn(async () => undefined),
    });

    const { connectionSessionService } = await import(
      '../domain/cache/session/connection-session.service'
    );
    const connected = await connectionSessionService.connect(
      '11111111-1111-4111-8111-111111111111',
    );
    expect(connected.ok).toBe(true);
    const disconnected = await connectionSessionService.disconnect();
    expect(disconnected.ok).toBe(true);
    expect(disconnected.data.state).toBe('disconnected');
  });

  it('returns prompt required when profile policy is promptEverySession and credentials are absent', async () => {
    mocks.getProfileById.mockReturnValue({
      id: '11111111-1111-4111-8111-111111111111',
      kind: 'redis',
      name: 'Redis',
      host: 'localhost',
      port: 6379,
      environment: 'local',
      tags: [],
      favorite: false,
      credentialPolicy: 'promptEverySession',
      redisAuth: { mode: 'password', hasPassword: false },
      redisTls: { enabled: false },
      memcachedAuth: { mode: 'none', hasPassword: false },
      createdAt: 'now',
      updatedAt: 'now',
    });
    const { connectionSessionService } = await import(
      '../domain/cache/session/connection-session.service'
    );
    const result = await connectionSessionService.connect(
      '11111111-1111-4111-8111-111111111111',
    );
    expect(result.ok).toBe(false);
    if ('error' in result) {
      expect(result.error.code).toBe('CREDENTIAL_PROMPT_REQUIRED');
    }
  });

  it('supports switching sessions and remains recoverable after connection failure', async () => {
    mocks.getProfileById.mockImplementation((_db: unknown, id: string) => ({
      id,
      kind: 'redis',
      name: 'Redis',
      host: 'localhost',
      port: 6379,
      environment: 'local',
      tags: [],
      favorite: false,
      credentialPolicy: 'promptEverySession',
      redisAuth: { mode: 'none', hasPassword: false },
      redisTls: { enabled: false },
      memcachedAuth: { mode: 'none', hasPassword: false },
      createdAt: 'now',
      updatedAt: 'now',
    }));
    mocks.connectRedisClient
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce({
        disconnect: vi.fn(async () => undefined),
      });

    const { connectionSessionService } = await import(
      '../domain/cache/session/connection-session.service'
    );
    const failed = await connectionSessionService.connect(
      '11111111-1111-4111-8111-111111111111',
    );
    expect(failed.ok).toBe(false);
    expect(connectionSessionService.getStatus().pendingProfileId).toBe(
      '11111111-1111-4111-8111-111111111111',
    );

    const switched = await connectionSessionService.switch(
      '22222222-2222-4222-8222-222222222222',
    );
    expect(switched.ok).toBe(true);
    if ('data' in switched) {
      expect(switched.data.state).toBe('connected');
      expect(switched.data.activeProfileId).toBe('22222222-2222-4222-8222-222222222222');
    }
  });

  it('treats connect to a different profile as a switch and disconnects previous client', async () => {
    const firstDisconnect = vi.fn(async () => undefined);
    const secondDisconnect = vi.fn(async () => undefined);
    mocks.getProfileById.mockImplementation((_db: unknown, id: string) => ({
      id,
      kind: 'redis',
      name: id,
      host: 'localhost',
      port: 6379,
      environment: 'local',
      tags: [],
      favorite: false,
      credentialPolicy: 'promptEverySession',
      redisAuth: { mode: 'none', hasPassword: false },
      redisTls: { enabled: false },
      memcachedAuth: { mode: 'none', hasPassword: false },
      createdAt: 'now',
      updatedAt: 'now',
    }));
    mocks.connectRedisClient
      .mockResolvedValueOnce({
        disconnect: firstDisconnect,
      })
      .mockResolvedValueOnce({
        disconnect: secondDisconnect,
      });

    const { connectionSessionService } = await import(
      '../domain/cache/session/connection-session.service'
    );
    const first = await connectionSessionService.connect(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    );
    expect(first.ok).toBe(true);

    const second = await connectionSessionService.connect(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    );
    expect(second.ok).toBe(true);
    expect(firstDisconnect).toHaveBeenCalledTimes(1);
    expect(secondDisconnect).toHaveBeenCalledTimes(0);
    expect(connectionSessionService.getStatus().activeProfileId).toBe(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    );
  });

  it('maps redis TLS options and reports TLS_CERT_INVALID without plaintext fallback', async () => {
    mocks.getProfileById.mockReturnValue({
      id: '33333333-3333-4333-8333-333333333333',
      kind: 'redis',
      name: 'Redis TLS',
      host: 'tls.redis.local',
      port: 6380,
      environment: 'local',
      tags: [],
      favorite: false,
      credentialPolicy: 'promptEverySession',
      redisAuth: { mode: 'none', hasPassword: false },
      redisTls: {
        enabled: true,
        servername: 'cache.example.com',
        caPath: '/tmp/ca.pem',
      },
      memcachedAuth: { mode: 'none', hasPassword: false },
      createdAt: 'now',
      updatedAt: 'now',
    });
    mocks.connectRedisClient.mockRejectedValueOnce(new Error('SELF_SIGNED_CERT_IN_CHAIN'));

    const { connectionSessionService } = await import(
      '../domain/cache/session/connection-session.service'
    );
    const result = await connectionSessionService.connect(
      '33333333-3333-4333-8333-333333333333',
    );

    expect(mocks.connectRedisClient).toHaveBeenCalledTimes(1);
    expect(mocks.connectRedisClient.mock.calls[0]?.[0]?.tls).toEqual({
      enabled: true,
      servername: 'cache.example.com',
      caPath: '/tmp/ca.pem',
    });
    expect(result.ok).toBe(false);
    if ('error' in result) {
      expect(result.error.code).toBe('TLS_CERT_INVALID');
    }
  });

  it('derives readOnly posture by default for prod profiles on connect and switch', async () => {
    mocks.getProfileById.mockImplementation((_db: unknown, id: string) => ({
      id,
      kind: 'redis',
      name: 'Prod Redis',
      host: 'prod.redis.local',
      port: 6379,
      environment: 'prod',
      tags: [],
      favorite: false,
      credentialPolicy: 'promptEverySession',
      redisAuth: { mode: 'none', hasPassword: false },
      redisTls: { enabled: false },
      memcachedAuth: { mode: 'none', hasPassword: false },
      createdAt: 'now',
      updatedAt: 'now',
    }));
    mocks.connectRedisClient.mockResolvedValue({
      disconnect: vi.fn(async () => undefined),
    });

    const { connectionSessionService } = await import(
      '../domain/cache/session/connection-session.service'
    );
    const connected = await connectionSessionService.connect(
      '44444444-4444-4444-8444-444444444444',
    );
    expect(connected.ok).toBe(true);
    if ('data' in connected) {
      expect(connected.data.environmentLabel).toBe('prod');
      expect(connected.data.safetyMode).toBe('readOnly');
    }

    const switched = await connectionSessionService.switch(
      '55555555-5555-4555-8555-555555555555',
    );
    expect(switched.ok).toBe(true);
    if ('data' in switched) {
      expect(switched.data.environmentLabel).toBe('prod');
      expect(switched.data.safetyMode).toBe('readOnly');
    }
  });

  it('supports explicit unlock/relock transitions and rejects invalid unlock confirmation', async () => {
    mocks.getProfileById.mockReturnValue({
      id: '66666666-6666-4666-8666-666666666666',
      kind: 'redis',
      name: 'Local Redis',
      host: 'localhost',
      port: 6379,
      environment: 'local',
      tags: [],
      favorite: false,
      credentialPolicy: 'promptEverySession',
      redisAuth: { mode: 'none', hasPassword: false },
      redisTls: { enabled: false },
      memcachedAuth: { mode: 'none', hasPassword: false },
      createdAt: 'now',
      updatedAt: 'now',
    });
    mocks.connectRedisClient.mockResolvedValue({
      disconnect: vi.fn(async () => undefined),
    });

    const { connectionSessionService } = await import(
      '../domain/cache/session/connection-session.service'
    );
    const connected = await connectionSessionService.connect(
      '66666666-6666-4666-8666-666666666666',
    );
    expect(connected.ok).toBe(true);

    const rejectedUnlock = await connectionSessionService.unlockMutations('WRONG_TOKEN');
    expect(rejectedUnlock.ok).toBe(false);

    const unlocked = await connectionSessionService.unlockMutations(
      'UNLOCK_MUTATIONS',
      'maintenance',
    );
    expect(unlocked.ok).toBe(true);
    if ('data' in unlocked) {
      expect(unlocked.data.safetyMode).toBe('unlocked');
    }

    const relocked = await connectionSessionService.relockMutations();
    expect(relocked.ok).toBe(true);
    if ('data' in relocked) {
      expect(relocked.data.safetyMode).toBe('readOnly');
    }
  });

  it('maps invalid memcached keys to validation errors', async () => {
    mocks.getProfileById.mockReturnValue({
      id: '77777777-7777-4777-8777-777777777777',
      kind: 'memcached',
      name: 'Memcached',
      host: 'localhost',
      port: 11211,
      environment: 'local',
      tags: [],
      favorite: false,
      credentialPolicy: 'promptEverySession',
      redisAuth: { mode: 'none', hasPassword: false },
      redisTls: { enabled: false },
      memcachedAuth: { mode: 'none', hasPassword: false },
      createdAt: 'now',
      updatedAt: 'now',
    });
    mocks.connectMemcachedClient.mockResolvedValue({
      disconnect: vi.fn(async () => undefined),
      get: vi.fn(async () => {
        throw new Error('INVALID_KEY:bad key');
      }),
      stats: vi.fn(async () => []),
    });

    const { connectionSessionService } = await import(
      '../domain/cache/session/connection-session.service'
    );
    const connected = await connectionSessionService.connect(
      '77777777-7777-4777-8777-777777777777',
    );
    expect(connected.ok).toBe(true);

    const result = await connectionSessionService.executeMemcachedGet('bad key');
    expect(result.ok).toBe(false);
    if ('error' in result) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });
});
