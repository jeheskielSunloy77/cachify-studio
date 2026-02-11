import type {
  InspectorDecodePipelineId,
  InspectorDecodeState,
  RedisCollectionItem,
  RedisHashFieldEntry,
  InspectorViewState,
  RedisInspectCopyRequest,
  RedisInspectDoneEvent,
  RedisInspectProgressEvent,
  RedisInspectStartRequest,
  RedisInspectorHashResult,
  RedisInspectorListResult,
  RevealState,
  RedisInspectorResult,
  RedisInspectorSetResult,
  RedisInspectorStreamResult,
  RedisInspectorZSetResult,
  RedisStreamEntry,
  RedisStreamField,
} from '../../../../shared/ipc/ipc.contract';
import type { RedisCommandValue } from '../clients/redis.client';
import {
  buildRedactionMetadata,
  redactPreviewText,
  type RedactionMetadata,
} from '../../security/redaction';

const DEFAULT_MAX_PREVIEW_BYTES = 1_048_576;
const DEFAULT_MAX_FORMATTED_DEPTH = 20;
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

type FormattedPreviewResult = {
  formatted: string | null;
  formattedAvailable: boolean;
  depthLimitReached: boolean;
  unavailableReason?: string;
};

const RAW_TEXT_PIPELINE_ID: InspectorDecodePipelineId = 'raw-text';
const JSON_PRETTY_PIPELINE_ID: InspectorDecodePipelineId = 'json-pretty';

const viewModeForDecodePipeline = (pipelineId: InspectorDecodePipelineId) =>
  pipelineId === JSON_PRETTY_PIPELINE_ID ? 'formatted' : 'raw';

const resolveRequestedDecodePipeline = (
  request: RedisInspectStartRequest,
): InspectorDecodePipelineId => {
  if (request.decodePipelineId) {
    return request.decodePipelineId;
  }
  return request.viewMode === 'formatted' ? JSON_PRETTY_PIPELINE_ID : RAW_TEXT_PIPELINE_ID;
};

const buildDecodeState = ({
  requestedPipelineId,
  activePipelineId,
  supportsJsonPretty,
  stageStatus,
  message,
  failureCode,
  suggestedActions,
}: {
  requestedPipelineId: InspectorDecodePipelineId;
  activePipelineId: InspectorDecodePipelineId;
  supportsJsonPretty: boolean;
  stageStatus: InspectorDecodeState['stage']['status'];
  message: string;
  failureCode?: InspectorDecodeState['stage']['failureCode'];
  suggestedActions: InspectorDecodeState['stage']['suggestedActions'];
}): InspectorDecodeState => ({
  requestedPipelineId,
  activePipelineId,
  activePipelineLabel:
    activePipelineId === JSON_PRETTY_PIPELINE_ID ? 'JSON pretty' : 'Raw text',
  pipelines: [
    {
      id: RAW_TEXT_PIPELINE_ID,
      label: 'Raw text',
      supported: true,
    },
    {
      id: JSON_PRETTY_PIPELINE_ID,
      label: 'JSON pretty',
      supported: supportsJsonPretty,
      ...(supportsJsonPretty
        ? {}
        : { unsupportedReason: 'This Redis value type does not support JSON pretty decode.' }),
    },
  ],
  stage: {
    status: stageStatus,
    message,
    ...(failureCode ? { failureCode } : {}),
    suggestedActions,
  },
});

const REVEAL_AUTO_RESET_TRIGGERS: RevealState['autoResetTriggers'] = [
  'key-change',
  'view-switch',
  'navigation',
  'disconnect',
  'safety-relock',
];

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

