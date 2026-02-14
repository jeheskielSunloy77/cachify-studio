import type { RecentRedisKey } from '../../../../shared/explorer/recent-keys.schemas';

const MAX_RECENT_KEYS_PER_CONNECTION = 50;
// Runtime recents intentionally persist metadata only; fetched values remain transient in memory.
const recentKeysByConnection = new Map<string, RecentRedisKey[]>();

const trimHistory = (entries: RecentRedisKey[]) => entries.slice(0, MAX_RECENT_KEYS_PER_CONNECTION);

const upsertRecentKey = (connectionProfileId: string, recentKey: RecentRedisKey) => {
  const current = recentKeysByConnection.get(connectionProfileId) ?? [];
  const withoutCurrent = current.filter((entry) => entry.key !== recentKey.key);
  const next = trimHistory([recentKey, ...withoutCurrent]);
  recentKeysByConnection.set(connectionProfileId, next);
  return recentKey;
};

export const recentKeysSessionService = {
  list: (connectionProfileId: string) => {
    const entries = recentKeysByConnection.get(connectionProfileId) ?? [];
    return entries.map((entry) => ({ ...entry }));
  },
  record: (
    connectionProfileId: string,
    payload: {
      key: string;
      type?: RecentRedisKey['type'];
      ttlSeconds?: number | null;
      inspectedAt?: string;
    },
  ) => {
    return upsertRecentKey(connectionProfileId, {
      key: payload.key,
      ...(payload.type ? { type: payload.type } : {}),
      ...(payload.ttlSeconds !== undefined ? { ttlSeconds: payload.ttlSeconds } : {}),
      inspectedAt: payload.inspectedAt ?? new Date().toISOString(),
    });
  },
  reopen: (connectionProfileId: string, key: string) => {
    const entries = recentKeysByConnection.get(connectionProfileId) ?? [];
    const current = entries.find((entry) => entry.key === key);
    if (!current) {
      return null;
    }
    return upsertRecentKey(connectionProfileId, {
      ...current,
      inspectedAt: new Date().toISOString(),
    });
  },
  reset: () => {
    recentKeysByConnection.clear();
  },
};
