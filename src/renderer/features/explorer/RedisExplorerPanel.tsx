import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/renderer/components/ui/badge';
import { Button } from '@/renderer/components/ui/button';
import { Input } from '@/renderer/components/ui/input';
import { Label } from '@/renderer/components/ui/label';
import type {
  ConnectionStatus,
  InspectorDecodePipelineId,
  MemcachedGetResponse,
  MemcachedSetResponse,
  MemcachedStatsGetResponse,
  RedisInspectDoneEvent,
  RedisInspectProgressEvent,
  RedisInspectorResult,
  RedisKeyDiscoveryItem,
  RedisKeysSearchDoneEvent,
  RedisKeysSearchProgressEvent,
} from '@/shared/ipc/ipc.contract';

const buildPrefixOptions = (keys: RedisKeyDiscoveryItem[]) => {
  const prefixes = new Set<string>();
  for (const item of keys) {
    if (item.prefixSegments.length < 2) {
      continue;
    }
    for (let index = 0; index < item.prefixSegments.length - 1; index += 1) {
      const prefix = item.prefixSegments.slice(0, index + 1).join(':');
      if (prefix) {
        prefixes.add(prefix);
      }
    }
  }
  return [...prefixes].sort((left, right) => left.localeCompare(right));
};

const mergeKeys = (existing: RedisKeyDiscoveryItem[], incoming: RedisKeyDiscoveryItem[]) => {
  const map = new Map(existing.map((item) => [item.key, item]));
  for (const item of incoming) {
    map.set(item.key, {
      ...map.get(item.key),
      ...item,
    });
  }
  return [...map.values()].sort((left, right) => left.key.localeCompare(right.key));
};

const resolveDoneMessage = (event: RedisKeysSearchDoneEvent) => {
  if (event.status === 'error') {
    return event.error?.message ?? 'Key discovery failed.';
  }
  if (event.status === 'cancelled') {
    return event.continuation?.message ?? 'Search cancelled.';
  }
  if (event.status === 'limit-reached') {
    return (
      event.continuation?.message ??
      'Limit reached. Narrow query/prefix and continue with a follow-up scan.'
    );
  }
  return `Search complete. ${event.emittedCount} unique keys found.`;
};

const resolveTypeLabel = (item: RedisKeyDiscoveryItem) => {
  if (item.metadataState === 'pending') {
    return 'type: loading';
  }
  return `type: ${item.type ?? 'unknown'}`;
};

const resolveTtlLabel = (item: RedisKeyDiscoveryItem) => {
  if (item.metadataState === 'pending') {
    return 'TTL: loading';
  }
  if (item.ttlSeconds === -1) {
    return 'TTL: persistent';
  }
  if (item.ttlSeconds === -2) {
    return 'TTL: missing';
  }
  if (typeof item.ttlSeconds === 'number') {
    return `TTL: ${item.ttlSeconds}s`;
  }
  return 'TTL: unavailable';
};

const resolveInspectorTtlLabel = (ttlSeconds: number | null) => {
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

const resolveFormattedUnavailableReason = (reason?: string) => {
  if (reason === 'VALUE_NOT_FORMATTABLE_AS_JSON') {
    return 'Value is not valid JSON for formatted view.';
  }
  if (reason === 'PREVIEW_TRUNCATED_BEFORE_DECODE') {
    return 'Preview was truncated before formatting could run.';
  }
  if (reason === 'TYPE_HAS_NO_FORMATTED_VIEW') {
    return 'Formatted view is not available for this Redis type.';
  }
  return 'Formatted view is unavailable for this payload.';
};

const DECODE_PIPELINE_PREFERENCE_KEY = 'cachify.decodePipelinePreference';
const DEFAULT_DECODE_PIPELINE: InspectorDecodePipelineId = 'raw-text';
const JSON_PRETTY_PIPELINE: InspectorDecodePipelineId = 'json-pretty';

const decodePipelineToViewMode = (pipelineId: InspectorDecodePipelineId): 'raw' | 'formatted' =>
  pipelineId === JSON_PRETTY_PIPELINE ? 'formatted' : 'raw';

const readDecodePipelinePreference = (): InspectorDecodePipelineId => {
  try {
    const value = window.localStorage.getItem(DECODE_PIPELINE_PREFERENCE_KEY);
    return value === JSON_PRETTY_PIPELINE ? JSON_PRETTY_PIPELINE : DEFAULT_DECODE_PIPELINE;
  } catch {
    return DEFAULT_DECODE_PIPELINE;
  }
};

const parseStreamEntries = (value: string) => {
  const lines = value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return {
      ok: false as const,
      error: 'Add at least one stream field/value line using field=value format.',
    };
  }

  const entries: Array<{ field: string; value: string }> = [];
  for (const line of lines) {
    const separator = line.indexOf('=');
    if (separator <= 0) {
      return {
        ok: false as const,
        error: `Invalid stream entry "${line}". Use field=value format.`,
      };
    }
    const field = line.slice(0, separator).trim();
    const entryValue = line.slice(separator + 1);
    if (field.length === 0) {
      return {
        ok: false as const,
        error: `Stream entry "${line}" is missing a field name.`,
      };
    }
    entries.push({
      field,
      value: entryValue,
    });
  }

  return {
    ok: true as const,
    entries,
  };
};

type RedisExplorerPanelProps = {
  connectionStatus: ConnectionStatus;
};

type MemcachedGetData = Extract<MemcachedGetResponse, { ok: true }>['data'];
type MemcachedStatsData = Extract<MemcachedStatsGetResponse, { ok: true }>['data'];
type MemcachedSetData = Extract<MemcachedSetResponse, { ok: true }>['data'];

