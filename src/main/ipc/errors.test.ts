import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeIpcError } from './errors';

test('normalizeIpcError handles Error instances', () => {
  const result = normalizeIpcError(new Error('boom'), 'ERR_TEST');

  assert.equal(result.code, 'ERR_TEST');
  assert.equal(result.message, 'boom');
  assert.deepEqual(result.details, { name: 'Error' });
});

test('normalizeIpcError handles string values', () => {
  const result = normalizeIpcError('failure', 'ERR_STRING');

  assert.deepEqual(result, {
    code: 'ERR_STRING',
    message: 'failure',
  });
});

test('normalizeIpcError serializes non-clone-safe values', () => {
  const circular: { self?: unknown } = {};
  circular.self = circular;

  const result = normalizeIpcError(
    {
      circular,
      fn: () => 'x',
      count: 1n,
    },
    'ERR_NON_CLONE_SAFE',
  );

  assert.equal(result.code, 'ERR_NON_CLONE_SAFE');
  assert.equal(result.message, 'Unexpected internal error');
  assert.equal(typeof result.details, 'object');
  if (!result.details || Array.isArray(result.details)) {
    throw new Error('Expected object details');
  }

  const details = result.details as {
    circular: { self: string };
    fn: string;
    count: string;
  };

  assert.deepEqual(
    {
      circular: details.circular,
      count: details.count,
    },
    {
      circular: {
        self: '[Circular]',
      },
      count: '1',
    },
  );
  assert.match(details.fn, /=>/);
  assert.deepEqual(details.circular, {
    self: '[Circular]',
  });
  assert.equal(details.count, '1');
});