const applyDepthCapForFormatting = (
  value: unknown,
  maxDepth: number,
  currentDepth = 1,
): { value: unknown; depthLimitReached: boolean } => {
  if (value == null || typeof value !== 'object') {
    return { value, depthLimitReached: false };
  }
  if (currentDepth > maxDepth) {
    return {
      value: '[Depth limit reached]',
      depthLimitReached: true,
    };
  }
  if (Array.isArray(value)) {
    let depthLimitReached = false;
    const mapped = value.map((entry) => {
      const result = applyDepthCapForFormatting(entry, maxDepth, currentDepth + 1);
      depthLimitReached = depthLimitReached || result.depthLimitReached;
      return result.value;
    });
    return {
      value: mapped,
      depthLimitReached,
    };
  }

  let depthLimitReached = false;
  const mapped: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    const result = applyDepthCapForFormatting(entry, maxDepth, currentDepth + 1);
    depthLimitReached = depthLimitReached || result.depthLimitReached;
    mapped[key] = result.value;
  }
  return {
    value: mapped,
    depthLimitReached,
  };
};

const buildFormattedPreview = (value: string, maxDepth: number): FormattedPreviewResult => {
  try {
    const parsed = JSON.parse(value) as unknown;
    const capped = applyDepthCapForFormatting(parsed, maxDepth);
    return {
      formatted: JSON.stringify(capped.value, null, 2),
      formattedAvailable: true,
      depthLimitReached: capped.depthLimitReached,
    };
  } catch {
    return {
      formatted: null,
      formattedAvailable: false,
      depthLimitReached: false,
      unavailableReason: 'VALUE_NOT_FORMATTABLE_AS_JSON',
    };
  }
};

const buildRevealState = (mode: RevealState['mode'], canReveal: boolean): RevealState => ({
  mode,
  canReveal,
  explicitInteractionRequired: true,
  autoResetTriggers: REVEAL_AUTO_RESET_TRIGGERS,
});

const buildViewState = (
  requestedMode: InspectorViewState['requestedMode'],
  activeMode: InspectorViewState['activeMode'],
  formattedAvailable: boolean,
  formattedUnavailableReason?: string,
): InspectorViewState => ({
  requestedMode,
  activeMode,
  rawAvailable: true,
  formattedAvailable,
  ...(formattedUnavailableReason ? { formattedUnavailableReason } : {}),
});

