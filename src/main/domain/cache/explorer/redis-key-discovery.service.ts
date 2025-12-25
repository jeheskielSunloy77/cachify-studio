import type {
  RedisKeyDiscoveryItem,
  RedisKeysSearchDoneEvent,
  RedisKeysSearchProgressEvent,
  RedisKeysSearchStartRequest,
} from '../../../../shared/ipc/ipc.contract';
import type { RedisCommandValue } from '../clients/redis.client';

const DEFAULT_COUNT_HINT = 250;
const DEFAULT_MAX_KEYS = 5000;
const DEFAULT_MAX_DURATION_MS = 15000;
const DEFAULT_METADATA_CONCURRENCY = 4;

type ExecutorResult =
  | { ok: true; data: RedisCommandValue }
  | { ok: false; error: { code: string; message: string } };

type JobResultStatus = RedisKeysSearchDoneEvent['status'];

type RunRedisKeyDiscoveryJobOptions = {
  jobId: string;
  request: RedisKeysSearchStartRequest;
  executeRedisCommand: (parts: string[]) => Promise<ExecutorResult>;
  isCancelled: () => boolean;
  onProgress: (event: RedisKeysSearchProgressEvent) => void;
  onDone: (event: RedisKeysSearchDoneEvent) => void;
  now?: () => number;
};

const isPatternLike = (value: string) => /[*?[\]]/.test(value);

const trimToOptional = (value: string | undefined) => {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
};

const toPrefixSegments = (key: string) =>
  key
    .split(':')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

export const buildScanMatchPattern = (
  query: string | undefined,
  prefix: string | undefined,
) => {
  const normalizedQuery = trimToOptional(query);
  const normalizedPrefix = trimToOptional(prefix);
  if (!normalizedQuery && !normalizedPrefix) {
    return '*';
  }
  if (normalizedPrefix && !normalizedQuery) {
    return normalizedPrefix.endsWith('*') ? normalizedPrefix : `${normalizedPrefix}*`;
  }
  if (normalizedQuery && !normalizedPrefix) {
    return isPatternLike(normalizedQuery) ? normalizedQuery : `*${normalizedQuery}*`;
  }

  const prefixWithoutWildcard = (normalizedPrefix ?? '').replace(/\*+$/, '');
  const queryPattern = isPatternLike(normalizedQuery ?? '')
    ? normalizedQuery
    : `*${normalizedQuery}*`;
  return `${prefixWithoutWildcard}${queryPattern}`;
};

const parseScanResponse = (value: RedisCommandValue) => {
  if (!Array.isArray(value) || value.length < 2) {
    throw new Error('INVALID_SCAN_RESPONSE');
  }

  const cursor = value[0];
  const keys = value[1];
  if (typeof cursor !== 'string' || !Array.isArray(keys)) {
    throw new Error('INVALID_SCAN_RESPONSE');
  }

  const normalizedKeys = keys.filter((entry): entry is string => typeof entry === 'string');
  return {
    cursor,
    keys: normalizedKeys,
  };
};

const buildContinuation = (
  status: JobResultStatus,
  cursor: string,
  capReached: boolean,
): RedisKeysSearchDoneEvent['continuation'] => {
  if (status === 'cancelled') {
    return {
      nextCursor: cursor,
      message: 'Search cancelled by user. Resume later or narrow prefix.',
      suggestedAction: 'resume-later',
    };
  }
  if (status === 'limit-reached') {
    return {
      nextCursor: cursor,
      message: capReached
        ? 'Result cap reached. Refine query or prefix and rerun.'
        : 'Time budget reached. Narrow the search and retry.',
      suggestedAction: capReached ? 'refine-search' : 'narrow-prefix',
    };
  }
  return undefined;
};

const normalizeDiscoveredItems = (keys: string[]): RedisKeyDiscoveryItem[] =>
  keys
    .slice()
    .sort((left, right) => left.localeCompare(right))
    .map((key) => ({
      key,
      prefixSegments: toPrefixSegments(key),
      metadataState: 'pending',
    }));

const normalizeRedisType = (value: RedisCommandValue): RedisKeyDiscoveryItem['type'] => {
  if (typeof value !== 'string') {
    return 'unknown';
  }
  if (
    value === 'string' ||
    value === 'hash' ||
    value === 'list' ||
    value === 'set' ||
    value === 'zset' ||
    value === 'stream' ||
    value === 'none'
  ) {
    return value;
  }
  return 'unknown';
};

const runWithConcurrency = async <TItem, TResult>(
  items: TItem[],
  concurrency: number,
  worker: (item: TItem) => Promise<TResult>,
) => {
  if (items.length === 0) {
    return [] as TResult[];
  }
  const cappedConcurrency = Math.max(1, Math.min(concurrency, items.length));
  const results = new Array<TResult>(items.length);
  let index = 0;
  await Promise.all(
    Array.from({ length: cappedConcurrency }, async () => {
      while (index < items.length) {
        const current = index;
        index += 1;
        if (current >= items.length) {
          return;
        }
        results[current] = await worker(items[current]);
      }
    }),
  );
  return results;
};

