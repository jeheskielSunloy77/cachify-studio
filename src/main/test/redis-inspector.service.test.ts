// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { RedisInspectProgressEvent } from '../../shared/ipc/ipc.contract';
import { runRedisInspectJob } from '../domain/cache/inspector/redis-inspector.service';

describe('redis inspector service', () => {
  it('inspects string values and returns completed result', async () => {
    const progressEvents: RedisInspectProgressEvent[] = [];
    let doneEvent: unknown = null;

    await runRedisInspectJob({
      jobId: 'inspect-string',
      request: { key: 'profile:name' },
      executeRedisCommand: async (parts) => {
        if (parts[0] === 'TYPE') {
          return { ok: true, data: 'string' };
        }
        if (parts[0] === 'TTL') {
          return { ok: true, data: 120 };
        }
        if (parts[0] === 'GET') {
          return { ok: true, data: 'cachify' };
        }
        return { ok: false, error: { code: 'UNKNOWN_CMD', message: parts[0] ?? 'unknown' } };
      },
      isCancelled: () => false,
      onProgress: (event) => {
        progressEvents.push(event);
      },
      onDone: (event) => {
        doneEvent = event;
      },
    });

    expect(progressEvents[0]?.result).toMatchObject({
      type: 'string',
      value: 'cachify',
      capReached: false,
      isPartial: false,
    });
    expect(doneEvent).toMatchObject({
      status: 'completed',
      result: {
        type: 'string',
      },
    });
  });

  it('returns missing-key result when redis type is none', async () => {
    let doneEvent: unknown = null;

    await runRedisInspectJob({
      jobId: 'inspect-none',
      request: { key: 'missing:key' },
      executeRedisCommand: async (parts) => {
        if (parts[0] === 'TYPE') {
          return { ok: true, data: 'none' };
        }
        if (parts[0] === 'TTL') {
          return { ok: true, data: -2 };
        }
        return { ok: false, error: { code: 'UNKNOWN_CMD', message: parts[0] ?? 'unknown' } };
      },
      isCancelled: () => false,
      onProgress: () => undefined,
      onDone: (event) => {
        doneEvent = event;
      },
    });

    expect(doneEvent).toMatchObject({
      status: 'completed',
      result: {
        type: 'none',
        reason: 'Key does not exist.',
      },
    });
  });

  it('caps oversized string previews at 1MB by default', async () => {
    const oversized = 'x'.repeat(1_048_900);
    let doneEvent: unknown = null;

    await runRedisInspectJob({
      jobId: 'inspect-cap',
      request: { key: 'big:string' },
      executeRedisCommand: async (parts) => {
        if (parts[0] === 'TYPE') {
          return { ok: true, data: 'string' };
        }
        if (parts[0] === 'TTL') {
          return { ok: true, data: -1 };
        }
        if (parts[0] === 'GET') {
          return { ok: true, data: oversized };
        }
        return { ok: false, error: { code: 'UNKNOWN_CMD', message: parts[0] ?? 'unknown' } };
      },
      isCancelled: () => false,
      onProgress: () => undefined,
      onDone: (event) => {
        doneEvent = event;
      },
    });

    expect(doneEvent).toMatchObject({
      status: 'completed',
      result: {
        type: 'string',
        capReached: true,
        isPartial: true,
        capReason: 'STRING_PREVIEW_LIMIT',
      },
    });
  });

  it('supports hash partial pagination and cancellation', async () => {
    let cancelled = false;
    const progressEvents: RedisInspectProgressEvent[] = [];
    let doneEvent: unknown = null;

    await runRedisInspectJob({
      jobId: 'inspect-hash',
      request: { key: 'hash:key', hashChunkSize: 2 },
      executeRedisCommand: async (parts) => {
        if (parts[0] === 'TYPE') {
          return { ok: true, data: 'hash' };
        }
        if (parts[0] === 'TTL') {
          return { ok: true, data: 33 };
        }
        if (parts[0] === 'HLEN') {
          return { ok: true, data: 3 };
        }
        if (parts[0] === 'HSCAN' && parts[2] === '0') {
          return { ok: true, data: ['5', ['field-1', 'value-1', 'field-2', 'value-2']] };
        }
        if (parts[0] === 'HSCAN' && parts[2] === '5') {
          return { ok: true, data: ['0', ['field-3', 'value-3']] };
        }
        return { ok: false, error: { code: 'UNKNOWN_CMD', message: parts[0] ?? 'unknown' } };
      },
      isCancelled: () => cancelled,
      onProgress: (event) => {
        progressEvents.push(event);
        cancelled = true;
      },
      onDone: (event) => {
        doneEvent = event;
      },
    });

    expect(progressEvents[0]?.result).toMatchObject({
      type: 'hash',
      fetchedCount: 2,
      hasMore: true,
    });
    expect(doneEvent).toMatchObject({
      status: 'cancelled',
      result: {
        type: 'hash',
        isPartial: true,
      },
    });
  });

  it('preserves list ordering with bounded LRANGE windows', async () => {
    let doneEvent: unknown = null;

    await runRedisInspectJob({
      jobId: 'inspect-list',
      request: { key: 'list:key', collectionChunkSize: 2 },
      executeRedisCommand: async (parts) => {
        if (parts[0] === 'TYPE') {
          return { ok: true, data: 'list' };
        }
        if (parts[0] === 'TTL') {
          return { ok: true, data: 90 };
        }
        if (parts[0] === 'LLEN') {
          return { ok: true, data: 3 };
        }
        if (parts[0] === 'LRANGE' && parts[2] === '0') {
          return { ok: true, data: ['a', 'b'] };
        }
        if (parts[0] === 'LRANGE' && parts[2] === '2') {
          return { ok: true, data: ['c'] };
        }
        return { ok: false, error: { code: 'UNKNOWN_CMD', message: parts[0] ?? 'unknown' } };
      },
      isCancelled: () => false,
      onProgress: () => undefined,
      onDone: (event) => {
        doneEvent = event;
      },
    });

    expect(doneEvent).toMatchObject({
      status: 'completed',
      result: {
        type: 'list',
        ordering: 'server',
        fetchedCount: 3,
        items: [{ value: 'a' }, { value: 'b' }, { value: 'c' }],
      },
    });
  });

  it('normalizes set and zset ordering with score capture', async () => {
    let setDone: unknown = null;
    let zsetDone: unknown = null;

    await runRedisInspectJob({
      jobId: 'inspect-set',
      request: { key: 'set:key' },
      executeRedisCommand: async (parts) => {
        if (parts[0] === 'TYPE') {
          return { ok: true, data: 'set' };
        }
        if (parts[0] === 'TTL') {
          return { ok: true, data: 60 };
        }
        if (parts[0] === 'SCARD') {
          return { ok: true, data: 3 };
        }
        if (parts[0] === 'SSCAN') {
          return { ok: true, data: ['0', ['member-b', 'member-a', 'member-c']] };
        }
        return { ok: false, error: { code: 'UNKNOWN_CMD', message: parts[0] ?? 'unknown' } };
      },
      isCancelled: () => false,
      onProgress: () => undefined,
      onDone: (event) => {
        setDone = event;
      },
    });

    await runRedisInspectJob({
      jobId: 'inspect-zset',
      request: { key: 'zset:key' },
      executeRedisCommand: async (parts) => {
        if (parts[0] === 'TYPE') {
          return { ok: true, data: 'zset' };
        }
        if (parts[0] === 'TTL') {
          return { ok: true, data: 60 };
        }
        if (parts[0] === 'ZCARD') {
          return { ok: true, data: 2 };
        }
        if (parts[0] === 'ZSCAN') {
          return { ok: true, data: ['0', ['member-b', '2', 'member-a', '1']] };
        }
        return { ok: false, error: { code: 'UNKNOWN_CMD', message: parts[0] ?? 'unknown' } };
      },
      isCancelled: () => false,
      onProgress: () => undefined,
      onDone: (event) => {
        zsetDone = event;
      },
    });

    expect(setDone).toMatchObject({
      status: 'completed',
      result: {
        type: 'set',
        ordering: 'lexical',
        items: [{ value: 'member-a' }, { value: 'member-b' }, { value: 'member-c' }],
      },
    });
    expect(zsetDone).toMatchObject({
      status: 'completed',
      result: {
        type: 'zset',
        ordering: 'lexical',
        items: [
          { value: 'member-a', score: 1 },
          { value: 'member-b', score: 2 },
        ],
      },
    });
  });

  it('reports collection cap-reached state with export-later guidance path', async () => {
    let doneEvent: unknown = null;

    await runRedisInspectJob({
      jobId: 'inspect-set-cap',
      request: { key: 'set:cap', maxEntries: 2 },
      executeRedisCommand: async (parts) => {
        if (parts[0] === 'TYPE') {
          return { ok: true, data: 'set' };
        }
        if (parts[0] === 'TTL') {
          return { ok: true, data: 20 };
        }
        if (parts[0] === 'SCARD') {
          return { ok: true, data: 5 };
        }
        if (parts[0] === 'SSCAN') {
          return { ok: true, data: ['0', ['one', 'two', 'three']] };
        }
        return { ok: false, error: { code: 'UNKNOWN_CMD', message: parts[0] ?? 'unknown' } };
      },
      isCancelled: () => false,
      onProgress: () => undefined,
      onDone: (event) => {
        doneEvent = event;
      },
    });

    expect(doneEvent).toMatchObject({
      status: 'completed',
      result: {
        type: 'set',
        capReached: true,
        isPartial: true,
        capReason: 'COLLECTION_ENTRY_LIMIT',
      },
    });
  });

  it('parses stream entries and marks truncation metadata when bounded', async () => {
    let doneEvent: unknown = null;

    await runRedisInspectJob({
      jobId: 'inspect-stream',
      request: { key: 'stream:key', streamCount: 2 },
      executeRedisCommand: async (parts) => {
        if (parts[0] === 'TYPE') {
          return { ok: true, data: 'stream' };
        }
        if (parts[0] === 'TTL') {
          return { ok: true, data: -1 };
        }
        if (parts[0] === 'XLEN') {
          return { ok: true, data: 5 };
        }
        if (parts[0] === 'XREVRANGE') {
          return {
            ok: true,
            data: [
              ['1710001-0', ['event', 'created', 'id', '1']],
              ['1710000-0', ['event', 'updated', 'id', '2']],
            ],
          };
        }
        return { ok: false, error: { code: 'UNKNOWN_CMD', message: parts[0] ?? 'unknown' } };
      },
      isCancelled: () => false,
      onProgress: () => undefined,
      onDone: (event) => {
        doneEvent = event;
      },
    });

    expect(doneEvent).toMatchObject({
      status: 'completed',
      result: {
        type: 'stream',
        fetchedCount: 2,
        totalCount: 5,
        truncated: true,
        entries: [
          {
            id: '1710001-0',
            fields: [
              { field: 'event', value: 'created' },
              { field: 'id', value: '1' },
            ],
          },
          {
            id: '1710000-0',
            fields: [
              { field: 'event', value: 'updated' },
              { field: 'id', value: '2' },
            ],
          },
        ],
      },
    });
  });
});