const buildHashResult = (
  key: string,
  ttlSeconds: number | null,
  entries: RedisHashFieldEntry[],
  fetchedCount: number,
  totalFields: number | null,
  nextCursor: string,
  hasMore: boolean,
  previewBytes: number,
  maxDepthApplied: number | null,
  redaction: RedactionMetadata,
  reveal: RevealState,
  view: InspectorViewState,
  decode: InspectorDecodeState,
  capReason?: string,
): RedisInspectorHashResult => ({
  key,
  type: 'hash',
  ttlSeconds,
  isPartial: hasMore || Boolean(capReason),
  capReached: Boolean(capReason),
  ...(capReason ? { capReason } : {}),
  previewBytes,
  maxDepthApplied,
  redaction,
  reveal,
  view,
  decode,
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
  previewBytes: number,
  maxDepthApplied: number | null,
  redaction: RedactionMetadata,
  reveal: RevealState,
  view: InspectorViewState,
  decode: InspectorDecodeState,
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
      previewBytes,
      maxDepthApplied,
      redaction,
      reveal,
      view,
      decode,
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
      previewBytes,
      maxDepthApplied,
      redaction,
      reveal,
      view,
      decode,
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
    previewBytes,
    maxDepthApplied,
    redaction,
    reveal,
    view,
    decode,
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
  const requestedRevealMode = request.revealMode ?? 'redacted';
  const requestedDecodePipelineId = resolveRequestedDecodePipeline(request);
  const requestedViewMode =
    request.viewMode ?? viewModeForDecodePipeline(requestedDecodePipelineId);

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
      previewBytes: 0,
      maxDepthApplied: null,
      redaction: buildRedactionMetadata(0),
      reveal: buildRevealState('redacted', false),
      view: buildViewState(requestedViewMode, 'raw', false, 'TYPE_HAS_NO_FORMATTED_VIEW'),
      decode:
        requestedDecodePipelineId === RAW_TEXT_PIPELINE_ID
          ? buildDecodeState({
              requestedPipelineId: requestedDecodePipelineId,
              activePipelineId: RAW_TEXT_PIPELINE_ID,
              supportsJsonPretty: false,
              stageStatus: 'success',
              message: 'Raw text pipeline active.',
              suggestedActions: ['export-raw-partial'],
            })
          : buildDecodeState({
              requestedPipelineId: requestedDecodePipelineId,
              activePipelineId: RAW_TEXT_PIPELINE_ID,
              supportsJsonPretty: false,
              stageStatus: 'fallback',
              message: 'JSON pretty decode is unavailable for missing keys. Falling back to raw text.',
              failureCode: 'TYPE_HAS_NO_PIPELINE',
              suggestedActions: ['use-raw-text', 'export-raw-partial'],
            }),
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
    const redacted = redactPreviewText(truncated.value);
    const rawOutputValue = requestedRevealMode === 'revealed' ? truncated.value : redacted.value;
    if (isCancelled()) {
      onDone({
        jobId,
        status: 'cancelled',
      });
      return;
    }
    const formattedPreview = truncated.truncated
      ? {
          formatted: null,
          formattedAvailable: false,
          depthLimitReached: false,
          unavailableReason: 'PREVIEW_TRUNCATED_BEFORE_DECODE',
        }
      : buildFormattedPreview(rawOutputValue, DEFAULT_MAX_FORMATTED_DEPTH);
    const activeDecodePipelineId =
      requestedDecodePipelineId === JSON_PRETTY_PIPELINE_ID &&
      formattedPreview.formattedAvailable
        ? JSON_PRETTY_PIPELINE_ID
        : RAW_TEXT_PIPELINE_ID;
    const activeMode = viewModeForDecodePipeline(activeDecodePipelineId);
    const outputValue =
      activeMode === 'formatted' && formattedPreview.formatted != null
        ? formattedPreview.formatted
        : rawOutputValue;
    const previewBytes = Buffer.byteLength(outputValue, 'utf8');
    const depthCapReached = activeMode === 'formatted' && formattedPreview.depthLimitReached;
    const capReason = truncated.truncated
      ? 'STRING_PREVIEW_LIMIT'
      : depthCapReached
        ? 'FORMATTED_DEPTH_LIMIT'
        : undefined;
    const viewState = buildViewState(
      requestedViewMode,
      activeMode,
      formattedPreview.formattedAvailable,
      formattedPreview.formattedAvailable ? undefined : formattedPreview.unavailableReason,
    );
    const decodeState =
      requestedDecodePipelineId === RAW_TEXT_PIPELINE_ID
        ? buildDecodeState({
            requestedPipelineId: requestedDecodePipelineId,
            activePipelineId: activeDecodePipelineId,
            supportsJsonPretty: true,
            stageStatus: 'success',
            message: 'Raw text pipeline active.',
            suggestedActions: formattedPreview.formattedAvailable
              ? ['use-json-pretty', 'export-raw-partial']
              : ['export-raw-partial'],
          })
        : activeDecodePipelineId === JSON_PRETTY_PIPELINE_ID
          ? buildDecodeState({
              requestedPipelineId: requestedDecodePipelineId,
              activePipelineId: activeDecodePipelineId,
              supportsJsonPretty: true,
              stageStatus: 'success',
              message: 'JSON pretty pipeline active.',
              suggestedActions: ['use-raw-text', 'export-raw-partial'],
            })
          : buildDecodeState({
              requestedPipelineId: requestedDecodePipelineId,
              activePipelineId: RAW_TEXT_PIPELINE_ID,
              supportsJsonPretty: true,
              stageStatus: 'fallback',
              message:
                formattedPreview.unavailableReason === 'PREVIEW_TRUNCATED_BEFORE_DECODE'
                  ? 'JSON pretty decode was skipped because preview was truncated. Falling back to raw text.'
                  : 'JSON pretty decode failed. Falling back to raw text.',
              failureCode:
                formattedPreview.unavailableReason === 'PREVIEW_TRUNCATED_BEFORE_DECODE'
                  ? 'PREVIEW_TRUNCATED_BEFORE_DECODE'
                  : 'VALUE_NOT_FORMATTABLE_AS_JSON',
              suggestedActions: ['use-raw-text', 'export-raw-partial'],
            });
    const result: RedisInspectorResult = {
      key: request.key,
      type: 'string',
      ttlSeconds,
      isPartial: truncated.truncated || depthCapReached,
      capReached: truncated.truncated || depthCapReached,
      ...(capReason ? { capReason } : {}),
      previewBytes,
      maxDepthApplied: activeMode === 'formatted' ? DEFAULT_MAX_FORMATTED_DEPTH : null,
      redaction: redacted.metadata,
      reveal: buildRevealState(requestedRevealMode, true),
      view: viewState,
      decode: decodeState,
      fetchedCount: rawValue.length > 0 ? 1 : 0,
      byteLength: truncated.byteLength,
      value: outputValue,
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
    const revealState = buildRevealState(requestedRevealMode, true);
    const viewState = buildViewState(requestedViewMode, 'raw', false, 'TYPE_HAS_NO_FORMATTED_VIEW');
    const decodeState =
      requestedDecodePipelineId === RAW_TEXT_PIPELINE_ID
        ? buildDecodeState({
            requestedPipelineId: requestedDecodePipelineId,
            activePipelineId: RAW_TEXT_PIPELINE_ID,
            supportsJsonPretty: false,
            stageStatus: 'success',
            message: 'Raw text pipeline active.',
            suggestedActions: ['export-raw-partial'],
          })
        : buildDecodeState({
            requestedPipelineId: requestedDecodePipelineId,
            activePipelineId: RAW_TEXT_PIPELINE_ID,
            supportsJsonPretty: false,
            stageStatus: 'fallback',
            message: 'JSON pretty decode is unavailable for hash values. Falling back to raw text.',
            failureCode: 'TYPE_HAS_NO_PIPELINE',
            suggestedActions: ['use-raw-text', 'export-raw-partial'],
          });

    const entries: RedisHashFieldEntry[] = [];
    let cursor = '0';
    let fetchedCount = 0;
    let consumedBytes = 0;
    let redactedSegments = 0;
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
            consumedBytes,
            null,
            buildRedactionMetadata(redactedSegments),
            revealState,
            viewState,
            decodeState,
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
        const redactedField = redactPreviewText(entry.field);
        const redactedValue = redactPreviewText(entry.value);
        redactedSegments += redactedField.metadata.redactedSegments;
        redactedSegments += redactedValue.metadata.redactedSegments;
        entries.push({
          field: requestedRevealMode === 'revealed' ? entry.field : redactedField.value,
          value: requestedRevealMode === 'revealed' ? entry.value : redactedValue.value,
        });
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
          consumedBytes,
          null,
          buildRedactionMetadata(redactedSegments),
          revealState,
          viewState,
          decodeState,
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
        consumedBytes,
        null,
        buildRedactionMetadata(redactedSegments),
        revealState,
        viewState,
        decodeState,
        capReason,
      ),
    });
    return;
  }

  if (inspectedType === 'list') {
    const listLengthResponse = await executeRedisCommand(['LLEN', request.key]);
    const totalCount = 'error' in listLengthResponse ? null : asNumber(listLengthResponse.data);
    const revealState = buildRevealState(requestedRevealMode, true);
    const viewState = buildViewState(requestedViewMode, 'raw', false, 'TYPE_HAS_NO_FORMATTED_VIEW');
    const decodeState =
      requestedDecodePipelineId === RAW_TEXT_PIPELINE_ID
        ? buildDecodeState({
            requestedPipelineId: requestedDecodePipelineId,
            activePipelineId: RAW_TEXT_PIPELINE_ID,
            supportsJsonPretty: false,
            stageStatus: 'success',
            message: 'Raw text pipeline active.',
            suggestedActions: ['export-raw-partial'],
          })
        : buildDecodeState({
            requestedPipelineId: requestedDecodePipelineId,
            activePipelineId: RAW_TEXT_PIPELINE_ID,
            supportsJsonPretty: false,
            stageStatus: 'fallback',
            message: 'JSON pretty decode is unavailable for list values. Falling back to raw text.',
            failureCode: 'TYPE_HAS_NO_PIPELINE',
            suggestedActions: ['use-raw-text', 'export-raw-partial'],
          });
    if (totalCount == null) {
      emitError(jobId, onDone, 'LIST_LENGTH_FAILED', 'Failed to read list length.');
      return;
    }

    const items: RedisCollectionItem[] = [];
    let start = 0;
    let consumedBytes = 0;
    let redactedSegments = 0;
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
            consumedBytes,
            null,
            buildRedactionMetadata(redactedSegments),
            revealState,
            viewState,
            decodeState,
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
        const redactedValue = redactPreviewText(value);
        redactedSegments += redactedValue.metadata.redactedSegments;
        items.push({
          value: requestedRevealMode === 'revealed' ? value : redactedValue.value,
        });
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
          consumedBytes,
          null,
          buildRedactionMetadata(redactedSegments),
          revealState,
          viewState,
          decodeState,
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
        consumedBytes,
        null,
        buildRedactionMetadata(redactedSegments),
        revealState,
        viewState,
        decodeState,
        capReason,
      ),
    });
    return;
  }

  if (inspectedType === 'set' || inspectedType === 'zset') {
    const cardinalityCommand = inspectedType === 'set' ? 'SCARD' : 'ZCARD';
    const totalCountResponse = await executeRedisCommand([cardinalityCommand, request.key]);
    const totalCount = 'error' in totalCountResponse ? null : asNumber(totalCountResponse.data);
    const revealState = buildRevealState(requestedRevealMode, true);
    const viewState = buildViewState(requestedViewMode, 'raw', false, 'TYPE_HAS_NO_FORMATTED_VIEW');
    const decodeState =
      requestedDecodePipelineId === RAW_TEXT_PIPELINE_ID
        ? buildDecodeState({
            requestedPipelineId: requestedDecodePipelineId,
            activePipelineId: RAW_TEXT_PIPELINE_ID,
            supportsJsonPretty: false,
            stageStatus: 'success',
            message: 'Raw text pipeline active.',
            suggestedActions: ['export-raw-partial'],
          })
        : buildDecodeState({
            requestedPipelineId: requestedDecodePipelineId,
            activePipelineId: RAW_TEXT_PIPELINE_ID,
            supportsJsonPretty: false,
            stageStatus: 'fallback',
            message: `JSON pretty decode is unavailable for ${inspectedType} values. Falling back to raw text.`,
            failureCode: 'TYPE_HAS_NO_PIPELINE',
            suggestedActions: ['use-raw-text', 'export-raw-partial'],
          });

    const map = new Map<string, RedisCollectionItem>();
    let cursor = '0';
    let consumedBytes = 0;
    let redactedSegments = 0;
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
            consumedBytes,
            null,
            buildRedactionMetadata(redactedSegments),
            revealState,
            viewState,
            decodeState,
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
          const redactedValue = redactPreviewText(item.value);
          redactedSegments += redactedValue.metadata.redactedSegments;
          map.set(item.value, {
            ...item,
            value: requestedRevealMode === 'revealed' ? item.value : redactedValue.value,
          });
          continue;
        }
        const existing = map.get(item.value);
        if (!existing) {
          continue;
        }
        if ('score' in item && typeof item.score === 'number') {
          map.set(item.value, {
            value: existing.value,
            score: item.score,
          });
        }
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
          consumedBytes,
          null,
          buildRedactionMetadata(redactedSegments),
          revealState,
          viewState,
          decodeState,
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
        consumedBytes,
        null,
        buildRedactionMetadata(redactedSegments),
        revealState,
        viewState,
        decodeState,
        capReason,
      ),
    });
    return;
  }

  if (inspectedType === 'stream') {
    const revealState = buildRevealState(requestedRevealMode, true);
    const viewState = buildViewState(requestedViewMode, 'raw', false, 'TYPE_HAS_NO_FORMATTED_VIEW');
    const decodeState =
      requestedDecodePipelineId === RAW_TEXT_PIPELINE_ID
        ? buildDecodeState({
            requestedPipelineId: requestedDecodePipelineId,
            activePipelineId: RAW_TEXT_PIPELINE_ID,
            supportsJsonPretty: false,
            stageStatus: 'success',
            message: 'Raw text pipeline active.',
            suggestedActions: ['export-raw-partial'],
          })
        : buildDecodeState({
            requestedPipelineId: requestedDecodePipelineId,
            activePipelineId: RAW_TEXT_PIPELINE_ID,
            supportsJsonPretty: false,
            stageStatus: 'fallback',
            message: 'JSON pretty decode is unavailable for stream values. Falling back to raw text.',
            failureCode: 'TYPE_HAS_NO_PIPELINE',
            suggestedActions: ['use-raw-text', 'export-raw-partial'],
          });
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
    let redactedSegments = 0;
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
      const redactedFields = entry.fields.map((field) => {
        const redactedFieldName = redactPreviewText(field.field);
        const redactedValue = redactPreviewText(field.value);
        redactedSegments += redactedFieldName.metadata.redactedSegments;
        redactedSegments += redactedValue.metadata.redactedSegments;
        return {
          field: requestedRevealMode === 'revealed' ? field.field : redactedFieldName.value,
          value: requestedRevealMode === 'revealed' ? field.value : redactedValue.value,
        };
      });
      entries.push({
        id: entry.id,
        fields: redactedFields,
      });
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
      previewBytes: consumedBytes,
      maxDepthApplied: null,
      redaction: buildRedactionMetadata(redactedSegments),
      reveal: revealState,
      view: viewState,
      decode: decodeState,
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

type RedisInspectCopyMode = RedisInspectCopyRequest['copyMode'];

const normalizeTtlLabel = (ttlSeconds: number | null) => {
  if (ttlSeconds === -1) {
    return 'persistent';
  }
  if (ttlSeconds === -2) {
    return 'missing';
  }
  if (typeof ttlSeconds === 'number') {
    return `${ttlSeconds}s`;
  }
  return 'unavailable';
};

const buildCopyRepresentation = (
  result: RedisInspectorResult,
  redactForCopy: (value: string) => string,
) => {
  if (result.type === 'string') {
    return redactForCopy(result.value);
  }
  if (result.type === 'hash') {
    return JSON.stringify(
      result.entries.map((entry) => ({
        field: redactForCopy(entry.field),
        value: redactForCopy(entry.value),
      })),
      null,
      2,
    );
  }
  if (result.type === 'list' || result.type === 'set' || result.type === 'zset') {
    return JSON.stringify(
      result.items.map((item) => ({
        value: redactForCopy(item.value),
        ...(typeof item.score === 'number' ? { score: item.score } : {}),
      })),
      null,
      2,
    );
  }
  if (result.type === 'stream') {
    return JSON.stringify(
      result.entries.map((entry) => ({
        id: redactForCopy(entry.id),
        fields: entry.fields.map((field) => ({
          field: redactForCopy(field.field),
          value: redactForCopy(field.value),
        })),
      })),
      null,
      2,
    );
  }
  return result.reason;
};

export const buildRedisInspectCopyPayload = (
  result: RedisInspectorResult,
  copyMode: RedisInspectCopyMode,
) => {
  let redactionApplied = false;
  const redactForCopy = (value: string) => {
    if (copyMode !== 'safeRedacted') {
      return value;
    }
    const redacted = redactPreviewText(value);
    redactionApplied = redactionApplied || redacted.metadata.redactionApplied;
    return redacted.value;
  };

  const copyValue = buildCopyRepresentation(result, redactForCopy);
  const decodeLabel = result.decode?.activePipelineLabel ?? 'Raw text';
  const viewMode = result.view?.activeMode ?? 'raw';
  const text = [
    `Key: ${result.key}`,
    `Type: ${result.type}`,
    `TTL: ${normalizeTtlLabel(result.ttlSeconds)}`,
    `Decode: ${decodeLabel}`,
    `View: ${viewMode}`,
    `Copy mode: ${copyMode}`,
    '',
    'Value:',
    copyValue,
  ].join('\n');

  return {
    text,
    modeUsed: copyMode,
    copiedBytes: Buffer.byteLength(text, 'utf8'),
    redactionApplied,
  };
};
