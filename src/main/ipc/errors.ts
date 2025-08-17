import type { IpcError } from './ipc.contract';

function toStructuredCloneSafe(
  value: unknown,
  seen: WeakSet<object> = new WeakSet(),
): unknown {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (typeof value === 'undefined' || typeof value === 'symbol' || typeof value === 'function') {
    return String(value);
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => toStructuredCloneSafe(item, seen));
  }

  if (typeof value === 'object') {
    if (seen.has(value)) {
      return '[Circular]';
    }

    seen.add(value);

    const entries = Object.entries(value as Record<string, unknown>).map(([key, child]) => [
      key,
      toStructuredCloneSafe(child, seen),
    ]);

    return Object.fromEntries(entries);
  }

  return String(value);
}

export function normalizeIpcError(error: unknown, code = 'IPC_INTERNAL_ERROR'): IpcError {
  if (error instanceof Error) {
    return {
      code,
      message: error.message,
      details: {
        name: error.name,
      },
    };
  }

  if (typeof error === 'string') {
    return {
      code,
      message: error,
    };
  }

  return {
    code,
    message: 'Unexpected internal error',
    details: toStructuredCloneSafe(error),
  };
}
