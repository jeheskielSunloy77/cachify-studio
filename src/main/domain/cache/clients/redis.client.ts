import { Socket } from 'node:net';
import { readFileSync } from 'node:fs';
import tls from 'node:tls';

type RedisConnectOptions = {
  host: string;
  port: number;
  timeoutMs: number;
  username?: string;
  password?: string;
  tls?: {
    enabled: boolean;
    servername?: string;
    caPath?: string;
  };
};

export type RedisCommandValue = string | number | null | RedisCommandValue[];

type RedisClientHandle = {
  disconnect: () => Promise<void>;
  command: (parts: string[]) => Promise<RedisCommandValue>;
};

const toRespArray = (...parts: string[]) =>
  `*${parts.length}\r\n${parts.map((part) => `$${Buffer.byteLength(part)}\r\n${part}\r\n`).join('')}`;

type RedisErrorToken = { __redisError: string };
type RedisParsedValue = RedisCommandValue | RedisErrorToken;
type ParseResult = { value: RedisParsedValue; offset: number } | null;

const isRedisErrorToken = (value: RedisParsedValue): value is RedisErrorToken =>
  typeof value === 'object' && value !== null && '__redisError' in value;

const parseInteger = (line: string) => {
  const parsed = Number.parseInt(line, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`INVALID_INTEGER:${line}`);
  }
  return parsed;
};

const findLine = (buffer: Buffer, start: number) => {
  const end = buffer.indexOf('\r\n', start);
  if (end === -1) {
    return null;
  }
  return {
    line: buffer.toString('utf8', start, end),
    nextOffset: end + 2,
  };
};

const parseResp = (buffer: Buffer, startOffset = 0): ParseResult => {
  if (startOffset >= buffer.length) {
    return null;
  }

  const type = String.fromCharCode(buffer[startOffset] ?? 0);
  const line = findLine(buffer, startOffset + 1);
  if (!line) {
    return null;
  }

  if (type === '+') {
    return { value: line.line, offset: line.nextOffset };
  }

  if (type === '-') {
    return { value: { __redisError: line.line }, offset: line.nextOffset };
  }

  if (type === ':') {
    return { value: parseInteger(line.line), offset: line.nextOffset };
  }

  if (type === '$') {
    const byteLength = parseInteger(line.line);
    if (byteLength === -1) {
      return { value: null, offset: line.nextOffset };
    }
    const payloadEnd = line.nextOffset + byteLength;
    const trailingEnd = payloadEnd + 2;
    if (buffer.length < trailingEnd) {
      return null;
    }
    if (buffer.toString('utf8', payloadEnd, trailingEnd) !== '\r\n') {
      throw new Error('INVALID_BULK_TERMINATOR');
    }
    return {
      value: buffer.toString('utf8', line.nextOffset, payloadEnd),
      offset: trailingEnd,
    };
  }

  if (type === '*') {
    const itemCount = parseInteger(line.line);
    if (itemCount === -1) {
      return { value: null, offset: line.nextOffset };
    }
    const items: RedisCommandValue[] = [];
    let nextOffset = line.nextOffset;
    for (let index = 0; index < itemCount; index += 1) {
      const parsed = parseResp(buffer, nextOffset);
      if (!parsed) {
        return null;
      }
      if (isRedisErrorToken(parsed.value)) {
        throw new Error(`REDIS_ERROR:${parsed.value.__redisError}`);
      }
      items.push(parsed.value);
      nextOffset = parsed.offset;
    }
    return { value: items, offset: nextOffset };
  }

  throw new Error(`INVALID_RESP_PREFIX:${type}`);
};

export const connectRedisClient = async (
  options: RedisConnectOptions,
): Promise<RedisClientHandle> => {
  const socket = options.tls?.enabled
    ? tls.connect({
        host: options.host,
        port: options.port,
        servername: options.tls.servername ?? options.host,
        rejectUnauthorized: true,
        ...(options.tls.caPath
          ? {
              ca: readFileSync(options.tls.caPath),
            }
          : {}),
      })
    : new Socket();
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
    if (options.tls?.enabled) {
      socket.once('secureConnect', () => {
        if (settled) {
          return;
        }
        settled = true;
        socket.setTimeout(0);
        resolve();
      });
    } else {
      socket.connect(options.port, options.host, () => {
        if (settled) {
          return;
        }
        settled = true;
        socket.setTimeout(0);
        resolve();
      });
    }
  });

  let responseBuffer = Buffer.alloc(0);
  let closed = false;
  const pendingCommands: Array<{
    resolve: (value: RedisCommandValue) => void;
    reject: (error: Error) => void;
  }> = [];

  const rejectPending = (error: Error) => {
    while (pendingCommands.length > 0) {
      const pending = pendingCommands.shift();
      pending?.reject(error);
    }
  };

  const drainResponses = () => {
    while (pendingCommands.length > 0) {
      let parsed: ParseResult;
      try {
        parsed = parseResp(responseBuffer);
      } catch (error) {
        const normalized = error instanceof Error ? error : new Error(String(error));
        rejectPending(normalized);
        socket.destroy(normalized);
        return;
      }

      if (!parsed) {
        return;
      }

      responseBuffer = responseBuffer.subarray(parsed.offset);
      const pending = pendingCommands.shift();
      if (!pending) {
        return;
      }
      if (isRedisErrorToken(parsed.value)) {
        pending.reject(new Error(`REDIS_ERROR:${parsed.value.__redisError}`));
        continue;
      }
      pending.resolve(parsed.value);
    }
  };

  socket.on('data', (chunk: Buffer) => {
    responseBuffer = Buffer.concat([responseBuffer, chunk]);
    drainResponses();
  });
  socket.on('error', (error: Error) => {
    rejectPending(error);
  });
  socket.on('close', () => {
    closed = true;
    rejectPending(new Error('CONNECTION_CLOSED'));
  });

  const command = async (parts: string[]) => {
    if (closed) {
      throw new Error('CONNECTION_CLOSED');
    }
    const payload = toRespArray(...parts);
    return new Promise<RedisCommandValue>((resolve, reject) => {
      const pending = { resolve, reject };
      pendingCommands.push(pending);
      socket.write(payload, (error) => {
        if (!error) {
          return;
        }
        const index = pendingCommands.indexOf(pending);
        if (index >= 0) {
          pendingCommands.splice(index, 1);
        }
        reject(error);
      });
    });
  };

  try {
    if (options.password) {
      try {
        await command(
          options.username
            ? ['AUTH', options.username, options.password]
            : ['AUTH', options.password],
        );
      } catch (error) {
        socket.destroy();
        throw new Error(
          `AUTH_FAILED:${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    const pingResponse = await command(['PING']);
    if (pingResponse !== 'PONG') {
      socket.destroy();
      throw new Error(`CONNECTION_FAILED:Unexpected PING response "${String(pingResponse)}"`);
    }
  } catch (error) {
    socket.destroy();
    throw error;
  }

  return {
    command,
    disconnect: async () => {
      socket.end();
      socket.destroy();
    },
  };
};
