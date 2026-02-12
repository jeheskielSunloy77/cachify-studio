// @vitest-environment node
import net from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { connectMemcachedClient } from '../domain/cache/clients/memcached.client';

const servers: net.Server[] = [];

const startServer = async (
  onCommand: (command: string, socket: net.Socket) => void,
) => {
  const server = net.createServer((socket) => {
    let buffer = '';
    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      while (buffer.includes('\r\n')) {
        const index = buffer.indexOf('\r\n');
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        onCommand(line, socket);
      }
    });
  });
  servers.push(server);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to bind memcached test server');
  }
  return {
    host: '127.0.0.1',
    port: address.port,
    server,
  };
};

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => resolve());
        }),
    ),
  );
});

describe('memcached client', () => {
  it('parses get hit/miss and stats responses', async () => {
    const { host, port } = await startServer((command, socket) => {
      if (command === 'version') {
        socket.write('VERSION 1.6.0\r\n');
        return;
      }
      if (command === 'get hit') {
        socket.write('VALUE hit 7 5\r\nhello\r\nEND\r\n');
        return;
      }
      if (command === 'get miss') {
        socket.write('END\r\n');
        return;
      }
      if (command === 'stats') {
        socket.write('STAT pid 11\r\nSTAT curr_items 2\r\nEND\r\n');
      }
    });

    const client = await connectMemcachedClient({
      host,
      port,
      timeoutMs: 500,
      authMode: 'none',
    });

    const hit = await client.get('hit');
    const miss = await client.get('miss');
    const stats = await client.stats();

    expect(hit).toEqual({
      found: true,
      flags: 7,
      bytes: 5,
      value: 'hello',
    });
    expect(miss).toEqual({
      found: false,
      flags: null,
      bytes: null,
      value: null,
    });
    expect(stats).toEqual([
      { key: 'pid', value: '11' },
      { key: 'curr_items', value: '2' },
    ]);

    await client.disconnect();
  });

  it('raises protocol errors for malformed get responses', async () => {
    const { host, port } = await startServer((command, socket) => {
      if (command === 'version') {
        socket.write('VERSION 1.6.0\r\n');
        return;
      }
      if (command === 'get broken') {
        socket.write('VALUE broken nope nope\r\n');
      }
    });

    const client = await connectMemcachedClient({
      host,
      port,
      timeoutMs: 500,
      authMode: 'none',
    });

    await expect(client.get('broken')).rejects.toThrow(/PROTOCOL_ERROR/);
    await client.disconnect();
  });

  it('propagates timeout errors for stalled commands', async () => {
    const { host, port } = await startServer((command, socket) => {
      if (command === 'version') {
        socket.write('VERSION 1.6.0\r\n');
      }
      if (command === 'stats') {
        // Intentionally no response to trigger timeout.
      }
    });

    const client = await connectMemcachedClient({
      host,
      port,
      timeoutMs: 50,
      authMode: 'none',
    });

    await expect(client.stats()).rejects.toThrow(/TIMEOUT/);
    await client.disconnect();
  });

  it('rejects invalid memcached keys before sending protocol commands', async () => {
    const { host, port } = await startServer((command, socket) => {
      if (command === 'version') {
        socket.write('VERSION 1.6.0\r\n');
      }
    });

    const client = await connectMemcachedClient({
      host,
      port,
      timeoutMs: 500,
      authMode: 'none',
    });

    await expect(client.get('invalid key')).rejects.toThrow(/INVALID_KEY/);
    await expect(client.get('invalid\r\nkey')).rejects.toThrow(/INVALID_KEY/);
    await client.disconnect();
  });

  it('supports set command with flags/ttl and returns storage metadata', async () => {
    let expectedSetBytes = 0;
    let setAwaitingValue = false;
    const { host, port } = await startServer((command, socket) => {
      if (command === 'version') {
        socket.write('VERSION 1.6.0\r\n');
        return;
      }
      if (command.startsWith('set item 7 120 ')) {
        const bytesToken = command.split(' ')[4] ?? '';
        expectedSetBytes = Number.parseInt(bytesToken, 10);
        setAwaitingValue = true;
        return;
      }
      if (setAwaitingValue) {
        expect(Buffer.byteLength(command, 'utf8')).toBe(expectedSetBytes);
        expect(command).toBe('hello!');
        socket.write('STORED\r\n');
        setAwaitingValue = false;
      }
    });

    const client = await connectMemcachedClient({
      host,
      port,
      timeoutMs: 500,
      authMode: 'none',
    });

    const result = await client.set('item', 'hello!', { flags: 7, ttlSeconds: 120 });
    expect(result).toEqual({
      stored: true,
      flags: 7,
      ttlSeconds: 120,
      bytes: 6,
    });

    await client.disconnect();
  });

  it('validates memcached set flags/ttl arguments', async () => {
    const { host, port } = await startServer((command, socket) => {
      if (command === 'version') {
        socket.write('VERSION 1.6.0\r\n');
      }
    });

    const client = await connectMemcachedClient({
      host,
      port,
      timeoutMs: 500,
      authMode: 'none',
    });

    await expect(
      client.set('item', 'value', { flags: -1 }),
    ).rejects.toThrow(/INVALID_ARGUMENT/);
    await expect(
      client.set('item', 'value', { ttlSeconds: -5 }),
    ).rejects.toThrow(/INVALID_ARGUMENT/);

    await client.disconnect();
  });

  it('raises protocol errors for malformed set responses', async () => {
    let setAwaitingValue = false;
    const { host, port } = await startServer((command, socket) => {
      if (command === 'version') {
        socket.write('VERSION 1.6.0\r\n');
        return;
      }
      if (command.startsWith('set broken 0 0 ')) {
        setAwaitingValue = true;
        return;
      }
      if (setAwaitingValue) {
        socket.write('CLIENT_ERROR bad command line format\r\n');
        setAwaitingValue = false;
      }
    });

    const client = await connectMemcachedClient({
      host,
      port,
      timeoutMs: 500,
      authMode: 'none',
    });

    await expect(client.set('broken', 'value')).rejects.toThrow(/PROTOCOL_ERROR/);
    await client.disconnect();
  });
});
