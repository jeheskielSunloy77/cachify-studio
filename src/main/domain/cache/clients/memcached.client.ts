import { Socket } from 'node:net';

type MemcachedConnectOptions = {
  host: string;
  port: number;
  timeoutMs: number;
  authMode: 'none' | 'sasl';
  username?: string;
  password?: string;
};

export type MemcachedGetResult =
  | {
      found: false;
      flags: null;
      bytes: null;
      value: null;
    }
  | {
      found: true;
      flags: number;
      bytes: number;
      value: string;
    };

export type MemcachedStatsResult = Array<{ key: string; value: string }>;

type MemcachedClientHandle = {
  disconnect: () => Promise<void>;
  get: (key: string) => Promise<MemcachedGetResult>;
  stats: () => Promise<MemcachedStatsResult>;
};

const isValidMemcachedKey = (key: string) => {
  if (key.length === 0 || key.length > 250 || /\s/.test(key)) {
    return false;
  }

  for (const char of key) {
    const code = char.charCodeAt(0);
    if (code <= 0x1f || code === 0x7f) {
      return false;
    }
  }
  return true;
};

const writeLine = (socket: Socket, command: string) =>
  new Promise<void>((resolve, reject) => {
    socket.write(command, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

export const connectMemcachedClient = async (
  options: MemcachedConnectOptions,
): Promise<MemcachedClientHandle> => {
  const socket = new Socket();
  socket.setNoDelay(true);

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const onTimeout = () => {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      reject(new Error('TIMEOUT'));
    };
    socket.setTimeout(options.timeoutMs, onTimeout);
    socket.once('error', (error) => {
      if (settled) {
        return;
      }
      settled = true;
      reject(error);
    });
    socket.connect(options.port, options.host, () => {
      if (settled) {
        return;
      }
      settled = true;
      socket.setTimeout(0);
      resolve();
    });
  });

  if (options.authMode === 'sasl') {
    if (!options.username || !options.password) {
      socket.destroy();
      throw new Error('AUTH_FAILED:SASL credentials are required.');
    }
    socket.destroy();
    throw new Error('AUTH_FAILED:SASL authentication is not yet supported by built-in client.');
  }

  let buffer = Buffer.alloc(0);
  let closedError: Error | null = null;
  const waiters = new Set<() => void>();

  const wakeWaiters = () => {
    waiters.forEach((wake) => wake());
    waiters.clear();
  };

  socket.on('data', (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]);
    wakeWaiters();
  });
  socket.on('error', (error: Error) => {
    closedError = error;
    wakeWaiters();
  });
  socket.on('close', () => {
    if (!closedError) {
      closedError = new Error('MEMCACHED_CONNECTION_CLOSED');
    }
    wakeWaiters();
  });

  const waitForData = (timeoutMs: number) =>
    new Promise<void>((resolve, reject) => {
      if (closedError) {
        reject(closedError);
        return;
      }

      const timer = setTimeout(() => {
        waiters.delete(onWake);
        reject(new Error('TIMEOUT'));
      }, timeoutMs);

      const onWake = () => {
        clearTimeout(timer);
        if (closedError) {
          reject(closedError);
          return;
        }
        resolve();
      };

      waiters.add(onWake);
    });

  const readLine = async () => {
    for (;;) {
      const delimiterIndex = buffer.indexOf('\r\n');
      if (delimiterIndex !== -1) {
        const line = buffer.toString('utf8', 0, delimiterIndex);
        buffer = buffer.subarray(delimiterIndex + 2);
        return line;
      }
      await waitForData(options.timeoutMs);
    }
  };

  const readBytes = async (byteCount: number) => {
    while (buffer.length < byteCount) {
      await waitForData(options.timeoutMs);
    }
    const payload = buffer.subarray(0, byteCount);
    buffer = buffer.subarray(byteCount);
    return payload;
  };

  await writeLine(socket, 'version\r\n');
  const response = await readLine();
  if (!response.startsWith('VERSION')) {
    socket.destroy();
    throw new Error(`CONNECTION_FAILED:${response}`);
  }

  const get = async (key: string): Promise<MemcachedGetResult> => {
    if (!isValidMemcachedKey(key)) {
      throw new Error('INVALID_KEY:Memcached key must not contain whitespace or control characters.');
    }

    await writeLine(socket, `get ${key}\r\n`);
    const firstLine = await readLine();
    if (firstLine === 'END') {
      return {
        found: false,
        flags: null,
        bytes: null,
        value: null,
      };
    }

    const tokens = firstLine.split(' ');
    if (tokens[0] !== 'VALUE' || tokens.length < 4) {
      throw new Error(`PROTOCOL_ERROR:${firstLine}`);
    }

    const flags = Number.parseInt(tokens[2] ?? '', 10);
    const byteLength = Number.parseInt(tokens[3] ?? '', 10);
    if (Number.isNaN(flags) || Number.isNaN(byteLength)) {
      throw new Error(`PROTOCOL_ERROR:${firstLine}`);
    }

    const valueBuffer = await readBytes(byteLength + 2);
    const terminator = valueBuffer.subarray(byteLength, byteLength + 2).toString('utf8');
    if (terminator !== '\r\n') {
      throw new Error('PROTOCOL_ERROR:Invalid value terminator');
    }

    const endLine = await readLine();
    if (endLine !== 'END') {
      throw new Error(`PROTOCOL_ERROR:${endLine}`);
    }

    return {
      found: true,
      flags,
      bytes: byteLength,
      value: valueBuffer.subarray(0, byteLength).toString('utf8'),
    };
  };

  const stats = async (): Promise<MemcachedStatsResult> => {
    await writeLine(socket, 'stats\r\n');
    const rows: MemcachedStatsResult = [];
    for (;;) {
      const line = await readLine();
      if (line === 'END') {
        break;
      }
      if (!line.startsWith('STAT ')) {
        throw new Error(`PROTOCOL_ERROR:${line}`);
      }
      const parts = line.split(' ');
      const key = parts[1];
      if (!key) {
        continue;
      }
      rows.push({
        key,
        value: parts.slice(2).join(' '),
      });
    }
    return rows;
  };

  return {
    get,
    stats,
    disconnect: async () => {
      socket.end();
      socket.destroy();
    },
  };
};
