import type {
  RedisCollectionItem,
  RedisHashFieldEntry,
  RedisInspectDoneEvent,
  RedisInspectProgressEvent,
  RedisInspectStartRequest,
  RedisInspectorHashResult,
  RedisInspectorListResult,
	RedisInspectorResult,
	RedisInspectorSetResult,
	RedisInspectorStreamResult,
	RedisInspectorZSetResult,
	RedisStreamEntry,
	RedisStreamField,
} from '../../../../shared/ipc/ipc.contract';
import type { RedisCommandValue } from '../clients/redis.client';

const DEFAULT_MAX_PREVIEW_BYTES = 1_048_576;
const DEFAULT_HASH_CHUNK_SIZE = 200;
const DEFAULT_COLLECTION_CHUNK_SIZE = 200;
const DEFAULT_STREAM_COUNT = 200;
const DEFAULT_HASH_MAX_ENTRIES = 2000;

type ExecutorResult =
  | { ok: true; data: RedisCommandValue }
  | { ok: false; error: { code: string; message: string } };

type RunRedisInspectJobOptions = {
  jobId: string;
  request: RedisInspectStartRequest;
  executeRedisCommand: (parts: string[]) => Promise<ExecutorResult>;
  isCancelled: () => boolean;
  onProgress: (event: RedisInspectProgressEvent) => void;
  onDone: (event: RedisInspectDoneEvent) => void;
};

type CollectionType = 'list' | 'set' | 'zset';

const truncateUtf8ByBytes = (value: string, maxBytes: number) => {
  const bytes = Buffer.byteLength(value, 'utf8');
  if (bytes <= maxBytes) {
    return { value, byteLength: bytes, truncated: false };
  }
  let index = value.length;
  let truncated = value;
  while (index > 0 && Buffer.byteLength(truncated, 'utf8') > maxBytes) {
    index -= 1;
    truncated = value.slice(0, index);
  }
  return {
    value: truncated,
    byteLength: bytes,
    truncated: true,
  };
};

const asNumber = (value: RedisCommandValue) => (typeof value === 'number' ? value : null);

const asString = (value: RedisCommandValue) => (typeof value === 'string' ? value : null);

const parseFlatStringArray = (value: RedisCommandValue, code: string) => {
  if (!Array.isArray(value)) {
    throw new Error(code);
  }
  return value.filter((entry): entry is string => typeof entry === 'string');
};

const parseCursorScanResponse = (value: RedisCommandValue, code: string) => {
  if (!Array.isArray(value) || value.length < 2) {
    throw new Error(code);
  }
  const cursor = value[0];
  const payload = value[1];
  if (typeof cursor !== 'string' || !Array.isArray(payload)) {
    throw new Error(code);
  }
  const values = payload.filter((entry): entry is string => typeof entry === 'string');
  return {
    cursor,
    values,
  };
};

const parseHashEntriesFromScan = (values: string[]): RedisHashFieldEntry[] => {
  const entries: RedisHashFieldEntry[] = [];
  for (let index = 0; index < values.length; index += 2) {
    const field = values[index];
    const fieldValue = values[index + 1];
    if (typeof field !== 'string' || typeof fieldValue !== 'string') {
      continue;
    }
    entries.push({
      field,
      value: fieldValue,
    });
  }
  return entries;
};

const parseZsetItemsFromScan = (values: string[]): RedisCollectionItem[] => {
  const items: RedisCollectionItem[] = [];
  for (let index = 0; index < values.length; index += 2) {
    const member = values[index];
    const scoreRaw = values[index + 1];
    if (typeof member !== 'string' || typeof scoreRaw !== 'string') {
      continue;
    }
    const score = Number.parseFloat(scoreRaw);
    items.push({
      value: member,
      ...(Number.isFinite(score) ? { score } : {}),
    });
  }
	return items;
};

