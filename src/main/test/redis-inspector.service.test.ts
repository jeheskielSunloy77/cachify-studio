// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { RedisInspectProgressEvent } from '../../shared/ipc/ipc.contract';
import {
  buildRedisInspectCopyPayload,
  runRedisInspectJob,
} from '../domain/cache/inspector/redis-inspector.service';

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
      previewBytes: 7,
      maxDepthApplied: null,
      redaction: {
        policyId: 'safe-default-redaction',
        policyVersion: '1.0.0',
        redactedSegments: 0,
        redactionApplied: false,
      },
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
        previewBytes: 0,
        maxDepthApplied: null,
      },
    });
  });

  it('enforces 1MB preview limit boundaries for string values', async () => {
    const inspect = async (jobId: string, value: string) => {
      let doneEvent: unknown = null;
      await runRedisInspectJob({
        jobId,
        request: { key: `string:${jobId}` },
        executeRedisCommand: async (parts) => {
          if (parts[0] === 'TYPE') {
            return { ok: true, data: 'string' };
          }
          if (parts[0] === 'TTL') {
            return { ok: true, data: -1 };
          }
          if (parts[0] === 'GET') {
            return { ok: true, data: value };
          }
          return { ok: false, error: { code: 'UNKNOWN_CMD', message: parts[0] ?? 'unknown' } };
        },
        isCancelled: () => false,
        onProgress: () => undefined,
        onDone: (event) => {
          doneEvent = event;
        },
      });
      return doneEvent;
    };

    const belowLimit = await inspect('below', 'x'.repeat(1_048_575));
    const atLimit = await inspect('at', 'x'.repeat(1_048_576));
    const aboveLimit = await inspect('above', 'x'.repeat(1_048_577));

    expect(belowLimit).toMatchObject({
      status: 'completed',
      result: {
        type: 'string',
        capReached: false,
        isPartial: false,
        previewBytes: 1_048_575,
      },
    });
    expect(atLimit).toMatchObject({
      status: 'completed',
      result: {
        type: 'string',
        capReached: false,
        isPartial: false,
        previewBytes: 1_048_576,
      },
    });
    expect(aboveLimit).toMatchObject({
      status: 'completed',
      result: {
        type: 'string',
        capReached: true,
        isPartial: true,
        capReason: 'STRING_PREVIEW_LIMIT',
        previewBytes: 1_048_576,
      },
    });
  });

  it('marks formatted depth cap metadata when parsed payload exceeds depth 20', async () => {
    let doneEvent: unknown = null;
    let nested: unknown = { leaf: 'ok' };
    for (let index = 0; index < 22; index += 1) {
      nested = { child: nested };
    }
    const deepJson = JSON.stringify(nested);

    await runRedisInspectJob({
      jobId: 'inspect-depth',
      request: { key: 'deep:string', viewMode: 'formatted' },
      executeRedisCommand: async (parts) => {
        if (parts[0] === 'TYPE') {
          return { ok: true, data: 'string' };
        }
        if (parts[0] === 'TTL') {
          return { ok: true, data: -1 };
        }
        if (parts[0] === 'GET') {
          return { ok: true, data: deepJson };
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
        capReason: 'FORMATTED_DEPTH_LIMIT',
        maxDepthApplied: 20,
        view: {
          requestedMode: 'formatted',
          activeMode: 'formatted',
        },
      },
    });
  });

  it('redacts sensitive-looking string segments and exposes policy metadata', async () => {
    let doneEvent: unknown = null;

    await runRedisInspectJob({
      jobId: 'inspect-redaction',
      request: { key: 'secret:string' },
      executeRedisCommand: async (parts) => {
        if (parts[0] === 'TYPE') {
          return { ok: true, data: 'string' };
        }
        if (parts[0] === 'TTL') {
          return { ok: true, data: 60 };
        }
        if (parts[0] === 'GET') {
          return {
            ok: true,
            data: 'password=superSecretToken1234567890 bearer eyJhbGciOiJIUzI1NiJ9.aaa.bbb',
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
        type: 'string',
        value: expect.stringContaining('[REDACTED]'),
        redaction: {
          policyId: 'safe-default-redaction',
          policyVersion: '1.0.0',
          redactionApplied: true,
        },
      },
    });
  });

  it('requires explicit reveal mode to return unredacted content', async () => {
    let redactedEvent: unknown = null;
    let revealedEvent: unknown = null;
    const secretValue = 'password=topSecretValue1234567890';

    await runRedisInspectJob({
      jobId: 'inspect-redacted-default',
      request: { key: 'secret:default' },
      executeRedisCommand: async (parts) => {
        if (parts[0] === 'TYPE') {
          return { ok: true, data: 'string' };
        }
        if (parts[0] === 'TTL') {
          return { ok: true, data: 60 };
        }
        if (parts[0] === 'GET') {
          return { ok: true, data: secretValue };
        }
        return { ok: false, error: { code: 'UNKNOWN_CMD', message: parts[0] ?? 'unknown' } };
      },
      isCancelled: () => false,
      onProgress: () => undefined,
      onDone: (event) => {
        redactedEvent = event;
      },
    });

    await runRedisInspectJob({
      jobId: 'inspect-revealed',
      request: { key: 'secret:default', revealMode: 'revealed' },
      executeRedisCommand: async (parts) => {
        if (parts[0] === 'TYPE') {
          return { ok: true, data: 'string' };
        }
        if (parts[0] === 'TTL') {
          return { ok: true, data: 60 };
        }
        if (parts[0] === 'GET') {
          return { ok: true, data: secretValue };
        }
        return { ok: false, error: { code: 'UNKNOWN_CMD', message: parts[0] ?? 'unknown' } };
      },
      isCancelled: () => false,
      onProgress: () => undefined,
      onDone: (event) => {
        revealedEvent = event;
      },
    });

    expect(redactedEvent).toMatchObject({
      status: 'completed',
      result: {
        type: 'string',
        value: expect.stringContaining('[REDACTED]'),
        reveal: {
          mode: 'redacted',
          canReveal: true,
        },
      },
    });
    expect(revealedEvent).toMatchObject({
      status: 'completed',
      result: {
        type: 'string',
        value: secretValue,
        reveal: {
          mode: 'revealed',
          canReveal: true,
        },
      },
    });
  });

  it('returns formatted view metadata and fallback reasons for string mode selection', async () => {
    let formattedEvent: unknown = null;
    let fallbackEvent: unknown = null;

    await runRedisInspectJob({
      jobId: 'inspect-formatted-json',
      request: { key: 'json:string', viewMode: 'formatted' },
      executeRedisCommand: async (parts) => {
        if (parts[0] === 'TYPE') {
          return { ok: true, data: 'string' };
        }
        if (parts[0] === 'TTL') {
          return { ok: true, data: 60 };
        }
        if (parts[0] === 'GET') {
          return { ok: true, data: '{"name":"cachify","flags":["a","b"]}' };
        }
        return { ok: false, error: { code: 'UNKNOWN_CMD', message: parts[0] ?? 'unknown' } };
      },
      isCancelled: () => false,
      onProgress: () => undefined,
      onDone: (event) => {
        formattedEvent = event;
      },
    });

    await runRedisInspectJob({
      jobId: 'inspect-formatted-fallback',
      request: { key: 'plain:string', viewMode: 'formatted' },
      executeRedisCommand: async (parts) => {
        if (parts[0] === 'TYPE') {
          return { ok: true, data: 'string' };
        }
        if (parts[0] === 'TTL') {
          return { ok: true, data: 60 };
        }
        if (parts[0] === 'GET') {
          return { ok: true, data: 'plain-text' };
        }
        return { ok: false, error: { code: 'UNKNOWN_CMD', message: parts[0] ?? 'unknown' } };
      },
      isCancelled: () => false,
      onProgress: () => undefined,
      onDone: (event) => {
        fallbackEvent = event;
      },
    });

    expect(formattedEvent).toMatchObject({
      status: 'completed',
      result: {
        type: 'string',
        value: expect.stringContaining('\n'),
        view: {
          requestedMode: 'formatted',
          activeMode: 'formatted',
          formattedAvailable: true,
        },
        decode: {
          requestedPipelineId: 'json-pretty',
          activePipelineId: 'json-pretty',
          activePipelineLabel: 'JSON pretty',
          stage: {
            status: 'success',
          },
        },
      },
    });
    expect(fallbackEvent).toMatchObject({
      status: 'completed',
      result: {
        type: 'string',
        value: 'plain-text',
        view: {
          requestedMode: 'formatted',
          activeMode: 'raw',
          formattedAvailable: false,
          formattedUnavailableReason: 'VALUE_NOT_FORMATTABLE_AS_JSON',
        },
        decode: {
          requestedPipelineId: 'json-pretty',
          activePipelineId: 'raw-text',
          stage: {
            status: 'fallback',
            failureCode: 'VALUE_NOT_FORMATTABLE_AS_JSON',
          },
        },
      },
    });
  });

  it('keeps maxDepthApplied null when raw pipeline is active', async () => {
    let doneEvent: unknown = null;

    await runRedisInspectJob({
      jobId: 'inspect-raw-json',
      request: { key: 'json:raw', viewMode: 'raw', decodePipelineId: 'raw-text' },
      executeRedisCommand: async (parts) => {
        if (parts[0] === 'TYPE') {
          return { ok: true, data: 'string' };
        }
        if (parts[0] === 'TTL') {
          return { ok: true, data: 60 };
        }
        if (parts[0] === 'GET') {
          return { ok: true, data: '{"ok":true,"nested":{"depth":1}}' };
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
        view: {
          requestedMode: 'raw',
          activeMode: 'raw',
          formattedAvailable: true,
        },
        maxDepthApplied: null,
      },
    });
  });

  it('falls back to raw decode pipeline for non-string values when json-pretty is requested', async () => {
    let doneEvent: unknown = null;

    await runRedisInspectJob({
      jobId: 'inspect-hash-json-pipeline',
      request: { key: 'hash:json', decodePipelineId: 'json-pretty', viewMode: 'formatted' },
      executeRedisCommand: async (parts) => {
        if (parts[0] === 'TYPE') {
          return { ok: true, data: 'hash' };
        }
        if (parts[0] === 'TTL') {
          return { ok: true, data: 42 };
        }
        if (parts[0] === 'HLEN') {
          return { ok: true, data: 1 };
        }
        if (parts[0] === 'HSCAN') {
          return { ok: true, data: ['0', ['field-a', 'value-a']] };
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
        type: 'hash',
        view: {
          requestedMode: 'formatted',
          activeMode: 'raw',
          formattedAvailable: false,
          formattedUnavailableReason: 'TYPE_HAS_NO_FORMATTED_VIEW',
        },
        decode: {
          requestedPipelineId: 'json-pretty',
          activePipelineId: 'raw-text',
          stage: {
            status: 'fallback',
            failureCode: 'TYPE_HAS_NO_PIPELINE',
          },
        },
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

  it('builds safe copy payload from revealed values using redacted output', () => {
    const payload = buildRedisInspectCopyPayload(
      {
        key: 'copy:key',
        type: 'string',
        ttlSeconds: 30,
        isPartial: false,
        capReached: false,
        previewBytes: 24,
        maxDepthApplied: null,
        redaction: {
          policyId: 'safe-default-redaction',
          policyVersion: '1.0.0',
          policySummary:
            'Masks JWT, bearer tokens, sensitive key/value pairs, and high-entropy tokens.',
          redactedSegments: 1,
          redactionApplied: true,
        },
        reveal: {
          mode: 'revealed',
          canReveal: true,
          explicitInteractionRequired: true,
          autoResetTriggers: ['key-change', 'view-switch', 'navigation', 'disconnect', 'safety-relock'],
        },
        view: {
          requestedMode: 'raw',
          activeMode: 'raw',
          rawAvailable: true,
          formattedAvailable: false,
        },
        decode: {
          requestedPipelineId: 'raw-text',
          activePipelineId: 'raw-text',
          activePipelineLabel: 'Raw text',
          pipelines: [
            { id: 'raw-text', label: 'Raw text', supported: true },
            { id: 'json-pretty', label: 'JSON pretty', supported: true },
          ],
          stage: {
            status: 'success',
            message: 'Raw text pipeline active.',
            suggestedActions: ['use-json-pretty', 'export-raw-partial'],
          },
        },
        fetchedCount: 1,
        byteLength: 24,
        value: 'password=visibleSecret123',
      },
      'safeRedacted',
    );

    expect(payload.modeUsed).toBe('safeRedacted');
    expect(payload.redactionApplied).toBe(true);
    expect(payload.text).toContain('Copy mode: safeRedacted');
    expect(payload.text).toContain('[REDACTED]');
    expect(payload.text).not.toContain('visibleSecret123');
  });

  it('builds explicit revealed copy payload without additional masking', () => {
    const payload = buildRedisInspectCopyPayload(
      {
        key: 'copy:key',
        type: 'string',
        ttlSeconds: 30,
        isPartial: false,
        capReached: false,
        previewBytes: 24,
        maxDepthApplied: null,
        redaction: {
          policyId: 'safe-default-redaction',
          policyVersion: '1.0.0',
          policySummary:
            'Masks JWT, bearer tokens, sensitive key/value pairs, and high-entropy tokens.',
          redactedSegments: 1,
          redactionApplied: true,
        },
        reveal: {
          mode: 'revealed',
          canReveal: true,
          explicitInteractionRequired: true,
          autoResetTriggers: ['key-change', 'view-switch', 'navigation', 'disconnect', 'safety-relock'],
        },
        view: {
          requestedMode: 'raw',
          activeMode: 'raw',
          rawAvailable: true,
          formattedAvailable: false,
        },
        decode: {
          requestedPipelineId: 'raw-text',
          activePipelineId: 'raw-text',
          activePipelineLabel: 'Raw text',
          pipelines: [
            { id: 'raw-text', label: 'Raw text', supported: true },
            { id: 'json-pretty', label: 'JSON pretty', supported: true },
          ],
          stage: {
            status: 'success',
            message: 'Raw text pipeline active.',
            suggestedActions: ['use-json-pretty', 'export-raw-partial'],
          },
        },
        fetchedCount: 1,
        byteLength: 24,
        value: 'password=visibleSecret123',
      },
      'explicitRevealed',
    );

    expect(payload.modeUsed).toBe('explicitRevealed');
    expect(payload.redactionApplied).toBe(false);
    expect(payload.text).toContain('Copy mode: explicitRevealed');
    expect(payload.text).toContain('password=visibleSecret123');
  });
});
