// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { recentKeysSessionService } from '../domain/cache/session/recent-keys-session.service';

describe('recent keys session service', () => {
  beforeEach(() => {
    recentKeysSessionService.reset();
  });

  it('deduplicates by connection+key and moves reopened keys to top', async () => {
    recentKeysSessionService.record('profile-a', {
      key: 'orders:1',
      type: 'hash',
      ttlSeconds: 30,
      inspectedAt: '2026-02-13T10:00:00.000Z',
    });
    recentKeysSessionService.record('profile-a', {
      key: 'orders:2',
      type: 'string',
      ttlSeconds: -1,
      inspectedAt: '2026-02-13T10:01:00.000Z',
    });
    recentKeysSessionService.record('profile-a', {
      key: 'orders:1',
      type: 'hash',
      ttlSeconds: 29,
      inspectedAt: '2026-02-13T10:02:00.000Z',
    });

    const afterReinspect = recentKeysSessionService.list('profile-a');
    expect(afterReinspect).toHaveLength(2);
    expect(afterReinspect[0]?.key).toBe('orders:1');
    expect(afterReinspect[0]?.ttlSeconds).toBe(29);

    const reopened = recentKeysSessionService.reopen('profile-a', 'orders:2');
    expect(reopened?.key).toBe('orders:2');
    expect(recentKeysSessionService.list('profile-a')[0]?.key).toBe('orders:2');
  });

  it('enforces bounded history per connection and isolates histories', async () => {
    for (let index = 1; index <= 55; index += 1) {
      recentKeysSessionService.record('profile-a', {
        key: `key:${index}`,
        inspectedAt: `2026-02-13T10:${String(index).padStart(2, '0')}:00.000Z`,
      });
    }
    recentKeysSessionService.record('profile-b', {
      key: 'only:key',
      inspectedAt: '2026-02-13T11:00:00.000Z',
    });

    const profileA = recentKeysSessionService.list('profile-a');
    const profileB = recentKeysSessionService.list('profile-b');

    expect(profileA).toHaveLength(50);
    expect(profileA[0]?.key).toBe('key:55');
    expect(profileA[49]?.key).toBe('key:6');
    expect(profileB).toHaveLength(1);
    expect(profileB[0]?.key).toBe('only:key');
  });

  it('stores metadata only and ignores accidental fetched-value fields', async () => {
    recentKeysSessionService.record(
      'profile-a',
      {
        key: 'orders:secure',
        type: 'string',
        ttlSeconds: 30,
        inspectedAt: '2026-02-14T11:00:00.000Z',
        value: 'secret-should-not-persist',
      } as unknown as Parameters<typeof recentKeysSessionService.record>[1],
    );

    const [entry] = recentKeysSessionService.list('profile-a');
    expect(entry?.key).toBe('orders:secure');
    expect((entry as unknown as { value?: string })?.value).toBeUndefined();
  });
});