const parseStreamEntries = (value: RedisCommandValue) => {
	if (!Array.isArray(value)) {
		throw new Error('INVALID_XREVRANGE_RESPONSE');
	}

	const entries: RedisStreamEntry[] = [];
	for (const rawEntry of value) {
		if (!Array.isArray(rawEntry) || rawEntry.length < 2) {
			continue;
		}
		const id = rawEntry[0];
		const rawFields = rawEntry[1];
		if (typeof id !== 'string' || !Array.isArray(rawFields)) {
			continue;
		}
		const normalized = rawFields.filter((item): item is string => typeof item === 'string');
		const fields: RedisStreamField[] = [];
		for (let index = 0; index < normalized.length; index += 2) {
			const field = normalized[index];
			const fieldValue = normalized[index + 1];
			if (typeof field !== 'string' || typeof fieldValue !== 'string') {
				continue;
			}
			fields.push({
				field,
				value: fieldValue,
			});
		}
		entries.push({
			id,
			fields,
		});
	}
	return entries;
};

const mapInspectorType = (value: string) => {
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
  return 'unsupported';
};

const buildHashResult = (
  key: string,
  ttlSeconds: number | null,
  entries: RedisHashFieldEntry[],
  fetchedCount: number,
  totalFields: number | null,
  nextCursor: string,
  hasMore: boolean,
  capReason?: string,
): RedisInspectorHashResult => ({
  key,
  type: 'hash',
  ttlSeconds,
  isPartial: hasMore || Boolean(capReason),
  capReached: Boolean(capReason),
  ...(capReason ? { capReason } : {}),
  fetchedCount,
  totalFields,
  nextCursor,
  hasMore,
  entries,
});

const buildCollectionResult = (
	key: string,
	type: CollectionType,
  ttlSeconds: number | null,
  items: RedisCollectionItem[],
  fetchedCount: number,
  totalCount: number | null,
  cursor: string,
	hasMore: boolean,
	capReason?: string,
): RedisInspectorListResult | RedisInspectorSetResult | RedisInspectorZSetResult => {
  const sortedItems =
    type === 'list'
      ? items
      : items
          .slice()
          .sort((left, right) => left.value.localeCompare(right.value));
  if (type === 'list') {
    return {
      key,
      type: 'list',
      ttlSeconds,
      isPartial: hasMore || Boolean(capReason),
      capReached: Boolean(capReason),
      ...(capReason ? { capReason } : {}),
      fetchedCount,
      totalCount,
      cursor,
      hasMore,
      ordering: 'server',
      items: sortedItems,
    };
  }
  if (type === 'set') {
    return {
      key,
      type: 'set',
      ttlSeconds,
      isPartial: hasMore || Boolean(capReason),
      capReached: Boolean(capReason),
      ...(capReason ? { capReason } : {}),
      fetchedCount,
      totalCount,
      cursor,
      hasMore,
      ordering: 'lexical',
      items: sortedItems,
    };
  }
  return {
    key,
    type: 'zset',
    ttlSeconds,
    isPartial: hasMore || Boolean(capReason),
    capReached: Boolean(capReason),
    ...(capReason ? { capReason } : {}),
    fetchedCount,
    totalCount,
    cursor,
    hasMore,
    ordering: 'lexical',
    items: sortedItems,
  };
};

const emitError = (
  jobId: string,
  onDone: (event: RedisInspectDoneEvent) => void,
  code: string,
  message: string,
) => {
  onDone({
    jobId,
    status: 'error',
    error: {
      code,
      message,
    },
  });
};

