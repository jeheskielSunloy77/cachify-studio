import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/renderer/components/ui/badge';
import { Button } from '@/renderer/components/ui/button';
import { Input } from '@/renderer/components/ui/input';
import { Label } from '@/renderer/components/ui/label';
import type {
  ConnectionStatus,
  MemcachedGetResponse,
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

type RedisExplorerPanelProps = {
  connectionStatus: ConnectionStatus;
};

type MemcachedGetData = Extract<MemcachedGetResponse, { ok: true }>['data'];
type MemcachedStatsData = Extract<MemcachedStatsGetResponse, { ok: true }>['data'];

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
  const [memcachedKey, setMemcachedKey] = useState('');
  const [memcachedLoading, setMemcachedLoading] = useState(false);
  const [memcachedResult, setMemcachedResult] = useState<MemcachedGetData | null>(null);
  const [memcachedStats, setMemcachedStats] = useState<MemcachedStatsData | null>(null);
  const [memcachedMessage, setMemcachedMessage] = useState<string | null>(null);

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
  const memcachedApiAvailable =
    Boolean(memcachedApi?.get) &&
    Boolean(memcachedApi?.getStats);

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
    if (!inspectorApiAvailable || !redisInspectApi?.onProgress || !redisInspectApi?.onDone) {
      return;
    }

    const unsubscribeProgress = redisInspectApi.onProgress((event: RedisInspectProgressEvent) => {
      if (!inspectJobId || event.jobId !== inspectJobId) {
        return;
      }
      setInspectResult(event.result);
      setInspectMessage('Inspecting key…');
    });

    const unsubscribeDone = redisInspectApi.onDone((event: RedisInspectDoneEvent) => {
      if (!inspectJobId || event.jobId !== inspectJobId) {
        return;
      }
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
  }, [inspectJobId, inspectorApiAvailable, redisInspectApi]);

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

  const startInspect = async (key: string) => {
    if (!inspectorApiAvailable || !redisInspectApi?.start) {
      return;
    }
    const response = await redisInspectApi.start({ key });
    if ('error' in response) {
      setInspectMessage(response.error.message);
      return;
    }
    setInspectedKey(key);
    setInspectResult(null);
    setInspectMessage('Inspect started.');
    setInspectJobId(response.data.jobId);
  };

  const cancelInspect = async () => {
    if (!inspectJobId || !jobsApi?.cancel) {
      return;
    }
    await jobsApi.cancel({ jobId: inspectJobId });
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
                          void startInspect(item.key);
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
              </div>
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

            {inspectMessage ? (
              <p className='mb-2 text-xs text-muted-foreground'>{inspectMessage}</p>
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
                <pre className='max-h-56 overflow-auto rounded border border-border/60 bg-muted/50 p-2 text-xs'>
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

            <p className='text-xs text-muted-foreground'>
              {canUseMemcached
                ? 'Connected to Memcached.'
                : 'Connect an active Memcached profile to fetch values and stats.'}
            </p>

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
                  <p className='mt-1 text-muted-foreground'>
                    Preview truncated safely ({memcachedResult.capReason ?? 'MEMCACHED_PREVIEW_LIMIT'}).
                  </p>
                ) : null}
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
