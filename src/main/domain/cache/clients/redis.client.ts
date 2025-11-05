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

type RedisClientHandle = {
  disconnect: () => Promise<void>;
};

const toRespArray = (...parts: string[]) =>
  `*${parts.length}\r\n${parts.map((part) => `$${Buffer.byteLength(part)}\r\n${part}\r\n`).join('')}`;

const readRespLine = (socket: Socket, timeoutMs: number) =>
  new Promise<string>((resolve, reject) => {
    let settled = false;
    let buffer = '';
    const timer = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      socket.removeListener('data', onData);
      socket.removeListener('error', onError);
      reject(new Error('TIMEOUT'));
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timer);
      socket.removeListener('data', onData);
      socket.removeListener('error', onError);
    };

    const onError = (error: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(error);
    };

    const onData = (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      if (!buffer.includes('\r\n')) {
        return;
      }

      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve(buffer.split('\r\n')[0] ?? '');
    };

    socket.on('data', onData);
    socket.once('error', onError);
  });

const writeCommand = (socket: Socket, command: string) =>
  new Promise<void>((resolve, reject) => {
    socket.write(command, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

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

  if (options.password) {
    const authCommand = options.username
      ? toRespArray('AUTH', options.username, options.password)
      : toRespArray('AUTH', options.password);
    await writeCommand(socket, authCommand);
    const authResponse = await readRespLine(socket, options.timeoutMs);
    if (authResponse.startsWith('-')) {
      socket.destroy();
      throw new Error(`AUTH_FAILED:${authResponse}`);
    }
  }

  await writeCommand(socket, toRespArray('PING'));
  const pingResponse = await readRespLine(socket, options.timeoutMs);
  if (!pingResponse.startsWith('+PONG')) {
    socket.destroy();
    throw new Error(`CONNECTION_FAILED:${pingResponse}`);
  }

  return {
    disconnect: async () => {
      socket.end();
      socket.destroy();
    },
  };
};
