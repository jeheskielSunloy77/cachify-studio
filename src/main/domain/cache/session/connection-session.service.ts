import type {
  ConnectionRuntimeCredentials,
  ConnectionStatus,
} from '../../../../shared/ipc/ipc.contract';
import type { ConnectionProfile } from '../../../../shared/profiles/profile.schemas';
import { getProfileById } from '../../persistence/repositories/connection-profiles.repository';
import { getDatabase } from '../../persistence/db/connection';
import { profileSecrets } from '../../security/secrets';
import {
  connectMemcachedClient,
  type MemcachedGetResult,
  type MemcachedStatsResult,
} from '../clients/memcached.client';
import { connectRedisClient, type RedisCommandValue } from '../clients/redis.client';

type DisconnectableClient = { disconnect: () => Promise<void> };
type RedisCommandClient = DisconnectableClient & {
  command: (parts: string[]) => Promise<RedisCommandValue>;
};
type MemcachedCommandClient = DisconnectableClient & {
  get: (key: string) => Promise<MemcachedGetResult>;
  stats: () => Promise<MemcachedStatsResult>;
};
type ErrorEnvelope = { code: string; message: string; details?: unknown };
type SessionResult =
  | { ok: true; data: ConnectionStatus }
  | { ok: false; error: ErrorEnvelope };

const CONNECTION_TIMEOUT_MS = 4000;

let activeClient: DisconnectableClient | null = null;
let activeProfile: ConnectionProfile | null = null;
let status: ConnectionStatus = {
  state: 'disconnected',
  activeProfileId: null,
  pendingProfileId: null,
  activeKind: null,
  environmentLabel: null,
  safetyMode: 'readOnly',
  safetyUpdatedAt: new Date().toISOString(),
  lastConnectionError: null,
  updatedAt: new Date().toISOString(),
};

const subscribers = new Set<(value: ConnectionStatus) => void>();

const updateStatus = (patch: Partial<ConnectionStatus>) => {
  status = {
    ...status,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  subscribers.forEach((subscriber) => subscriber(status));
};

const mapConnectionError = (error: unknown): ErrorEnvelope => {
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.includes('AUTH_FAILED')) {
    return { code: 'AUTH_FAILED', message: 'Authentication failed for this profile.' };
  }
  if (
    raw.includes('ERR_TLS') ||
    raw.includes('CERT_') ||
    raw.includes('SELF_SIGNED_CERT') ||
    raw.includes('Hostname/IP does not match certificate')
  ) {
    return {
      code: 'TLS_CERT_INVALID',
      message: 'TLS validation failed. Verify certificate chain, CA path, and servername.',
    };
  }
  if (raw.includes('TIMEOUT')) {
    return { code: 'TIMEOUT', message: 'Connection attempt timed out.' };
  }
  if (raw.includes('ECONNREFUSED')) {
    return { code: 'CONNECTION_REFUSED', message: 'Connection was refused by the target host.' };
  }
  return { code: 'CONNECTION_REFUSED', message: 'Connection failed. Verify host, port, and credentials.' };
};

const resolveRuntimeSecret = (
  profile: ConnectionProfile,
  runtimeCredentials?: ConnectionRuntimeCredentials,
) => {
  const needsRedisAuth = profile.kind === 'redis' && profile.redisAuth.mode === 'password';
  const needsMemcachedAuth =
    profile.kind === 'memcached' && profile.memcachedAuth.mode === 'sasl';
  const needsAuth = needsRedisAuth || needsMemcachedAuth;

  if (!needsAuth) {
    return { ok: true as const, data: null };
  }

  if (profile.credentialPolicy === 'promptEverySession') {
    if (!runtimeCredentials?.password) {
      return {
        ok: false as const,
        error: {
          code: 'CREDENTIAL_PROMPT_REQUIRED',
          message: 'Credentials must be provided at connect time for this profile.',
        },
      };
    }
    return { ok: true as const, data: runtimeCredentials };
  }

  if (runtimeCredentials?.password) {
    return { ok: true as const, data: runtimeCredentials };
  }

  const loaded = profileSecrets.load({
    profileId: profile.id,
    type: profile.kind,
  });
  if ('error' in loaded) {
    if (loaded.error.code === 'CREDENTIAL_NOT_FOUND') {
      return {
        ok: false as const,
        error: {
          code: 'CREDENTIAL_PROMPT_REQUIRED',
          message: 'Stored credentials were not found. Provide credentials for this session.',
        },
      };
    }
    return {
      ok: false as const,
      error: {
        code: 'AUTH_FAILED',
        message: 'Stored credentials are unavailable. Update profile credentials and retry.',
      },
    };
  }
  return { ok: true as const, data: loaded.data.secret };
};