export const runRedisKeyDiscoveryJob = async ({
  jobId,
  request,
  executeRedisCommand,
  isCancelled,
  onProgress,
  onDone,
  now = () => Date.now(),
}: RunRedisKeyDiscoveryJobOptions) => {
  const countHint = request.countHint ?? DEFAULT_COUNT_HINT;
  const maxKeys = request.maxKeys ?? DEFAULT_MAX_KEYS;
  const maxDurationMs = request.maxDurationMs ?? DEFAULT_MAX_DURATION_MS;
  const includeMetadata = request.includeMetadata ?? true;
  const matchPattern = buildScanMatchPattern(request.query, request.prefix);

  const seenKeys = new Set<string>();
  const metadataTasks: Array<Promise<void>> = [];
  let scannedCount = 0;
  let emittedCount = 0;
  let cursor = '0';
  let capReached = false;
  let status: JobResultStatus = 'completed';
  const startedAt = now();
  let errorPayload: RedisKeysSearchDoneEvent['error'];
  let firstIteration = true;

  try {
    do {
      if (isCancelled()) {
        status = 'cancelled';
        break;
      }

      const elapsed = now() - startedAt;
      if (elapsed >= maxDurationMs) {
        status = 'limit-reached';
        break;
      }

      const response = await executeRedisCommand([
        'SCAN',
        cursor,
        'MATCH',
        matchPattern,
        'COUNT',
        String(countHint),
      ]);

      if ('error' in response) {
        status = 'error';
        errorPayload = {
          code: response.error.code,
          message: response.error.message,
        };
        break;
      }

      const scan = parseScanResponse(response.data);
      cursor = scan.cursor;
      scannedCount += scan.keys.length;

      const newKeys = scan.keys.filter((key) => {
        if (seenKeys.has(key)) {
          return false;
        }
        seenKeys.add(key);
        return true;
      });
      const remaining = Math.max(0, maxKeys - emittedCount);
      const boundedKeys = newKeys.slice(0, remaining);
      if (newKeys.length > boundedKeys.length) {
        capReached = true;
      }

      const discovered = normalizeDiscoveredItems(boundedKeys);
      emittedCount += discovered.length;

      if (discovered.length > 0 || firstIteration) {
        onProgress({
          jobId,
          status: 'running',
          keys: discovered,
          scannedCount,
          emittedCount,
          cursor,
          capReached,
          elapsedMs: now() - startedAt,
        });
      }

      if (includeMetadata && discovered.length > 0) {
        const lookupTask = runWithConcurrency(
          discovered.map((item) => item.key),
          DEFAULT_METADATA_CONCURRENCY,
          async (key): Promise<RedisKeyDiscoveryItem> => {
            const [typeResponse, ttlResponse] = await Promise.all([
              executeRedisCommand(['TYPE', key]),
              executeRedisCommand(['TTL', key]),
            ]);

            const type = 'error' in typeResponse ? 'unknown' : normalizeRedisType(typeResponse.data);
            const ttlSeconds =
              'error' in ttlResponse || typeof ttlResponse.data !== 'number'
                ? null
                : ttlResponse.data;
            const metadataState =
              'error' in typeResponse || 'error' in ttlResponse ? 'unavailable' : 'ready';

            return {
              key,
              prefixSegments: toPrefixSegments(key),
              type,
              ttlSeconds,
              metadataState,
            };
          },
        )
          .then((metadataUpdates) => {
            if (isCancelled()) {
              return;
            }
            onProgress({
              jobId,
              status: 'running',
              keys: metadataUpdates
                .slice()
                .sort((left, right) => left.key.localeCompare(right.key)),
              scannedCount,
              emittedCount,
              cursor,
              capReached,
              elapsedMs: now() - startedAt,
            });
          })
          .catch(() => {
            if (isCancelled()) {
              return;
            }
            const fallbackUpdates: RedisKeyDiscoveryItem[] = discovered.map((item) => ({
              key: item.key,
              prefixSegments: item.prefixSegments,
              type: 'unknown' as const,
              ttlSeconds: null as number | null,
              metadataState: 'unavailable' as const,
            }));
            onProgress({
              jobId,
              status: 'running',
              keys: fallbackUpdates,
              scannedCount,
              emittedCount,
              cursor,
              capReached,
              elapsedMs: now() - startedAt,
            });
          });
        metadataTasks.push(lookupTask);
      }

      if (emittedCount >= maxKeys || capReached) {
        status = 'limit-reached';
        capReached = true;
        break;
      }

      firstIteration = false;
    } while (cursor !== '0');
  } catch (error) {
    status = 'error';
    errorPayload = {
      code: 'REDIS_DISCOVERY_FAILED',
      message: error instanceof Error ? error.message : 'Redis discovery failed.',
    };
  }

  if (status === 'completed' && cursor !== '0') {
    status = 'limit-reached';
  }

  if (!isCancelled() && metadataTasks.length > 0) {
    await Promise.all(metadataTasks);
  }

  onDone({
    jobId,
    status,
    scannedCount,
    emittedCount,
    capReached,
    elapsedMs: now() - startedAt,
    continuation: buildContinuation(status, cursor, capReached),
    ...(errorPayload ? { error: errorPayload } : {}),
  });
};
