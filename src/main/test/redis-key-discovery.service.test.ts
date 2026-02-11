// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { RedisKeysSearchProgressEvent } from '../../shared/ipc/ipc.contract';
import {
  buildScanMatchPattern,
  runRedisKeyDiscoveryJob,
} from '../domain/cache/explorer/redis-key-discovery.service';

describe('redis key discovery service', () => {
  it('builds expected scan match patterns for substring and prefix browsing', () => {
    expect(buildScanMatchPattern(undefined, undefined)).toBe('*');
    expect(buildScanMatchPattern('users', undefined)).toBe('*users*');
    expect(buildScanMatchPattern('users:*', undefined)).toBe('users:*');
    expect(buildScanMatchPattern(undefined, 'service:payments')).toBe('service:payments*');
    expect(buildScanMatchPattern('invoice', 'service:payments')).toBe(
      'service:payments*invoice*',
    );
  });

  it('iterates cursor responses, deduplicates keys, and emits stable ordering', async () => {
    const scanResponses = [
      { ok: true as const, data: ['1', ['app:z', 'app:a', 'app:a']] },
      { ok: true as const, data: ['0', ['app:b']] },
    ];
    let callCount = 0;
    const progressEvents: Array<{ keys: string[]; emittedCount: number }> = [];
    let doneEvent: { status: string; emittedCount: number } | null = null;

    await runRedisKeyDiscoveryJob({
      jobId: 'job-1',
      request: { query: 'app', includeMetadata: false },
      executeRedisCommand: async () => {
        const next = scanResponses[callCount];
        callCount += 1;
        return next ?? { ok: true, data: ['0', []] };
      },
      isCancelled: () => false,
      onProgress: (event) => {
        progressEvents.push({
          keys: event.keys.map((item) => item.key),
          emittedCount: event.emittedCount,
        });
      },
      onDone: (event) => {
        doneEvent = {
          status: event.status,
          emittedCount: event.emittedCount,
        };
      },
    });

    expect(callCount).toBe(2);
    expect(progressEvents[0]).toEqual({
      keys: ['app:a', 'app:z'],
      emittedCount: 2,
    });
    expect(progressEvents[1]).toEqual({
      keys: ['app:b'],
      emittedCount: 3,
    });
    expect(doneEvent).toEqual({
      status: 'completed',
      emittedCount: 3,
    });
  });

  it('streams metadata updates with mixed success/failure without failing discovery', async () => {
    const progressEvents: RedisKeysSearchProgressEvent[] = [];
    let doneStatus: string | null = null;

    await runRedisKeyDiscoveryJob({
      jobId: 'job-meta',
      request: { query: 'meta', includeMetadata: true },
      executeRedisCommand: async (parts) => {
        if (parts[0] === 'SCAN') {
          return { ok: true, data: ['0', ['meta:ok', 'meta:bad']] };
        }
        if (parts[0] === 'TYPE' && parts[1] === 'meta:ok') {
          return { ok: true, data: 'string' };
        }
        if (parts[0] === 'TTL' && parts[1] === 'meta:ok') {
          return { ok: true, data: -1 };
        }
        if (parts[0] === 'TYPE' && parts[1] === 'meta:bad') {
          return {
            ok: false,
            error: { code: 'TIMEOUT', message: 'Metadata timeout' },
          };
        }
        if (parts[0] === 'TTL' && parts[1] === 'meta:bad') {
          return { ok: true, data: 60 };
        }
        return { ok: true, data: ['0', []] };
      },
      isCancelled: () => false,
      onProgress: (event) => {
        progressEvents.push(event);
      },
      onDone: (event) => {
        doneStatus = event.status;
      },
    });

    const first = progressEvents[0];
    const metadataUpdate = progressEvents[1];
    expect(first.keys.map((item) => item.metadataState)).toEqual(['pending', 'pending']);
    expect(
      metadataUpdate.keys.find((item) => item.key === 'meta:ok'),
    ).toMatchObject({
      key: 'meta:ok',
      type: 'string',
      ttlSeconds: -1,
      metadataState: 'ready',
    });
    expect(
      metadataUpdate.keys.find((item) => item.key === 'meta:bad'),
    ).toMatchObject({
      key: 'meta:bad',
      type: 'unknown',
      ttlSeconds: 60,
      metadataState: 'unavailable',
    });
    expect(doneStatus).toBe('completed');
  });

  it('stops scanning when cancellation is requested and reports cancelled state', async () => {
    let cancelled = false;
    let callCount = 0;
    let doneStatus: string | null = null;

    await runRedisKeyDiscoveryJob({
      jobId: 'job-2',
      request: { query: 'event', includeMetadata: false },
      executeRedisCommand: async () => {
        callCount += 1;
        return { ok: true, data: ['33', ['event:1', 'event:2']] };
      },
      isCancelled: () => cancelled,
      onProgress: () => {
        cancelled = true;
      },
      onDone: (event) => {
        doneStatus = event.status;
      },
    });

    expect(callCount).toBe(1);
    expect(doneStatus).toBe('cancelled');
  });

  it('skips metadata lookups after cancellation is requested', async () => {
    let cancelled = false;
    let scanCalls = 0;
    let typeCalls = 0;
    let ttlCalls = 0;
    let doneStatus: string | null = null;

    await runRedisKeyDiscoveryJob({
      jobId: 'job-meta-cancel',
      request: { query: 'meta', includeMetadata: true },
      executeRedisCommand: async (parts) => {
        if (parts[0] === 'SCAN') {
          scanCalls += 1;
          return { ok: true, data: ['99', ['meta:one', 'meta:two']] };
        }
        if (parts[0] === 'TYPE') {
          typeCalls += 1;
          return { ok: true, data: 'string' };
        }
        if (parts[0] === 'TTL') {
          ttlCalls += 1;
          return { ok: true, data: 60 };
        }
        return { ok: true, data: ['0', []] };
      },
      isCancelled: () => cancelled,
      onProgress: () => {
        cancelled = true;
      },
      onDone: (event) => {
        doneStatus = event.status;
      },
    });

    expect(scanCalls).toBe(1);
    expect(typeCalls).toBe(0);
    expect(ttlCalls).toBe(0);
    expect(doneStatus).toBe('cancelled');
  });

  it('reports limit-reached when result cap is exceeded', async () => {
    let doneEvent:
      | {
          status: string;
          capReached: boolean;
          emittedCount: number;
          continuationAction?: string;
        }
      | null = null;

    await runRedisKeyDiscoveryJob({
      jobId: 'job-3',
      request: { query: 'cache', maxKeys: 2 },
      executeRedisCommand: async () => ({
        ok: true,
        data: ['9', ['cache:1', 'cache:2', 'cache:3']],
      }),
      isCancelled: () => false,
      onProgress: () => undefined,
      onDone: (event) => {
        doneEvent = {
          status: event.status,
          capReached: event.capReached,
          emittedCount: event.emittedCount,
          continuationAction: event.continuation?.suggestedAction,
        };
      },
    });

    expect(doneEvent).toEqual({
      status: 'limit-reached',
      capReached: true,
      emittedCount: 2,
      continuationAction: 'refine-search',
    });
  });
});
