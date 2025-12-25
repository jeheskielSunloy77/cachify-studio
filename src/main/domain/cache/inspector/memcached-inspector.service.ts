import type { MemcachedGetResult, MemcachedStatsResult } from '../clients/memcached.client';

const DEFAULT_MAX_PREVIEW_BYTES = 1_048_576;

const truncateUtf8ByBytes = (value: string, maxBytes: number) => {
  const bytes = Buffer.byteLength(value, 'utf8');
  if (bytes <= maxBytes) {
    return { value, bytes, capReached: false };
  }
  let index = value.length;
  let truncated = value;
  while (index > 0 && Buffer.byteLength(truncated, 'utf8') > maxBytes) {
    index -= 1;
    truncated = value.slice(0, index);
  }
  return {
    value: truncated,
    bytes,
    capReached: true,
  };
};

export const normalizeMemcachedGetResult = (
  key: string,
  result: MemcachedGetResult,
  maxPreviewBytes = DEFAULT_MAX_PREVIEW_BYTES,
) => {
  if (!result.found) {
    return {
      key,
      found: false,
      valuePreview: null,
      flags: null,
      bytes: null,
      capReached: false,
    };
  }

  const truncated = truncateUtf8ByBytes(result.value, maxPreviewBytes);
  return {
    key,
    found: true,
    valuePreview: truncated.value,
    flags: result.flags,
    bytes: result.bytes ?? truncated.bytes,
    capReached: truncated.capReached,
    ...(truncated.capReached ? { capReason: 'MEMCACHED_PREVIEW_LIMIT' } : {}),
  };
};

export const normalizeMemcachedStatsResult = (stats: MemcachedStatsResult) => ({
  fetchedAt: new Date().toISOString(),
  stats: stats
    .slice()
    .sort((left, right) => left.key.localeCompare(right.key)),
});