export const RedisExplorerPanel = ({ connectionStatus }: RedisExplorerPanelProps) => {
  const [query, setQuery] = useState('');
  const [manualPrefix, setManualPrefix] = useState('');
  const [selectedPrefix, setSelectedPrefix] = useState<string | null>(null);
  const [keys, setKeys] = useState<RedisKeyDiscoveryItem[]>([]);
  const [runningJobId, setRunningJobId] = useState<string | null>(null);
  const [surfaceMessage, setSurfaceMessage] = useState<string | null>(null);
  const [scannedCount, setScannedCount] = useState(0);
  const [emittedCount, setEmittedCount] = useState(0);
  const [capReached, setCapReached] = useState(false);
  const [inspectJobId, setInspectJobId] = useState<string | null>(null);
  const [inspectedKey, setInspectedKey] = useState<string | null>(null);
  const [inspectResult, setInspectResult] = useState<RedisInspectorResult | null>(null);
  const [inspectMessage, setInspectMessage] = useState<string | null>(null);
  const [redisMutationMessage, setRedisMutationMessage] = useState<string | null>(null);
  const [redisMutationPending, setRedisMutationPending] = useState(false);
  const [stringMutationValue, setStringMutationValue] = useState('');
  const [hashMutationField, setHashMutationField] = useState('');
  const [hashMutationValue, setHashMutationValue] = useState('');
  const [listMutationValue, setListMutationValue] = useState('');
  const [listDirection, setListDirection] = useState<'left' | 'right'>('right');
  const [setMutationMember, setSetMutationMember] = useState('');
  const [zsetMutationMember, setZsetMutationMember] = useState('');
  const [zsetMutationScore, setZsetMutationScore] = useState('');
  const [streamMutationEntries, setStreamMutationEntries] = useState('');
  const [deleteConfirmPending, setDeleteConfirmPending] = useState(false);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [copyConfirmRevealed, setCopyConfirmRevealed] = useState(false);
  const [preferredDecodePipelineId, setPreferredDecodePipelineId] = useState<InspectorDecodePipelineId>(
    () => readDecodePipelinePreference(),
  );
  const [revealConfirmPending, setRevealConfirmPending] = useState(false);
  const stringPreviewRef = useRef<HTMLPreElement | null>(null);
  const inspectJobIdRef = useRef<string | null>(null);
  const stringPreviewScrollByMode = useRef<{ raw: number; formatted: number }>({
    raw: 0,
    formatted: 0,
  });
  const [memcachedKey, setMemcachedKey] = useState('');
  const [memcachedLoading, setMemcachedLoading] = useState(false);
  const [memcachedResult, setMemcachedResult] = useState<MemcachedGetData | null>(null);
  const [memcachedStats, setMemcachedStats] = useState<MemcachedStatsData | null>(null);
  const [memcachedMessage, setMemcachedMessage] = useState<string | null>(null);
  const [memcachedSetValue, setMemcachedSetValue] = useState('');
  const [memcachedSetFlags, setMemcachedSetFlags] = useState('');
  const [memcachedSetTtlSeconds, setMemcachedSetTtlSeconds] = useState('');
  const previousSafetyMode = useRef(connectionStatus.safetyMode);
  const stringPreviewValue = inspectResult?.type === 'string' ? inspectResult.value : null;

  const canSearch =
    connectionStatus.state === 'connected' && connectionStatus.activeKind === 'redis';
  const canUseMemcached =
    connectionStatus.state === 'connected' && connectionStatus.activeKind === 'memcached';

  const prefixOptions = useMemo(() => buildPrefixOptions(keys), [keys]);
  const visibleKeys = useMemo(() => {
    if (!selectedPrefix) {
      return keys;
    }
    return keys.filter((item) => item.key.startsWith(`${selectedPrefix}:`) || item.key === selectedPrefix);
  }, [keys, selectedPrefix]);

  const api = window.api as unknown as Partial<typeof window.api>;
  const redisKeysApi = api.redisKeys;
  const redisInspectApi = api.redisInspect;
  const redisMutationsApi = api.redisMutations;
  const memcachedApi = api.memcached;
  const jobsApi = api.jobs;
  const explorerApiAvailable =
    Boolean(redisKeysApi?.startSearch) &&
    Boolean(redisKeysApi?.onSearchProgress) &&
    Boolean(redisKeysApi?.onSearchDone) &&
    Boolean(jobsApi?.cancel);
  const inspectorApiAvailable =
    Boolean(redisInspectApi?.start) &&
    Boolean(redisInspectApi?.onProgress) &&
    Boolean(redisInspectApi?.onDone) &&
    Boolean(jobsApi?.cancel);
  const redisMutationsApiAvailable =
    Boolean(redisMutationsApi?.stringSet) &&
    Boolean(redisMutationsApi?.hashSetField) &&
    Boolean(redisMutationsApi?.listPush) &&
    Boolean(redisMutationsApi?.setAdd) &&
    Boolean(redisMutationsApi?.zsetAdd) &&
    Boolean(redisMutationsApi?.streamAdd) &&
    Boolean(redisMutationsApi?.keyDelete);
  const memcachedApiAvailable =
    Boolean(memcachedApi?.get) &&
    Boolean(memcachedApi?.getStats);
  const memcachedSetAvailable = Boolean(memcachedApi?.set);

  useEffect(() => {
    if (!explorerApiAvailable || !redisKeysApi?.onSearchProgress || !redisKeysApi?.onSearchDone) {
      return;
    }

    const unsubscribeProgress = redisKeysApi.onSearchProgress((event: RedisKeysSearchProgressEvent) => {
      if (!runningJobId || event.jobId !== runningJobId) {
        return;
      }
      setKeys((previous) => mergeKeys(previous, event.keys));
      setScannedCount(event.scannedCount);
      setEmittedCount(event.emittedCount);
      setCapReached(event.capReached);
      setSurfaceMessage(
        event.status === 'running'
          ? `Searching… scanned ${event.scannedCount} · emitted ${event.emittedCount}`
          : null,
      );
    });

    const unsubscribeDone = redisKeysApi.onSearchDone((event: RedisKeysSearchDoneEvent) => {
      if (!runningJobId || event.jobId !== runningJobId) {
        return;
      }
      setRunningJobId(null);
      setScannedCount(event.scannedCount);
      setEmittedCount(event.emittedCount);
      setCapReached(event.capReached);
      setSurfaceMessage(resolveDoneMessage(event));
    });

    return () => {
      unsubscribeProgress();
      unsubscribeDone();
    };
  }, [explorerApiAvailable, redisKeysApi, runningJobId]);

  useEffect(() => {
    const revealMode = inspectResult?.reveal?.mode ?? 'redacted';
    const disconnected = connectionStatus.state !== 'connected';
    const relocked =
      previousSafetyMode.current === 'unlocked' && connectionStatus.safetyMode === 'readOnly';

    if (revealMode === 'revealed' && (disconnected || relocked)) {
      setRevealConfirmPending(false);
      setInspectResult(null);
      setInspectMessage(
        disconnected ? 'Reveal reset due to disconnect.' : 'Reveal reset due to safety relock.',
      );
    }

    previousSafetyMode.current = connectionStatus.safetyMode;
  }, [connectionStatus.safetyMode, connectionStatus.state, inspectResult?.reveal?.mode]);

  useEffect(() => {
    setDeleteConfirmPending(false);
    setRedisMutationMessage(null);
    if (!inspectResult) {
      setStringMutationValue('');
      setHashMutationField('');
      setHashMutationValue('');
      setListMutationValue('');
      setSetMutationMember('');
      setZsetMutationMember('');
      setZsetMutationScore('');
      setStreamMutationEntries('');
      return;
    }

    if (inspectResult.type === 'string') {
      setStringMutationValue(inspectResult.value);
    }
    if (inspectResult.type === 'hash') {
      setHashMutationField(inspectResult.entries[0]?.field ?? '');
      setHashMutationValue('');
    }
  }, [inspectResult?.key, inspectResult?.type]);

  useEffect(() => {
    if (inspectResult?.type !== 'string' || !inspectResult.view) {
      return;
    }
    const preview = stringPreviewRef.current;
    if (!preview) {
      return;
    }
    preview.scrollTop = stringPreviewScrollByMode.current[inspectResult.view.activeMode];
  }, [inspectResult?.type, stringPreviewValue, inspectResult?.view]);

  useEffect(() => {
    try {
      window.localStorage.setItem(DECODE_PIPELINE_PREFERENCE_KEY, preferredDecodePipelineId);
    } catch {
      // Ignore preference persistence errors in constrained renderer environments.
    }
  }, [preferredDecodePipelineId]);

  useEffect(() => {
    if (!inspectorApiAvailable || !redisInspectApi?.onProgress || !redisInspectApi?.onDone) {
      return;
    }

    const unsubscribeProgress = redisInspectApi.onProgress((event: RedisInspectProgressEvent) => {
      if (!inspectJobIdRef.current || event.jobId !== inspectJobIdRef.current) {
        return;
      }
      setInspectResult(event.result);
      setInspectMessage('Inspecting key…');
    });

    const unsubscribeDone = redisInspectApi.onDone((event: RedisInspectDoneEvent) => {
      if (!inspectJobIdRef.current || event.jobId !== inspectJobIdRef.current) {
        return;
      }
      inspectJobIdRef.current = null;
      setInspectJobId(null);
      if (event.result) {
        setInspectResult(event.result);
      }
      if (event.status === 'error') {
        setInspectMessage(event.error?.message ?? 'Inspect failed.');
      } else if (event.status === 'cancelled') {
        setInspectMessage('Inspect cancelled.');
      } else {
        setInspectMessage('Inspect complete.');
      }
    });

    return () => {
      unsubscribeProgress();
      unsubscribeDone();
    };
  }, [inspectorApiAvailable, redisInspectApi]);

  const startSearch = async () => {
    if (!canSearch || !redisKeysApi?.startSearch) {
      return;
    }

    const prefixCandidate = (selectedPrefix ?? manualPrefix).trim();
    const payload = {
      query: query.trim() || undefined,
      prefix: prefixCandidate || undefined,
    };

    setSurfaceMessage(null);
    setKeys([]);
    setScannedCount(0);
    setEmittedCount(0);
    setCapReached(false);

    const response = await redisKeysApi.startSearch(payload);
    if ('error' in response) {
      setSurfaceMessage(response.error.message);
      return;
    }
    setRunningJobId(response.data.jobId);
    setSurfaceMessage('Search started.');
  };

  const cancelSearch = async () => {
    if (!runningJobId || !jobsApi?.cancel) {
      return;
    }
    await jobsApi.cancel({ jobId: runningJobId });
  };

  const startInspect = async (
    key: string,
    revealMode: 'redacted' | 'revealed' = 'redacted',
    viewMode: 'raw' | 'formatted' = 'raw',
    decodePipelineId: InspectorDecodePipelineId = viewMode === 'formatted'
      ? JSON_PRETTY_PIPELINE
      : DEFAULT_DECODE_PIPELINE,
  ) => {
    if (!inspectorApiAvailable || !redisInspectApi?.start) {
      return;
    }
    const response = await redisInspectApi.start({ key, revealMode, viewMode, decodePipelineId });
    if ('error' in response) {
      setInspectMessage(response.error.message);
      return;
    }
    setRevealConfirmPending(false);
    setCopyConfirmRevealed(false);
    setCopyMessage(null);
    setInspectedKey(key);
    setInspectResult(null);
    inspectJobIdRef.current = response.data.jobId;
    setInspectMessage(
      revealMode === 'revealed'
        ? 'Reveal requested. Inspect started.'
        : viewMode === 'formatted'
          ? 'Formatted inspect started.'
          : 'Inspect started.',
    );
    setInspectJobId(response.data.jobId);
  };

  const cancelInspect = async () => {
    if (!inspectJobId || !jobsApi?.cancel) {
      return;
    }
    await jobsApi.cancel({ jobId: inspectJobId });
  };

  const refreshInspectAfterMutation = () => {
    if (!inspectedKey) {
      return;
    }
    void startInspect(
      inspectedKey,
      'redacted',
      decodePipelineToViewMode(preferredDecodePipelineId),
      preferredDecodePipelineId,
    );
  };

  const runRedisMutation = async (
    action: () => Promise<{ ok: true; data: unknown } | { ok: false; error: { message: string } }>,
    successMessage: string,
  ) => {
    setRedisMutationPending(true);
    setRedisMutationMessage(null);
    try {
      const response = await action();
      if ('error' in response) {
        setRedisMutationMessage(response.error.message);
        return;
      }
      setRedisMutationMessage(successMessage);
      refreshInspectAfterMutation();
    } finally {
      setRedisMutationPending(false);
    }
  };

  const mutateString = async () => {
    if (!inspectResult || inspectResult.type !== 'string' || !redisMutationsApi?.stringSet) {
      return;
    }
    await runRedisMutation(
      () =>
        redisMutationsApi.stringSet({
          key: inspectResult.key,
          value: stringMutationValue,
        }),
      'String value updated.',
    );
  };

  const mutateHashField = async () => {
    if (!inspectResult || inspectResult.type !== 'hash' || !redisMutationsApi?.hashSetField) {
      return;
    }
    await runRedisMutation(
      () =>
        redisMutationsApi.hashSetField({
          key: inspectResult.key,
          field: hashMutationField,
          value: hashMutationValue,
        }),
      'Hash field updated.',
    );
  };

  const mutateListPush = async () => {
    if (!inspectResult || inspectResult.type !== 'list' || !redisMutationsApi?.listPush) {
      return;
    }
    await runRedisMutation(
      () =>
        redisMutationsApi.listPush({
          key: inspectResult.key,
          value: listMutationValue,
          direction: listDirection,
        }),
      listDirection === 'left' ? 'List value prepended.' : 'List value appended.',
    );
  };

  const mutateSetAdd = async () => {
    if (!inspectResult || inspectResult.type !== 'set' || !redisMutationsApi?.setAdd) {
      return;
    }
    await runRedisMutation(
      () =>
        redisMutationsApi.setAdd({
          key: inspectResult.key,
          member: setMutationMember,
        }),
      'Set member added (or already present).',
    );
  };

  const mutateZSetAdd = async () => {
    if (!inspectResult || inspectResult.type !== 'zset' || !redisMutationsApi?.zsetAdd) {
      return;
    }
    const parsedScore = Number.parseFloat(zsetMutationScore);
    if (!Number.isFinite(parsedScore)) {
      setRedisMutationMessage('Provide a valid numeric score.');
      return;
    }
    await runRedisMutation(
      () =>
        redisMutationsApi.zsetAdd({
          key: inspectResult.key,
          member: zsetMutationMember,
          score: parsedScore,
        }),
      'Sorted set member written.',
    );
  };

  const mutateStreamAdd = async () => {
    if (!inspectResult || inspectResult.type !== 'stream' || !redisMutationsApi?.streamAdd) {
      return;
    }
    const parsed = parseStreamEntries(streamMutationEntries);
    if (!parsed.ok) {
      setRedisMutationMessage(parsed.error);
      return;
    }
    await runRedisMutation(
      () =>
        redisMutationsApi.streamAdd({
          key: inspectResult.key,
          entries: parsed.entries,
        }),
      'Stream entry added.',
    );
  };

  const deleteRedisKey = async () => {
    if (!inspectedKey || !redisMutationsApi?.keyDelete) {
      return;
    }
    const keyToDelete = inspectedKey;
    setRedisMutationPending(true);
    setRedisMutationMessage(null);
    try {
      const response = await redisMutationsApi.keyDelete({
        key: keyToDelete,
      });
      if ('error' in response) {
        setRedisMutationMessage(response.error.message);
        return;
      }
      if (response.data.deleted) {
        setKeys((previous) => previous.filter((item) => item.key !== keyToDelete));
      }
      setRedisMutationMessage(
        response.data.deleted ? 'Key deleted.' : 'Key was not found; nothing deleted.',
      );
      refreshInspectAfterMutation();
      setDeleteConfirmPending(false);
    } finally {
      setRedisMutationPending(false);
    }
  };

  const copyInspectedValue = async (copyMode: 'safeRedacted' | 'explicitRevealed') => {
    if (!inspectResult || !redisInspectApi?.copy) {
      return;
    }
    const response = await redisInspectApi.copy({
      result: inspectResult,
      copyMode,
    });
    if ('error' in response) {
      setCopyMessage(response.error.message);
      return;
    }
    setCopyConfirmRevealed(false);
    setCopyMessage(
      response.data.modeUsed === 'safeRedacted'
        ? 'Copied safe-redacted value to clipboard.'
        : 'Copied revealed value to clipboard.',
    );
  };

  const fetchMemcachedByKey = async () => {
    if (!memcachedApiAvailable || !memcachedApi?.get || memcachedKey.trim().length === 0) {
      return;
    }
    setMemcachedLoading(true);
    setMemcachedMessage(null);
    const response = await memcachedApi.get({ key: memcachedKey.trim() });
    if ('error' in response) {
      setMemcachedMessage(response.error.message);
      setMemcachedResult(null);
      setMemcachedLoading(false);
      return;
    }
    setMemcachedResult(response.data);
    setMemcachedMessage(response.data.found ? 'Value fetched.' : 'Key not found.');
    setMemcachedLoading(false);
  };

  const refreshMemcachedStats = async () => {
    if (!memcachedApiAvailable || !memcachedApi?.getStats) {
      return;
    }
    setMemcachedLoading(true);
    setMemcachedMessage(null);
    const response = await memcachedApi.getStats();
    if ('error' in response) {
      setMemcachedMessage(response.error.message);
      setMemcachedStats(null);
      setMemcachedLoading(false);
      return;
    }
    setMemcachedStats(response.data);
    setMemcachedMessage(`Stats refreshed at ${new Date(response.data.fetchedAt).toLocaleTimeString()}.`);
    setMemcachedLoading(false);
  };

  const setMemcachedByKey = async () => {
    if (!memcachedSetAvailable || !memcachedApi?.set || memcachedKey.trim().length === 0) {
      return;
    }

    const nextFlags = memcachedSetFlags.trim();
    const nextTtl = memcachedSetTtlSeconds.trim();
    const parsedFlags = nextFlags.length > 0 ? Number.parseInt(nextFlags, 10) : undefined;
    const parsedTtl = nextTtl.length > 0 ? Number.parseInt(nextTtl, 10) : undefined;
    if ((nextFlags.length > 0 && !Number.isInteger(parsedFlags)) || (parsedFlags ?? 0) < 0) {
      setMemcachedMessage('Flags must be a non-negative integer.');
      return;
    }
    if ((nextTtl.length > 0 && !Number.isInteger(parsedTtl)) || (parsedTtl ?? 0) < 0) {
      setMemcachedMessage('TTL seconds must be a non-negative integer.');
      return;
    }

    setMemcachedLoading(true);
    setMemcachedMessage(null);
    const response = await memcachedApi.set({
      key: memcachedKey.trim(),
      value: memcachedSetValue,
      ...(parsedFlags !== undefined ? { flags: parsedFlags } : {}),
      ...(parsedTtl !== undefined ? { ttlSeconds: parsedTtl } : {}),
    });

    if ('error' in response) {
      setMemcachedMessage(response.error.message);
      setMemcachedLoading(false);
      return;
    }

    const data = response.data as MemcachedSetData;
    setMemcachedMessage(
      data.stored
        ? `Value stored (${data.bytes} bytes).`
        : 'Memcached did not store this value.',
    );
    if (memcachedApi?.get) {
      const refetch = await memcachedApi.get({ key: memcachedKey.trim() });
      if ('data' in refetch) {
        setMemcachedResult(refetch.data);
      }
    }
    setMemcachedLoading(false);
  };

  const revealMode = inspectResult?.reveal?.mode ?? 'redacted';
  const revealModeForViewChange = revealMode === 'revealed' ? 'redacted' : revealMode;
  const activeViewMode = inspectResult?.view?.activeMode ?? 'raw';
  const requestedDecodePipelineId =
    inspectResult?.decode?.requestedPipelineId ?? preferredDecodePipelineId;
  const canReveal = inspectResult?.reveal?.canReveal ?? false;
  const redisMutationUnlocked = connectionStatus.safetyMode === 'unlocked';
  const redisMutationBlockedReason =
    connectionStatus.safetyReason ??
    'Mutations are blocked while in read-only mode. Unlock mutations to continue.';
  const redisMutationControlsDisabled =
    !redisMutationsApiAvailable ||
    !inspectResult ||
    Boolean(inspectJobId) ||
    redisMutationPending ||
    connectionStatus.state !== 'connected' ||
    connectionStatus.activeKind !== 'redis' ||
    !redisMutationUnlocked;
  const memcachedSetControlsDisabled =
    !canUseMemcached ||
    !memcachedSetAvailable ||
    memcachedLoading ||
    memcachedKey.trim().length === 0 ||
    memcachedSetValue.length === 0 ||
    connectionStatus.safetyMode !== 'unlocked';

  return (
    <section className='grid gap-4 rounded-xl border border-border bg-card p-4'>
      <header className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <p className='text-xs uppercase tracking-[0.12em] text-muted-foreground'>Explorer</p>
          <h2 className='text-xl font-semibold'>Redis key discovery</h2>
        </div>
        <div className='flex items-center gap-2'>
          <Badge variant='outline'>
            {runningJobId ? 'In progress' : 'Idle'}
          </Badge>
          {capReached ? <Badge variant='secondary'>Limit reached</Badge> : null}
        </div>
      </header>

      {!explorerApiAvailable ? (
        <p className='text-sm text-muted-foreground'>
          Explorer bridge is unavailable in this environment.
        </p>
      ) : (
        <>
          <div className='grid gap-3 md:grid-cols-[1.6fr_1fr_auto_auto] md:items-end'>
            <div className='grid gap-2'>
              <Label htmlFor='redis-key-search'>Search substring or pattern</Label>
              <Input
                id='redis-key-search'
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder='session:* or customer:42'
              />
            </div>
            <div className='grid gap-2'>
              <Label htmlFor='redis-key-prefix'>Prefix</Label>
              <Input
                id='redis-key-prefix'
                value={manualPrefix}
                onChange={(event) => {
                  setManualPrefix(event.target.value);
                  setSelectedPrefix(null);
                }}
                placeholder='service:payments'
              />
            </div>
            <Button
              onClick={() => {
                void startSearch();
              }}
              disabled={!canSearch || Boolean(runningJobId)}
            >
              Start search
            </Button>
            <Button
              variant='outline'
              onClick={() => {
                void cancelSearch();
              }}
              disabled={!runningJobId}
            >
              Cancel
            </Button>
          </div>

          <div className='flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
            <span>
              {canSearch
                ? 'Connected to Redis.'
                : 'Connect an active Redis profile to run key discovery.'}
            </span>
            <span>Scanned: {scannedCount}</span>
            <span>Emitted: {emittedCount}</span>
          </div>

          {prefixOptions.length > 0 ? (
            <div className='flex flex-wrap items-center gap-2'>
              <span className='text-xs uppercase tracking-[0.12em] text-muted-foreground'>
                Prefix browse
              </span>
              {prefixOptions.map((prefix) => (
                <Button
                  key={prefix}
                  size='sm'
                  variant={selectedPrefix === prefix ? 'secondary' : 'outline'}
                  onClick={() => {
                    setSelectedPrefix(prefix);
                    setManualPrefix(prefix);
                  }}
                >
                  {prefix}
                </Button>
              ))}
              <Button
                size='sm'
                variant='ghost'
                onClick={() => {
                  setSelectedPrefix(null);
                  setManualPrefix('');
                }}
              >
                Clear prefix
              </Button>
            </div>
          ) : null}

          <div className='rounded-md border border-border p-3 text-sm'>
            {surfaceMessage ? (
              <p className='mb-2'>{surfaceMessage}</p>
            ) : (
              <p className='mb-2 text-muted-foreground'>
                Run a search to stream keys progressively.
              </p>
            )}
            <div className='max-h-64 overflow-auto' data-testid='redis-keys-list'>
              {visibleKeys.length > 0 ? (
                <ul className='space-y-1'>
                  {visibleKeys.map((item) => (
                    <li
                      key={item.key}
                      className='flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-muted/40 px-2 py-1'
                    >
                      <code className='text-xs'>{item.key}</code>
                      <Badge variant='outline'>{resolveTypeLabel(item)}</Badge>
                      <Badge variant='outline'>{resolveTtlLabel(item)}</Badge>
                      <Button
                        size='sm'
                        variant='outline'
                        onClick={() => {
                          void startInspect(
                            item.key,
                            'redacted',
                            decodePipelineToViewMode(preferredDecodePipelineId),
                            preferredDecodePipelineId,
                          );
                        }}
                        disabled={!inspectorApiAvailable || Boolean(inspectJobId)}
                      >
                        Inspect
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className='text-xs text-muted-foreground'>No keys discovered yet.</p>
              )}
            </div>
          </div>

          <div className='rounded-md border border-border p-3 text-sm' data-testid='redis-inspector-panel'>
            <div className='mb-2 flex flex-wrap items-center justify-between gap-2'>
              <div className='flex flex-wrap items-center gap-2'>
                <span className='text-xs uppercase tracking-[0.12em] text-muted-foreground'>
                  Inspector
                </span>
                {inspectedKey ? <code className='text-xs'>{inspectedKey}</code> : null}
                {inspectResult ? (
                  <Badge variant='outline'>type: {inspectResult.type}</Badge>
                ) : null}
                {inspectResult ? (
                  <Badge variant='outline'>TTL: {resolveInspectorTtlLabel(inspectResult.ttlSeconds)}</Badge>
                ) : null}
                {inspectResult?.capReached ? (
                  <Badge variant='secondary'>Cap reached</Badge>
                ) : null}
                {inspectResult ? (
                  <Badge variant={inspectResult.redaction.redactionApplied ? 'secondary' : 'outline'}>
                    {inspectResult.redaction.redactionApplied ? 'Redaction active' : 'Redaction default'}
                  </Badge>
                ) : null}
                {inspectResult ? (
                  <Badge variant='outline' title={inspectResult.redaction.policySummary}>
                    {inspectResult.redaction.policyId}@{inspectResult.redaction.policyVersion}
                  </Badge>
                ) : null}
                {inspectResult?.view ? (
                  <Badge variant='outline'>view: {inspectResult.view.activeMode}</Badge>
                ) : null}
                {inspectResult?.decode ? (
                  <Badge variant='outline'>decode: {inspectResult.decode.activePipelineLabel}</Badge>
                ) : null}
                {inspectResult?.reveal?.mode === 'revealed' ? (
                  <Badge variant='secondary'>Revealed</Badge>
                ) : null}
              </div>
              <div className='flex items-center gap-2'>
                {inspectResult?.view ? (
                  <>
                    <Button
                      size='sm'
                      variant={inspectResult.view.activeMode === 'raw' ? 'secondary' : 'outline'}
                      onClick={() => {
                        if (!inspectedKey) {
                          return;
                        }
                        setPreferredDecodePipelineId(DEFAULT_DECODE_PIPELINE);
                        if (inspectResult.type === 'string' && stringPreviewRef.current) {
                          stringPreviewScrollByMode.current[activeViewMode] =
                            stringPreviewRef.current.scrollTop;
                        }
                        void startInspect(
                          inspectedKey,
                          revealModeForViewChange,
                          'raw',
                          DEFAULT_DECODE_PIPELINE,
                        );
                      }}
                      disabled={Boolean(inspectJobId)}
                    >
                      Raw
                    </Button>
                    <Button
                      size='sm'
                      variant={inspectResult.view.activeMode === 'formatted' ? 'secondary' : 'outline'}
                      onClick={() => {
                        if (!inspectedKey) {
                          return;
                        }
                        setPreferredDecodePipelineId(JSON_PRETTY_PIPELINE);
                        if (inspectResult.type === 'string' && stringPreviewRef.current) {
                          stringPreviewScrollByMode.current[activeViewMode] =
                            stringPreviewRef.current.scrollTop;
                        }
                        void startInspect(
                          inspectedKey,
                          revealModeForViewChange,
                          'formatted',
                          JSON_PRETTY_PIPELINE,
                        );
                      }}
                      disabled={Boolean(inspectJobId)}
                    >
                      Formatted
                    </Button>
                  </>
                ) : null}
                {inspectResult && canReveal ? (
                  inspectResult.reveal?.mode === 'revealed' ? (
                    <Button
                      size='sm'
                      variant='secondary'
                      aria-pressed='true'
                      onClick={() => {
                        if (inspectedKey) {
                          void startInspect(
                            inspectedKey,
                            'redacted',
                            activeViewMode,
                            requestedDecodePipelineId,
                          );
                        }
                      }}
                      disabled={Boolean(inspectJobId)}
                    >
                      Re-hide
                    </Button>
                  ) : (
                    <Button
                      size='sm'
                      variant='outline'
                      aria-pressed='false'
                      onClick={() => {
                        setRevealConfirmPending(true);
                      }}
                      disabled={Boolean(inspectJobId)}
                    >
                      Reveal sensitive preview
                    </Button>
                  )
                ) : null}
                {inspectResult ? (
                  <Button
                    size='sm'
                    variant='outline'
                    onClick={() => {
                      void copyInspectedValue('safeRedacted');
                    }}
                    disabled={Boolean(inspectJobId) || !redisInspectApi?.copy}
                  >
                    Copy safe
                  </Button>
                ) : null}
                {inspectResult?.reveal?.mode === 'revealed' ? (
                  <Button
                    size='sm'
                    variant='secondary'
                    onClick={() => {
                      setCopyConfirmRevealed(true);
                    }}
                    disabled={Boolean(inspectJobId) || !redisInspectApi?.copy}
                  >
                    Copy revealed
                  </Button>
                ) : null}
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() => {
                    void cancelInspect();
                  }}
                  disabled={!inspectJobId}
                >
                  Cancel inspect
                </Button>
              </div>
            </div>

            {revealConfirmPending && revealMode === 'redacted' ? (
              <div className='mb-2 flex flex-wrap items-center gap-2 rounded border border-amber-500/40 bg-amber-50 p-2 text-xs text-amber-900'>
                <span>
                  Confirm reveal for this key. Revealed values auto-reset on key change,
                  view switch, navigation, disconnect, and safety relock.
                </span>
                <Button
                  size='sm'
                  variant='secondary'
                  onClick={() => {
                    if (inspectedKey) {
                      void startInspect(
                        inspectedKey,
                        'revealed',
                        activeViewMode,
                        requestedDecodePipelineId,
                      );
                    }
                  }}
                  disabled={!inspectedKey || Boolean(inspectJobId)}
                >
                  Confirm reveal
                </Button>
                <Button
                  size='sm'
                  variant='ghost'
                  onClick={() => {
                    setRevealConfirmPending(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            ) : null}

            {copyConfirmRevealed && inspectResult?.reveal?.mode === 'revealed' ? (
              <div className='mb-2 flex flex-wrap items-center gap-2 rounded border border-amber-500/40 bg-amber-50 p-2 text-xs text-amber-900'>
                <span>
                  Confirm copying revealed content. Safe copy remains the default for sharing.
                </span>
                <Button
                  size='sm'
                  variant='secondary'
                  onClick={() => {
                    void copyInspectedValue('explicitRevealed');
                  }}
                  disabled={Boolean(inspectJobId) || !redisInspectApi?.copy}
                >
                  Confirm revealed copy
                </Button>
                <Button
                  size='sm'
                  variant='ghost'
                  onClick={() => {
                    setCopyConfirmRevealed(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            ) : null}

            {inspectMessage ? (
              <p className='mb-2 text-xs text-muted-foreground'>{inspectMessage}</p>
            ) : null}
            {copyMessage ? (
              <p className='mb-2 text-xs text-emerald-700'>{copyMessage}</p>
            ) : null}
            {inspectResult ? (
              <div className='mb-3 grid gap-2 rounded border border-border/70 bg-muted/30 p-3' data-testid='redis-mutation-panel'>
                <p className='text-xs uppercase tracking-[0.12em] text-muted-foreground'>
                  Mutation controls
                </p>
                {!redisMutationUnlocked ? (
                  <p className='text-xs text-amber-700' role='alert'>
                    Mutations blocked: {redisMutationBlockedReason}
                  </p>
                ) : (
                  <p className='text-xs text-emerald-700'>
                    Mutations unlocked. Changes apply immediately.
                  </p>
                )}
                {redisMutationMessage ? (
                  <p className='text-xs text-muted-foreground'>{redisMutationMessage}</p>
                ) : null}

                {inspectResult.type === 'string' ? (
                  <div className='grid gap-2 md:grid-cols-[1fr_auto] md:items-end'>
                    <div className='grid gap-1'>
                      <Label htmlFor='redis-string-mutation-value'>Set string value</Label>
                      <Input
                        id='redis-string-mutation-value'
                        value={stringMutationValue}
                        onChange={(event) => setStringMutationValue(event.target.value)}
                        placeholder='New string value'
                      />
                    </div>
                    <Button
                      onClick={() => {
                        void mutateString();
                      }}
                      disabled={redisMutationControlsDisabled}
                    >
                      Set string value
                    </Button>
                  </div>
                ) : null}

                {inspectResult.type === 'hash' ? (
                  <div className='grid gap-2 md:grid-cols-[1fr_1fr_auto] md:items-end'>
                    <div className='grid gap-1'>
                      <Label htmlFor='redis-hash-mutation-field'>Hash field</Label>
                      <Input
                        id='redis-hash-mutation-field'
                        value={hashMutationField}
                        onChange={(event) => setHashMutationField(event.target.value)}
                        placeholder='field'
                      />
                    </div>
                    <div className='grid gap-1'>
                      <Label htmlFor='redis-hash-mutation-value'>Field value</Label>
                      <Input
                        id='redis-hash-mutation-value'
                        value={hashMutationValue}
                        onChange={(event) => setHashMutationValue(event.target.value)}
                        placeholder='value'
                      />
                    </div>
                    <Button
                      onClick={() => {
                        void mutateHashField();
                      }}
                      disabled={redisMutationControlsDisabled || hashMutationField.trim().length === 0}
                    >
                      Set hash field
                    </Button>
                  </div>
                ) : null}

                {inspectResult.type === 'list' ? (
                  <div className='grid gap-2 md:grid-cols-[1fr_auto_auto] md:items-end'>
                    <div className='grid gap-1'>
                      <Label htmlFor='redis-list-mutation-value'>List value</Label>
                      <Input
                        id='redis-list-mutation-value'
                        value={listMutationValue}
                        onChange={(event) => setListMutationValue(event.target.value)}
                        placeholder='value'
                      />
                    </div>
                    <Button
                      variant={listDirection === 'left' ? 'secondary' : 'outline'}
                      onClick={() => setListDirection('left')}
                      disabled={redisMutationControlsDisabled}
                    >
                      Direction: left
                    </Button>
                    <Button
                      variant={listDirection === 'right' ? 'secondary' : 'outline'}
                      onClick={() => setListDirection('right')}
                      disabled={redisMutationControlsDisabled}
                    >
                      Direction: right
                    </Button>
                    <Button
                      onClick={() => {
                        void mutateListPush();
                      }}
                      disabled={redisMutationControlsDisabled}
                    >
                      Push list value
                    </Button>
                  </div>
                ) : null}

                {inspectResult.type === 'set' ? (
                  <div className='grid gap-2 md:grid-cols-[1fr_auto] md:items-end'>
                    <div className='grid gap-1'>
                      <Label htmlFor='redis-set-mutation-member'>Set member</Label>
                      <Input
                        id='redis-set-mutation-member'
                        value={setMutationMember}
                        onChange={(event) => setSetMutationMember(event.target.value)}
                        placeholder='member'
                      />
                    </div>
                    <Button
                      onClick={() => {
                        void mutateSetAdd();
                      }}
                      disabled={redisMutationControlsDisabled || setMutationMember.trim().length === 0}
                    >
                      Add set member
                    </Button>
                  </div>
                ) : null}

                {inspectResult.type === 'zset' ? (
                  <div className='grid gap-2 md:grid-cols-[1fr_1fr_auto] md:items-end'>
                    <div className='grid gap-1'>
                      <Label htmlFor='redis-zset-mutation-member'>ZSet member</Label>
                      <Input
                        id='redis-zset-mutation-member'
                        value={zsetMutationMember}
                        onChange={(event) => setZsetMutationMember(event.target.value)}
                        placeholder='member'
                      />
                    </div>
                    <div className='grid gap-1'>
                      <Label htmlFor='redis-zset-mutation-score'>Score</Label>
                      <Input
                        id='redis-zset-mutation-score'
                        value={zsetMutationScore}
                        onChange={(event) => setZsetMutationScore(event.target.value)}
                        placeholder='1.5'
                      />
                    </div>
                    <Button
                      onClick={() => {
                        void mutateZSetAdd();
                      }}
                      disabled={redisMutationControlsDisabled || zsetMutationMember.trim().length === 0}
                    >
                      Add zset member
                    </Button>
                  </div>
                ) : null}

                {inspectResult.type === 'stream' ? (
                  <div className='grid gap-2'>
                    <Label htmlFor='redis-stream-mutation-entries'>Stream entries (field=value per line)</Label>
                    <textarea
                      id='redis-stream-mutation-entries'
                      className='min-h-20 rounded border border-border bg-background px-3 py-2 text-xs'
                      value={streamMutationEntries}
                      onChange={(event) => setStreamMutationEntries(event.target.value)}
                      placeholder={'event=created\nid=42'}
                    />
                    <div className='flex justify-end'>
                      <Button
                        onClick={() => {
                          void mutateStreamAdd();
                        }}
                        disabled={redisMutationControlsDisabled}
                      >
                        Add stream entry
                      </Button>
                    </div>
                  </div>
                ) : null}

                {inspectResult.type !== 'none' ? (
                  <div className='grid gap-2 rounded border border-destructive/30 bg-destructive/5 p-2'>
                    {!deleteConfirmPending ? (
                      <div className='flex items-center justify-between gap-2'>
                        <span className='text-xs text-muted-foreground'>
                          High impact: deleting this key is irreversible.
                        </span>
                        <Button
                          variant='destructive'
                          onClick={() => setDeleteConfirmPending(true)}
                          disabled={redisMutationControlsDisabled}
                        >
                          Delete key
                        </Button>
                      </div>
                    ) : (
                      <div className='flex flex-wrap items-center gap-2'>
                        <span className='text-xs text-destructive'>
                          Confirm delete for <code>{inspectResult.key}</code>
                        </span>
                        <Button
                          variant='destructive'
                          onClick={() => {
                            void deleteRedisKey();
                          }}
                          disabled={redisMutationControlsDisabled}
                        >
                          Confirm delete
                        </Button>
                        <Button
                          variant='outline'
                          onClick={() => setDeleteConfirmPending(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}
            {inspectResult ? (
              <p className='mb-2 text-xs text-muted-foreground'>
                {inspectResult.redaction.redactionApplied
                  ? `Redacted ${inspectResult.redaction.redactedSegments} sensitive segment(s).`
                  : 'Redaction policy active; no sensitive segments matched this preview.'}
              </p>
            ) : null}
            {inspectResult?.view?.requestedMode === 'formatted' &&
            !inspectResult.view.formattedAvailable ? (
              <div className='mb-2 grid gap-2 rounded border border-amber-500/30 bg-amber-50 p-2 text-xs text-amber-900'>
                <p>
                  {resolveFormattedUnavailableReason(inspectResult.view.formattedUnavailableReason)}
                </p>
                <p>
                  {inspectResult.decode?.stage.message ??
                    'Decode fallback applied. Use a safe fallback action below.'}
                </p>
                <div className='flex flex-wrap items-center gap-2'>
                  <Button
                    size='sm'
                    variant='outline'
                    onClick={() => {
                      if (!inspectedKey) {
                        return;
                      }
                      setPreferredDecodePipelineId(DEFAULT_DECODE_PIPELINE);
                      void startInspect(
                        inspectedKey,
                        revealModeForViewChange,
                        'raw',
                        DEFAULT_DECODE_PIPELINE,
                      );
                    }}
                    disabled={Boolean(inspectJobId) || !inspectedKey}
                  >
                    Use Raw text
                  </Button>
                  <Button
                    size='sm'
                    variant='outline'
                    onClick={() => {
                      if (!inspectedKey) {
                        return;
                      }
                      setPreferredDecodePipelineId(JSON_PRETTY_PIPELINE);
                      void startInspect(
                        inspectedKey,
                        revealModeForViewChange,
                        'formatted',
                        JSON_PRETTY_PIPELINE,
                      );
                    }}
                    disabled={Boolean(inspectJobId) || !inspectedKey}
                  >
                    Try JSON pretty
                  </Button>
                  <span>Need to share now? Use Copy safe for a redacted export.</span>
                </div>
              </div>
            ) : null}

            {!inspectResult ? (
              <p className='text-xs text-muted-foreground'>
                Choose a key and run inspect to preview value content safely.
              </p>
            ) : null}

            {inspectResult?.type === 'string' ? (
              <div className='grid gap-2'>
                <p className='text-xs text-muted-foreground'>
                  Bytes: {inspectResult.byteLength} · Fetched count: {inspectResult.fetchedCount}
                </p>
                <p className='text-xs text-muted-foreground'>
                  Preview bytes: {inspectResult.previewBytes}
                </p>
                {inspectResult.capReason === 'STRING_PREVIEW_LIMIT' ? (
                  <p className='text-xs text-amber-700'>
                    Too large to preview safely. Showing a partial preview.
                  </p>
                ) : null}
                {inspectResult.capReason === 'FORMATTED_DEPTH_LIMIT' ? (
                  <p className='text-xs text-amber-700'>
                    Formatted depth collapsed at {inspectResult.maxDepthApplied ?? 20} levels to
                    keep rendering responsive.
                  </p>
                ) : null}
                <pre
                  ref={stringPreviewRef}
                  data-testid='redis-string-preview'
                  className='max-h-56 overflow-auto rounded border border-border/60 bg-muted/50 p-2 text-xs'
                >
                  {inspectResult.value}
                </pre>
              </div>
            ) : null}

            {inspectResult?.type === 'hash' ? (
              <div className='grid gap-2'>
                <p className='text-xs text-muted-foreground'>
                  Fields: {inspectResult.fetchedCount}
                  {inspectResult.totalFields != null ? ` / ${inspectResult.totalFields}` : ''} ·
                  {inspectResult.hasMore ? ' partial' : ' complete'}
                </p>
                <div className='max-h-56 overflow-auto rounded border border-border/60 bg-muted/50 p-2'>
                  <table className='w-full text-xs'>
                    <thead>
                      <tr className='text-left text-muted-foreground'>
                        <th className='py-1 pr-2'>Field</th>
                        <th className='py-1'>Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inspectResult.entries.map((entry) => (
                        <tr key={`${entry.field}-${entry.value}`}>
                          <td className='py-1 pr-2 align-top'>
                            <code>{entry.field}</code>
                          </td>
                          <td className='py-1 align-top'>
                            <code>{entry.value}</code>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {inspectResult.capReason ? (
                  <p className='text-xs text-muted-foreground'>
                    Cap reason: {inspectResult.capReason}
                  </p>
                ) : null}
              </div>
            ) : null}

            {(inspectResult?.type === 'list' ||
              inspectResult?.type === 'set' ||
              inspectResult?.type === 'zset') ? (
              <div className='grid gap-2'>
                <p className='text-xs text-muted-foreground'>
                  Items: {inspectResult.fetchedCount}
                  {inspectResult.totalCount != null ? ` / ${inspectResult.totalCount}` : ''} ·
                  {inspectResult.hasMore ? ' partial' : ' complete'} · ordering:{' '}
                  {inspectResult.ordering}
                </p>
                <div className='max-h-56 overflow-auto rounded border border-border/60 bg-muted/50 p-2'>
                  <table className='w-full text-xs'>
                    <thead>
                      <tr className='text-left text-muted-foreground'>
                        <th className='py-1 pr-2'>Value</th>
                        {inspectResult.type === 'zset' ? <th className='py-1'>Score</th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {inspectResult.items.map((item, index) => (
                        <tr key={`${item.value}-${index}`}>
                          <td className='py-1 pr-2 align-top'>
                            <code>{item.value}</code>
                          </td>
                          {inspectResult.type === 'zset' ? (
                            <td className='py-1 align-top'>
                              <code>{item.score ?? 'n/a'}</code>
                            </td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {inspectResult.capReached ? (
                  <p className='text-xs text-muted-foreground'>
                    Large result truncated safely. Export raw/partial later for full capture.
                  </p>
                ) : null}
              </div>
            ) : null}

            {inspectResult?.type === 'stream' ? (
              <div className='grid gap-2'>
                <p className='text-xs text-muted-foreground'>
                  Entries: {inspectResult.fetchedCount}
                  {inspectResult.totalCount != null ? ` / ${inspectResult.totalCount}` : ''} ·
                  {inspectResult.truncated ? ' truncated' : ' complete'}
                </p>
                <div className='max-h-56 overflow-auto rounded border border-border/60 bg-muted/50 p-2'>
                  <table className='w-full text-xs'>
                    <thead>
                      <tr className='text-left text-muted-foreground'>
                        <th className='py-1 pr-2'>Entry ID</th>
                        <th className='py-1'>Fields</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inspectResult.entries.map((entry) => (
                        <tr key={entry.id}>
                          <td className='py-1 pr-2 align-top'>
                            <code>{entry.id}</code>
                          </td>
                          <td className='py-1 align-top'>
                            <div className='grid gap-1'>
                              {entry.fields.map((field) => (
                                <div key={`${entry.id}-${field.field}`}>
                                  <code>{field.field}</code>: <code>{field.value}</code>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {inspectResult.truncated ? (
                  <p className='text-xs text-muted-foreground'>
                    Stream output is truncated for safety. Refine scope or export for deeper inspection.
                  </p>
                ) : null}
              </div>
            ) : null}

            {inspectResult?.type === 'none' ? (
              <p className='text-xs text-muted-foreground'>{inspectResult.reason}</p>
            ) : null}
          </div>
        </>
      )}

      <div className='rounded-md border border-border p-3 text-sm' data-testid='memcached-panel'>
        <div className='mb-2 flex flex-wrap items-center justify-between gap-2'>
          <div>
            <p className='text-xs uppercase tracking-[0.12em] text-muted-foreground'>Memcached</p>
            <h3 className='text-base font-semibold'>Key + stats quick view</h3>
          </div>
        </div>

        {!memcachedApiAvailable ? (
          <p className='text-xs text-muted-foreground'>Memcached API bridge is unavailable.</p>
        ) : (
          <div className='grid gap-3'>
            <div className='grid gap-3 md:grid-cols-[1.5fr_auto_auto] md:items-end'>
              <div className='grid gap-2'>
                <Label htmlFor='memcached-key-input'>Memcached key</Label>
                <Input
                  id='memcached-key-input'
                  value={memcachedKey}
                  onChange={(event) => setMemcachedKey(event.target.value)}
                  placeholder='session:42'
                />
              </div>
              <Button
                onClick={() => {
                  void fetchMemcachedByKey();
                }}
                disabled={!canUseMemcached || memcachedLoading || memcachedKey.trim().length === 0}
              >
                Fetch key
              </Button>
              <Button
                variant='outline'
                onClick={() => {
                  void refreshMemcachedStats();
                }}
                disabled={!canUseMemcached || memcachedLoading}
              >
                Refresh stats
              </Button>
            </div>
            <div className='grid gap-3 md:grid-cols-[1.5fr_0.6fr_0.6fr_auto] md:items-end'>
              <div className='grid gap-2'>
                <Label htmlFor='memcached-set-value'>Set value</Label>
                <Input
                  id='memcached-set-value'
                  value={memcachedSetValue}
                  onChange={(event) => setMemcachedSetValue(event.target.value)}
                  placeholder='updated value'
                />
              </div>
              <div className='grid gap-2'>
                <Label htmlFor='memcached-set-flags'>Flags</Label>
                <Input
                  id='memcached-set-flags'
                  value={memcachedSetFlags}
                  onChange={(event) => setMemcachedSetFlags(event.target.value)}
                  placeholder='0'
                />
              </div>
              <div className='grid gap-2'>
                <Label htmlFor='memcached-set-ttl'>TTL sec</Label>
                <Input
                  id='memcached-set-ttl'
                  value={memcachedSetTtlSeconds}
                  onChange={(event) => setMemcachedSetTtlSeconds(event.target.value)}
                  placeholder='0'
                />
              </div>
              <Button
                variant='secondary'
                onClick={() => {
                  void setMemcachedByKey();
                }}
                disabled={memcachedSetControlsDisabled}
              >
                Set key
              </Button>
            </div>

            <p className='text-xs text-muted-foreground'>
              {canUseMemcached
                ? 'Connected to Memcached.'
                : 'Connect an active Memcached profile to fetch values and stats.'}
            </p>
            {connectionStatus.safetyMode !== 'unlocked' && canUseMemcached ? (
              <p className='text-xs text-amber-700' role='alert'>
                Memcached writes are blocked: {connectionStatus.safetyReason ?? 'Unlock mutations to continue.'}
              </p>
            ) : null}

            {memcachedMessage ? (
              <p className='text-xs text-muted-foreground'>{memcachedMessage}</p>
            ) : null}

            {memcachedResult ? (
              <div className='rounded border border-border/60 bg-muted/40 p-2 text-xs'>
                <p>
                  <strong>{memcachedResult.key}</strong> · found:{' '}
                  {memcachedResult.found ? 'yes' : 'no'}
                </p>
                <p>
                  flags: {memcachedResult.flags ?? 'n/a'} · bytes: {memcachedResult.bytes ?? 'n/a'}
                </p>
                {memcachedResult.valuePreview != null ? (
                  <pre className='mt-2 max-h-48 overflow-auto rounded border border-border/60 bg-background/50 p-2'>
                    {memcachedResult.valuePreview}
                  </pre>
                ) : null}
                {memcachedResult.capReached ? (
                  <p className='mt-1 text-amber-700'>
                    Too large to preview safely. Showing a partial preview (
                    {memcachedResult.capReason ?? 'MEMCACHED_PREVIEW_LIMIT'}).
                  </p>
                ) : null}
                <p className='mt-1 text-muted-foreground'>
                  preview bytes: {memcachedResult.previewBytes}
                </p>
                <p className='mt-1 text-muted-foreground'>
                  {memcachedResult.redaction.redactionApplied
                    ? `Redaction active: ${memcachedResult.redaction.redactedSegments} segment(s) masked (${memcachedResult.redaction.policyId}@${memcachedResult.redaction.policyVersion}).`
                    : `Redaction policy: ${memcachedResult.redaction.policyId}@${memcachedResult.redaction.policyVersion}.`}
                </p>
              </div>
            ) : null}

            {memcachedStats ? (
              <div className='rounded border border-border/60 bg-muted/40 p-2 text-xs'>
                <p className='mb-2 text-muted-foreground'>
                  Last updated: {new Date(memcachedStats.fetchedAt).toLocaleTimeString()}
                </p>
                <div className='max-h-48 overflow-auto'>
                  <table className='w-full'>
                    <thead>
                      <tr className='text-left text-muted-foreground'>
                        <th className='py-1 pr-2'>Stat</th>
                        <th className='py-1'>Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {memcachedStats.stats.map((row) => (
                        <tr key={row.key}>
                          <td className='py-1 pr-2 align-top'>
                            <code>{row.key}</code>
                          </td>
                          <td className='py-1 align-top'>
                            <code>{row.value}</code>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
};
