import assert from 'node:assert/strict';
import test from 'node:test';
import { requestAppInfo } from './client';

test('requestAppInfo returns explicit error when preload bridge is unavailable', async () => {
  (globalThis as { window?: unknown }).window = {};

  const result = await requestAppInfo();

  assert.equal(result.ok, false);
  if (result.ok) {
    throw new Error('Expected error response');
  }

  assert.equal(result.error.code, 'IPC_BRIDGE_UNAVAILABLE');
});

test('requestAppInfo returns timeout envelope when preload call hangs', async () => {
  const originalSetTimeout = globalThis.setTimeout;

  globalThis.setTimeout = ((fn: (...args: unknown[]) => void) => {
    fn();
    return 0 as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;

  (globalThis as { window?: unknown }).window = {
    cachify: {
      getAppInfo: () =>
        new Promise(() => {
          void 0;
        }),
    },
  };

  try {
    const result = await requestAppInfo();

    assert.equal(result.ok, false);
    if (result.ok) {
      throw new Error('Expected error response');
    }

    assert.equal(result.error.code, 'IPC_TIMEOUT');
  } finally {
    globalThis.setTimeout = originalSetTimeout;
  }
});
