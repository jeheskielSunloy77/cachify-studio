import type { MemcachedGetResult, MemcachedStatsResult } from '../clients/memcached.client';
import {
  buildRedactionMetadata,
  redactPreviewText,
  type RedactionMetadata,
} from '../../security/redaction';

const DEFAULT_MAX_PREVIEW_BYTES = 1_048_576;

type MemcachedPreviewResult = {
  key: string;
  found: boolean;
  valuePreview: string | null;
  flags: number | null;
  bytes: number | null;
  capReached: boolean;
  capReason?: string;
  previewBytes: number;
  maxDepthApplied: number | null;
  redaction: RedactionMetadata;
};

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
): MemcachedPreviewResult => {
  if (!result.found) {
    return {
      key,
      found: false,
      valuePreview: null,
      flags: null,
      bytes: null,
      capReached: false,
      previewBytes: 0,
      maxDepthApplied: null,
      redaction: buildRedactionMetadata(0),
    };
  }

  const truncated = truncateUtf8ByBytes(result.value, maxPreviewBytes);
  const redactedPreview = redactPreviewText(truncated.value);
  const previewBytes = Buffer.byteLength(redactedPreview.value, 'utf8');
  return {
    key,
    found: true,
    valuePreview: redactedPreview.value,
    flags: result.flags,
    bytes: result.bytes ?? truncated.bytes,
    capReached: truncated.capReached,
    previewBytes,
    maxDepthApplied: null,
    redaction: redactedPreview.metadata,
    ...(truncated.capReached ? { capReason: 'MEMCACHED_PREVIEW_LIMIT' } : {}),
  };
};

export const normalizeMemcachedStatsResult = (stats: MemcachedStatsResult) => ({
  fetchedAt: new Date().toISOString(),
  stats: stats
    .slice()
    .sort((left, right) => left.key.localeCompare(right.key)),
});
