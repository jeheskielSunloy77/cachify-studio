// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  normalizeMemcachedGetResult,
  normalizeMemcachedStatsResult,
} from '../domain/cache/inspector/memcached-inspector.service';

describe('memcached inspector service', () => {
  it('normalizes cache hit and miss payloads', () => {
    const hit = normalizeMemcachedGetResult('user:1', {
      found: true,
      flags: 7,
      bytes: 5,
      value: 'hello',
    });
    const miss = normalizeMemcachedGetResult('user:2', {
      found: false,
      flags: null,
      bytes: null,
      value: null,
    });

    expect(hit).toMatchObject({
      key: 'user:1',
      found: true,
      flags: 7,
      bytes: 5,
      valuePreview: 'hello',
      capReached: false,
    });
    expect(miss).toMatchObject({
      key: 'user:2',
      found: false,
      valuePreview: null,
      flags: null,
      bytes: null,
    });
  });

  it('enforces safe preview caps and marks cap reason', () => {
    const result = normalizeMemcachedGetResult(
      'large:key',
      {
        found: true,
        flags: 0,
        bytes: 10_000,
        value: 'x'.repeat(10_000),
      },
      1024,
    );

    expect(result.capReached).toBe(true);
    expect(result.capReason).toBe('MEMCACHED_PREVIEW_LIMIT');
    expect(result.valuePreview?.length).toBeLessThan(10_000);
  });

  it('sorts stats keys for deterministic rendering', () => {
    const stats = normalizeMemcachedStatsResult([
      { key: 'curr_items', value: '3' },
      { key: 'bytes', value: '123' },
    ]);

    expect(stats.stats[0]).toEqual({ key: 'bytes', value: '123' });
    expect(stats.stats[1]).toEqual({ key: 'curr_items', value: '3' });
  });
});