export const runRedisInspectJob = async ({
  jobId,
  request,
  executeRedisCommand,
  isCancelled,
  onProgress,
  onDone,
}: RunRedisInspectJobOptions) => {
  const maxBytes = request.maxBytes ?? DEFAULT_MAX_PREVIEW_BYTES;
  const hashChunkSize = request.hashChunkSize ?? DEFAULT_HASH_CHUNK_SIZE;
	const collectionChunkSize = request.collectionChunkSize ?? DEFAULT_COLLECTION_CHUNK_SIZE;
	const streamCount = request.streamCount ?? DEFAULT_STREAM_COUNT;
	const maxEntries = request.maxEntries ?? DEFAULT_HASH_MAX_ENTRIES;

  const typeResponse = await executeRedisCommand(['TYPE', request.key]);
  if ('error' in typeResponse) {
    emitError(jobId, onDone, typeResponse.error.code, typeResponse.error.message);
    return;
  }

  const ttlResponse = await executeRedisCommand(['TTL', request.key]);
  const ttlSeconds = 'error' in ttlResponse ? null : asNumber(ttlResponse.data);
  const inspectedType = mapInspectorType(asString(typeResponse.data) ?? 'unsupported');

  if (inspectedType === 'none') {
    const result: RedisInspectorResult = {
      key: request.key,
      type: 'none',
      ttlSeconds,
      isPartial: false,
      capReached: false,
      fetchedCount: 0,
      reason: 'Key does not exist.',
    };
    onDone({
      jobId,
      status: 'completed',
      result,
    });
    return;
  }

  if (inspectedType === 'string') {
    const getResponse = await executeRedisCommand(['GET', request.key]);
    if ('error' in getResponse) {
      emitError(jobId, onDone, getResponse.error.code, getResponse.error.message);
      return;
    }
    const rawValue = asString(getResponse.data) ?? '';
    const truncated = truncateUtf8ByBytes(rawValue, maxBytes);
    const result: RedisInspectorResult = {
      key: request.key,
      type: 'string',
      ttlSeconds,
      isPartial: truncated.truncated,
      capReached: truncated.truncated,
      ...(truncated.truncated ? { capReason: 'STRING_PREVIEW_LIMIT' } : {}),
      fetchedCount: rawValue.length > 0 ? 1 : 0,
      byteLength: truncated.byteLength,
      value: truncated.value,
    };
    onProgress({
      jobId,
      status: 'running',
      result,
    });
    onDone({
      jobId,
      status: 'completed',
      result,
    });
    return;
  }

  if (inspectedType === 'hash') {
    const hashLengthResponse = await executeRedisCommand(['HLEN', request.key]);
    const totalFields = 'error' in hashLengthResponse ? null : asNumber(hashLengthResponse.data);

    const entries: RedisHashFieldEntry[] = [];
    let cursor = '0';
    let fetchedCount = 0;
    let consumedBytes = 0;
    let capReason: string | undefined;

    do {
      if (isCancelled()) {
        onDone({
          jobId,
          status: 'cancelled',
          result: buildHashResult(
            request.key,
            ttlSeconds,
            entries,
            fetchedCount,
            totalFields,
            cursor,
            true,
            capReason,
          ),
        });
        return;
      }

      const scanResponse = await executeRedisCommand([
        'HSCAN',
        request.key,
        cursor,
        'COUNT',
        String(hashChunkSize),
      ]);
      if ('error' in scanResponse) {
        emitError(jobId, onDone, scanResponse.error.code, scanResponse.error.message);
        return;
      }

      const parsed = parseCursorScanResponse(scanResponse.data, 'INVALID_HSCAN_RESPONSE');
      cursor = parsed.cursor;
      const scannedEntries = parseHashEntriesFromScan(parsed.values);

      for (const entry of scannedEntries) {
        if (fetchedCount >= maxEntries) {
          capReason = 'HASH_ENTRY_LIMIT';
          break;
        }
        const projectedBytes =
          consumedBytes +
          Buffer.byteLength(entry.field, 'utf8') +
          Buffer.byteLength(entry.value, 'utf8');
        if (projectedBytes > maxBytes) {
          capReason = 'HASH_PREVIEW_LIMIT';
          break;
        }
        entries.push(entry);
        fetchedCount += 1;
        consumedBytes = projectedBytes;
      }

      const hasMore = cursor !== '0' || Boolean(capReason);
      onProgress({
        jobId,
        status: 'running',
        result: buildHashResult(
          request.key,
          ttlSeconds,
          entries.slice(),
          fetchedCount,
          totalFields,
          cursor,
          hasMore,
          capReason,
        ),
      });

      if (capReason) {
        break;
      }
    } while (cursor !== '0');

    onDone({
      jobId,
      status: 'completed',
      result: buildHashResult(
        request.key,
        ttlSeconds,
        entries,
        fetchedCount,
        totalFields,
        cursor,
        cursor !== '0',
        capReason,
      ),
    });
    return;
  }

  if (inspectedType === 'list') {
    const listLengthResponse = await executeRedisCommand(['LLEN', request.key]);
    const totalCount = 'error' in listLengthResponse ? null : asNumber(listLengthResponse.data);
    if (totalCount == null) {
      emitError(jobId, onDone, 'LIST_LENGTH_FAILED', 'Failed to read list length.');
      return;
    }

    const items: RedisCollectionItem[] = [];
    let start = 0;
    let consumedBytes = 0;
    let capReason: string | undefined;

    while (start < totalCount) {
      if (isCancelled()) {
        onDone({
          jobId,
          status: 'cancelled',
          result: buildCollectionResult(
            request.key,
            'list',
            ttlSeconds,
            items,
            items.length,
            totalCount,
            String(start),
            true,
            capReason,
          ),
        });
        return;
      }

      const end = Math.min(start + collectionChunkSize - 1, totalCount - 1);
      const rangeResponse = await executeRedisCommand([
        'LRANGE',
        request.key,
        String(start),
        String(end),
      ]);
      if ('error' in rangeResponse) {
        emitError(jobId, onDone, rangeResponse.error.code, rangeResponse.error.message);
        return;
      }
      const values = parseFlatStringArray(rangeResponse.data, 'INVALID_LRANGE_RESPONSE');
      for (const value of values) {
        if (items.length >= maxEntries) {
          capReason = 'COLLECTION_ENTRY_LIMIT';
          break;
        }
        const projectedBytes = consumedBytes + Buffer.byteLength(value, 'utf8');
        if (projectedBytes > maxBytes) {
          capReason = 'COLLECTION_PREVIEW_LIMIT';
          break;
        }
        items.push({ value });
        consumedBytes = projectedBytes;
      }

      start = end + 1;
      const hasMore = start < totalCount || Boolean(capReason);
      onProgress({
        jobId,
        status: 'running',
        result: buildCollectionResult(
          request.key,
          'list',
          ttlSeconds,
          items.slice(),
          items.length,
          totalCount,
          String(start),
          hasMore,
          capReason,
        ),
      });
      if (capReason) {
        break;
      }
    }

    onDone({
      jobId,
      status: 'completed',
      result: buildCollectionResult(
        request.key,
        'list',
        ttlSeconds,
        items,
        items.length,
        totalCount,
        String(start),
        start < totalCount,
        capReason,
      ),
    });
    return;
  }

	if (inspectedType === 'set' || inspectedType === 'zset') {
    const cardinalityCommand = inspectedType === 'set' ? 'SCARD' : 'ZCARD';
    const totalCountResponse = await executeRedisCommand([cardinalityCommand, request.key]);
    const totalCount = 'error' in totalCountResponse ? null : asNumber(totalCountResponse.data);

    const map = new Map<string, RedisCollectionItem>();
    let cursor = '0';
    let consumedBytes = 0;
    let capReason: string | undefined;

    do {
      if (isCancelled()) {
        onDone({
          jobId,
          status: 'cancelled',
          result: buildCollectionResult(
            request.key,
            inspectedType,
            ttlSeconds,
            [...map.values()],
            map.size,
            totalCount,
            cursor,
            true,
            capReason,
          ),
        });
		return;
	}

      const command = inspectedType === 'set' ? 'SSCAN' : 'ZSCAN';
      const scanResponse = await executeRedisCommand([
        command,
        request.key,
        cursor,
        'COUNT',
        String(collectionChunkSize),
      ]);
      if ('error' in scanResponse) {
        emitError(jobId, onDone, scanResponse.error.code, scanResponse.error.message);
        return;
      }

      const parsed = parseCursorScanResponse(
        scanResponse.data,
        inspectedType === 'set' ? 'INVALID_SSCAN_RESPONSE' : 'INVALID_ZSCAN_RESPONSE',
      );
      cursor = parsed.cursor;
      const batchItems =
        inspectedType === 'set'
          ? parsed.values.map((value) => ({ value }))
          : parseZsetItemsFromScan(parsed.values);

      for (const item of batchItems) {
        if (map.size >= maxEntries && !map.has(item.value)) {
          capReason = 'COLLECTION_ENTRY_LIMIT';
          break;
        }
        const scoreSize =
          'score' in item && typeof item.score === 'number'
            ? Buffer.byteLength(String(item.score), 'utf8')
            : 0;
        const valueSize =
          Buffer.byteLength(item.value, 'utf8') + scoreSize;
        if (consumedBytes + valueSize > maxBytes && !map.has(item.value)) {
          capReason = 'COLLECTION_PREVIEW_LIMIT';
          break;
        }
        if (!map.has(item.value)) {
          consumedBytes += valueSize;
        }
        map.set(item.value, item);
      }

      const hasMore = cursor !== '0' || Boolean(capReason);
      onProgress({
        jobId,
        status: 'running',
        result: buildCollectionResult(
          request.key,
          inspectedType,
          ttlSeconds,
          [...map.values()],
          map.size,
          totalCount,
          cursor,
          hasMore,
          capReason,
        ),
      });
      if (capReason) {
        break;
      }
    } while (cursor !== '0');

    onDone({
      jobId,
      status: 'completed',
      result: buildCollectionResult(
        request.key,
        inspectedType,
        ttlSeconds,
        [...map.values()],
        map.size,
        totalCount,
        cursor,
        cursor !== '0',
        capReason,
      ),
    });
    return;
  }

	if (inspectedType === 'stream') {
		if (isCancelled()) {
			onDone({
				jobId,
				status: 'cancelled',
			});
			return;
		}

		const lengthResponse = await executeRedisCommand(['XLEN', request.key]);
		const totalCount = 'error' in lengthResponse ? null : asNumber(lengthResponse.data);

		const rangeResponse = await executeRedisCommand([
			'XREVRANGE',
			request.key,
			'+',
			'-',
			'COUNT',
			String(streamCount),
		]);
		if ('error' in rangeResponse) {
			emitError(jobId, onDone, rangeResponse.error.code, rangeResponse.error.message);
			return;
		}

		const rawEntries = parseStreamEntries(rangeResponse.data);
		const entries: RedisStreamEntry[] = [];
		let consumedBytes = 0;
		let capReason: string | undefined;

		for (const entry of rawEntries) {
			if (entries.length >= maxEntries) {
				capReason = 'STREAM_ENTRY_LIMIT';
				break;
			}
			const fieldBytes = entry.fields.reduce((sum, field) => {
				return (
					sum +
					Buffer.byteLength(field.field, 'utf8') +
					Buffer.byteLength(field.value, 'utf8')
				);
			}, 0);
			const entryBytes = Buffer.byteLength(entry.id, 'utf8') + fieldBytes;
			if (consumedBytes + entryBytes > maxBytes) {
				capReason = 'STREAM_PREVIEW_LIMIT';
				break;
			}
			entries.push(entry);
			consumedBytes += entryBytes;
		}

		const truncatedByCount =
			totalCount != null ? totalCount > entries.length : rawEntries.length > entries.length;
		const result: RedisInspectorStreamResult = {
			key: request.key,
			type: 'stream',
			ttlSeconds,
			isPartial: truncatedByCount || Boolean(capReason),
			capReached: Boolean(capReason),
			...(capReason ? { capReason } : {}),
			fetchedCount: entries.length,
			totalCount,
			truncated: truncatedByCount || Boolean(capReason),
			entries,
		};

		onProgress({
			jobId,
			status: 'running',
			result,
		});
		onDone({
			jobId,
			status: 'completed',
			result,
		});
		return;
	}

  emitError(
    jobId,
    onDone,
    'UNSUPPORTED_TYPE',
    `Redis type "${asString(typeResponse.data) ?? 'unknown'}" is not supported yet.`,
  );
};