const connectWithProfile = async (
  profile: ConnectionProfile,
  runtimeCredentials?: ConnectionRuntimeCredentials,
) => {
  const secretResolution = resolveRuntimeSecret(profile, runtimeCredentials);
  if (!secretResolution.ok) {
    return { ok: false as const, error: secretResolution.error };
  }

  const secret = secretResolution.data;
  if (profile.kind === 'redis') {
    activeClient = await connectRedisClient({
      host: profile.host,
      port: profile.port,
      timeoutMs: CONNECTION_TIMEOUT_MS,
      username: secret?.username ?? profile.redisAuth.username,
      password: secret?.password,
      tls: profile.redisTls,
    });
  } else {
    activeClient = await connectMemcachedClient({
      host: profile.host,
      port: profile.port,
      timeoutMs: CONNECTION_TIMEOUT_MS,
      authMode: profile.memcachedAuth.mode,
      username: secret?.username ?? profile.memcachedAuth.username,
      password: secret?.password,
    });
  }
  return { ok: true as const };
};

const loadProfile = (profileId: string) => getProfileById(getDatabase(), profileId);

export const connectionSessionService = {
  subscribe: (listener: (value: ConnectionStatus) => void) => {
    subscribers.add(listener);
    return () => subscribers.delete(listener);
  },
  getStatus: () => status,
  getActiveProfile: () => activeProfile,
  executeRedisCommand: async (
    parts: string[],
  ): Promise<{ ok: true; data: RedisCommandValue } | { ok: false; error: ErrorEnvelope }> => {
    if (status.state !== 'connected' || !activeClient) {
      return {
        ok: false,
        error: {
          code: 'NOT_CONNECTED',
          message: 'Connect to Redis before running key discovery.',
        },
      };
    }
    if (status.activeKind !== 'redis') {
      return {
        ok: false,
        error: {
          code: 'WRONG_CONNECTION_KIND',
          message: 'Active connection is not Redis.',
        },
      };
    }
    if (!('command' in activeClient) || typeof activeClient.command !== 'function') {
      return {
        ok: false,
        error: {
          code: 'REDIS_COMMAND_UNAVAILABLE',
          message: 'Active Redis client does not support command execution.',
        },
      };
    }

    try {
      const data = await (activeClient as RedisCommandClient).command(parts);
      return { ok: true, data };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('TIMEOUT')) {
        return {
          ok: false,
          error: { code: 'TIMEOUT', message: 'Redis command timed out.' },
        };
      }
      if (message.includes('REDIS_ERROR')) {
        return {
          ok: false,
          error: {
            code: 'REDIS_COMMAND_FAILED',
            message: message.replace(/^REDIS_ERROR:/, ''),
          },
        };
      }
      return {
        ok: false,
        error: {
          code: 'REDIS_COMMAND_FAILED',
          message: 'Redis command failed. Verify connectivity and retry.',
        },
      };
    }
  },
  executeMemcachedGet: async (
    key: string,
  ): Promise<{ ok: true; data: MemcachedGetResult } | { ok: false; error: ErrorEnvelope }> => {
    if (status.state !== 'connected' || !activeClient) {
      return {
        ok: false,
        error: {
          code: 'NOT_CONNECTED',
          message: 'Connect to Memcached before fetching keys.',
        },
      };
    }
    if (status.activeKind !== 'memcached') {
      return {
        ok: false,
        error: {
          code: 'WRONG_CONNECTION_KIND',
          message: 'Active connection is not Memcached.',
        },
      };
    }
    if (!('get' in activeClient) || typeof activeClient.get !== 'function') {
      return {
        ok: false,
        error: {
          code: 'MEMCACHED_COMMAND_UNAVAILABLE',
          message: 'Active Memcached client does not support get operation.',
        },
      };
    }

    try {
      const data = await (activeClient as MemcachedCommandClient).get(key);
      return { ok: true, data };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('TIMEOUT')) {
        return {
          ok: false,
          error: { code: 'TIMEOUT', message: 'Memcached request timed out.' },
        };
      }
      if (message.includes('INVALID_KEY')) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Memcached key must not contain whitespace or control characters.',
          },
        };
      }
      if (message.includes('PROTOCOL_ERROR')) {
        return {
          ok: false,
          error: { code: 'MEMCACHED_PROTOCOL_ERROR', message: 'Memcached returned an invalid response.' },
        };
      }
      return {
        ok: false,
        error: {
          code: 'MEMCACHED_GET_FAILED',
          message: 'Memcached get failed. Verify key and connectivity.',
        },
      };
    }
  },
  executeMemcachedStats: async (): Promise<
    { ok: true; data: MemcachedStatsResult } | { ok: false; error: ErrorEnvelope }
  > => {
    if (status.state !== 'connected' || !activeClient) {
      return {
        ok: false,
        error: {
          code: 'NOT_CONNECTED',
          message: 'Connect to Memcached before requesting stats.',
        },
      };
    }
    if (status.activeKind !== 'memcached') {
      return {
        ok: false,
        error: {
          code: 'WRONG_CONNECTION_KIND',
          message: 'Active connection is not Memcached.',
        },
      };
    }
    if (!('stats' in activeClient) || typeof activeClient.stats !== 'function') {
      return {
        ok: false,
        error: {
          code: 'MEMCACHED_COMMAND_UNAVAILABLE',
          message: 'Active Memcached client does not support stats operation.',
        },
      };
    }

    try {
      const data = await (activeClient as MemcachedCommandClient).stats();
      return { ok: true, data };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('TIMEOUT')) {
        return {
          ok: false,
          error: { code: 'TIMEOUT', message: 'Memcached stats request timed out.' },
        };
      }
      if (message.includes('PROTOCOL_ERROR')) {
        return {
          ok: false,
          error: { code: 'MEMCACHED_PROTOCOL_ERROR', message: 'Memcached returned invalid stats data.' },
        };
      }
      return {
        ok: false,
        error: {
          code: 'MEMCACHED_STATS_FAILED',
          message: 'Failed to load Memcached stats. Retry or reconnect.',
        },
      };
    }
  },
  connect: async (
    profileId: string,
    runtimeCredentials?: ConnectionRuntimeCredentials,
  ): Promise<SessionResult> => {
    const profile = loadProfile(profileId);
    if (!profile) {
      return {
        ok: false as const,
        error: { code: 'NOT_FOUND', message: 'Profile not found.' },
      };
    }
    if (status.state === 'connected' && status.activeProfileId === profileId) {
      return { ok: true as const, data: status };
    }
    if (status.state === 'connected' && status.activeProfileId && status.activeProfileId !== profileId) {
      return connectionSessionService.switch(profileId, runtimeCredentials);
    }

    updateStatus({
      state: 'connecting',
      pendingProfileId: profileId,
      lastConnectionError: null,
    });

    try {
      const connected = await connectWithProfile(profile, runtimeCredentials);
      if (!connected.ok) {
        updateStatus({
          state: 'error',
          pendingProfileId: profileId,
          lastConnectionError: connected.error,
        });
        return { ok: false as const, error: connected.error };
      }
      updateStatus({
        state: 'connected',
        activeProfileId: profile.id,
        pendingProfileId: null,
        activeKind: profile.kind,
        environmentLabel: profile.environment,
        safetyMode: 'readOnly',
        safetyUpdatedAt: new Date().toISOString(),
        ...(profile.environment === 'prod'
          ? { safetyReason: 'Production profiles default to read-only mode.' }
          : { safetyReason: 'Connections start in read-only mode by default.' }),
        lastConnectionError: null,
      });
      activeProfile = profile;
      return { ok: true as const, data: status };
    } catch (error) {
      const mapped = mapConnectionError(error);
      updateStatus({
        state: 'error',
        pendingProfileId: profileId,
        lastConnectionError: mapped,
      });
      return { ok: false as const, error: mapped };
    }
  },
  disconnect: async () => {
    if (!activeClient && status.state === 'disconnected') {
      return { ok: true as const, data: status };
    }
    updateStatus({
      state: 'disconnecting',
      pendingProfileId: null,
    });
    try {
      if (activeClient) {
        await activeClient.disconnect();
      }
    } finally {
      activeClient = null;
      activeProfile = null;
      updateStatus({
        state: 'disconnected',
        activeProfileId: null,
        activeKind: null,
        environmentLabel: null,
        safetyMode: 'readOnly',
        safetyUpdatedAt: new Date().toISOString(),
        safetyReason: 'Connection ended. Mode reset to read-only.',
        pendingProfileId: null,
      });
    }
    return { ok: true as const, data: status };
  },
  switch: async (
    profileId: string,
    runtimeCredentials?: ConnectionRuntimeCredentials,
  ): Promise<SessionResult> => {
    if (status.activeProfileId === profileId && status.state === 'connected') {
      return { ok: true as const, data: status };
    }

    updateStatus({
      state: 'switching',
      pendingProfileId: profileId,
    });
    await connectionSessionService.disconnect();
    return connectionSessionService.connect(profileId, runtimeCredentials);
  },
  unlockMutations: async (confirmation: string, reason?: string) => {
    if (confirmation !== 'UNLOCK_MUTATIONS') {
      return {
        ok: false as const,
        error: { code: 'CONFIRMATION_REQUIRED', message: 'Explicit unlock confirmation is required.' },
      };
    }
    if (status.state !== 'connected') {
      return {
        ok: false as const,
        error: { code: 'NOT_CONNECTED', message: 'Connect before unlocking mutations.' },
      };
    }
    updateStatus({
      safetyMode: 'unlocked',
      safetyUpdatedAt: new Date().toISOString(),
      ...(reason ? { safetyReason: reason } : { safetyReason: 'Mutations explicitly unlocked.' }),
    });
    return { ok: true as const, data: status };
  },
  relockMutations: async () => {
    if (status.safetyMode === 'readOnly') {
      return { ok: true as const, data: status };
    }
    updateStatus({
      safetyMode: 'readOnly',
      safetyUpdatedAt: new Date().toISOString(),
      safetyReason: 'Mutations relocked by user.',
    });
    return { ok: true as const, data: status };
  },
};
