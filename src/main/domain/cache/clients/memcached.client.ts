import { Socket } from 'node:net';

type MemcachedConnectOptions = {
  host: string;
  port: number;
  timeoutMs: number;
  authMode: 'none' | 'sasl';
  username?: string;
  password?: string;
};

type MemcachedClientHandle = {
  disconnect: () => Promise<void>;
};

const readLine = (socket: Socket, timeoutMs: number) =>
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

  await writeLine(socket, 'version\r\n');
  const response = await readLine(socket, options.timeoutMs);
  if (!response.startsWith('VERSION')) {
    socket.destroy();
    throw new Error(`CONNECTION_FAILED:${response}`);
  }

  return {
    disconnect: async () => {
      socket.end();
      socket.destroy();
    },
  };
};
