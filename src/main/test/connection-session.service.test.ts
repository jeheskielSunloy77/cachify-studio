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

  it('blocks Redis mutations while safety mode is readOnly', async () => {
    const redisCommand = vi.fn(async () => 'OK');
    mocks.getProfileById.mockReturnValue({
      id: '88888888-8888-4888-8888-888888888888',
      kind: 'redis',
      name: 'Redis Guard',
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
      command: redisCommand,
    });

    const { connectionSessionService } = await import(
      '../domain/cache/session/connection-session.service'
    );
    const connected = await connectionSessionService.connect(
      '88888888-8888-4888-8888-888888888888',
    );
    expect(connected.ok).toBe(true);

    const stringSet = await connectionSessionService.executeRedisStringSet('guard:key', 'value');
    const hashSet = await connectionSessionService.executeRedisHashSetField(
      'guard:hash',
      'field',
      'value',
    );
    const listPush = await connectionSessionService.executeRedisListPush(
      'guard:list',
      'value',
      'right',
    );
    const setAdd = await connectionSessionService.executeRedisSetAdd('guard:set', 'member');
    const zsetAdd = await connectionSessionService.executeRedisZSetAdd(
      'guard:zset',
      1.5,
      'member',
    );
    const streamAdd = await connectionSessionService.executeRedisStreamAdd('guard:stream', [
      { field: 'event', value: 'created' },
    ]);
    const deleteResult = await connectionSessionService.executeRedisKeyDelete('guard:key');

    for (const blocked of [stringSet, hashSet, listPush, setAdd, zsetAdd, streamAdd, deleteResult]) {
      expect(blocked.ok).toBe(false);
      if ('error' in blocked) {
        expect(blocked.error.code).toBe('MUTATION_BLOCKED_READ_ONLY');
      }
    }
    expect(redisCommand).not.toHaveBeenCalled();
  });

  it('executes Redis mutation commands in unlocked mode and returns typed results', async () => {
    const redisCommand = vi
      .fn()
      .mockResolvedValueOnce('OK')
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce('1710000000000-0')
      .mockResolvedValueOnce(1);
    mocks.getProfileById.mockReturnValue({
      id: '99999999-9999-4999-8999-999999999999',
      kind: 'redis',
      name: 'Redis Mutations',
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
      command: redisCommand,
    });

    const { connectionSessionService } = await import(
      '../domain/cache/session/connection-session.service'
    );
    await connectionSessionService.connect('99999999-9999-4999-8999-999999999999');
    await connectionSessionService.unlockMutations('UNLOCK_MUTATIONS');

    const stringSet = await connectionSessionService.executeRedisStringSet('string:key', 'next');
    const hashSet = await connectionSessionService.executeRedisHashSetField('hash:key', 'fieldA', 'valueA');
    const listPush = await connectionSessionService.executeRedisListPush('list:key', 'value', 'right');
    const setAdd = await connectionSessionService.executeRedisSetAdd('set:key', 'memberA');
    const zsetAdd = await connectionSessionService.executeRedisZSetAdd('zset:key', 1.5, 'memberZ');
    const streamAdd = await connectionSessionService.executeRedisStreamAdd('stream:key', [
      { field: 'event', value: 'created' },
      { field: 'id', value: '42' },
    ]);
    const deleteResult = await connectionSessionService.executeRedisKeyDelete('delete:key');

    expect(stringSet).toEqual({
      ok: true,
      data: { key: 'string:key' },
    });
    expect(hashSet).toEqual({
      ok: true,
      data: { key: 'hash:key', field: 'fieldA', created: true },
    });
    expect(listPush).toEqual({
      ok: true,
      data: { key: 'list:key', direction: 'right', length: 3 },
    });
    expect(setAdd).toEqual({
      ok: true,
      data: { key: 'set:key', member: 'memberA', added: true },
    });
    expect(zsetAdd).toEqual({
      ok: true,
      data: { key: 'zset:key', member: 'memberZ', score: 1.5, added: true },
    });
    expect(streamAdd).toEqual({
      ok: true,
      data: { key: 'stream:key', entryId: '1710000000000-0' },
    });
    expect(deleteResult).toEqual({
      ok: true,
      data: { key: 'delete:key', deleted: true },
    });

    expect(redisCommand).toHaveBeenNthCalledWith(1, ['SET', 'string:key', 'next']);
    expect(redisCommand).toHaveBeenNthCalledWith(2, ['HSET', 'hash:key', 'fieldA', 'valueA']);
    expect(redisCommand).toHaveBeenNthCalledWith(3, ['RPUSH', 'list:key', 'value']);
    expect(redisCommand).toHaveBeenNthCalledWith(4, ['SADD', 'set:key', 'memberA']);
    expect(redisCommand).toHaveBeenNthCalledWith(5, ['ZADD', 'zset:key', '1.5', 'memberZ']);
    expect(redisCommand).toHaveBeenNthCalledWith(6, [
      'XADD',
      'stream:key',
      '*',
      'event',
      'created',
      'id',
      '42',
    ]);
    expect(redisCommand).toHaveBeenNthCalledWith(7, ['DEL', 'delete:key']);
  });

  it('maps Redis mutation wrong-type errors to deterministic envelope codes', async () => {
    mocks.getProfileById.mockReturnValue({
      id: '10101010-1010-4010-8010-101010101010',
      kind: 'redis',
      name: 'Redis Wrong Type',
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
      command: vi.fn(async () => {
        throw new Error('REDIS_ERROR:WRONGTYPE Operation against a key holding the wrong kind of value');
      }),
    });

    const { connectionSessionService } = await import(
      '../domain/cache/session/connection-session.service'
    );
    await connectionSessionService.connect('10101010-1010-4010-8010-101010101010');
    await connectionSessionService.unlockMutations('UNLOCK_MUTATIONS');
    const result = await connectionSessionService.executeRedisStringSet('typed:key', 'value');
    expect(result.ok).toBe(false);
    if ('error' in result) {
      expect(result.error.code).toBe('REDIS_WRONG_TYPE');
    }
  });

  it('blocks Memcached set while readOnly and writes once unlocked', async () => {
    const memcachedSet = vi.fn(async () => ({
      stored: true,
      flags: 7,
      ttlSeconds: 120,
      bytes: 6,
    }));
    mocks.getProfileById.mockReturnValue({
      id: '12121212-1212-4121-8121-121212121212',
      kind: 'memcached',
      name: 'Memcached Mutations',
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
      get: vi.fn(async () => ({ found: false, flags: null, bytes: null, value: null })),
      stats: vi.fn(async () => []),
      set: memcachedSet,
    });

    const { connectionSessionService } = await import(
      '../domain/cache/session/connection-session.service'
    );
    await connectionSessionService.connect('12121212-1212-4121-8121-121212121212');
    const blocked = await connectionSessionService.executeMemcachedSet('mc:key', 'value');
    expect(blocked.ok).toBe(false);
    if ('error' in blocked) {
      expect(blocked.error.code).toBe('MUTATION_BLOCKED_READ_ONLY');
    }
    expect(memcachedSet).not.toHaveBeenCalled();

    await connectionSessionService.unlockMutations('UNLOCK_MUTATIONS');
    const stored = await connectionSessionService.executeMemcachedSet('mc:key', 'value', {
      flags: 7,
      ttlSeconds: 120,
    });
    expect(stored).toEqual({
      ok: true,
      data: {
        key: 'mc:key',
        stored: true,
        flags: 7,
        ttlSeconds: 120,
        bytes: 6,
      },
    });
    expect(memcachedSet).toHaveBeenCalledWith('mc:key', 'value', {
      flags: 7,
      ttlSeconds: 120,
    });
  });
});
