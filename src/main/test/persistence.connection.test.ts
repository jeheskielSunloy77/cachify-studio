// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('persistence connection lifecycle', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('initializes persistence and marks status ready', async () => {
    const appMock = { getPath: vi.fn(() => '/tmp/cachify-studio-test') };
    const mkdirSync = vi.fn();
    const existsSync = vi.fn(() => false);
    const applyMigrations = vi.fn();
    const db = { __db: true };
    const sqlite = { __sqlite: true };
    const createSqliteDatabase = vi.fn(() => ({ sqlite, db }));

    vi.doMock('electron', () => ({ app: appMock }));
    vi.doMock('node:fs', () => ({ mkdirSync, existsSync }));
    vi.doMock('../domain/persistence/db/migrations', () => ({ applyMigrations }));
    vi.doMock('../domain/persistence/db/sqlite', () => ({ createSqliteDatabase }));

    const mod = await import('../domain/persistence/db/connection');
    await mod.initializePersistence();

    expect(mkdirSync).toHaveBeenCalledWith('/tmp/cachify-studio-test', { recursive: true });
    expect(createSqliteDatabase).toHaveBeenCalledWith('/tmp/cachify-studio-test/cachify.sqlite');
    expect(applyMigrations).toHaveBeenCalledWith(sqlite);
    expect(mod.getPersistenceStatus().ready).toBe(true);
    expect(mod.getDatabase()).toBe(db);
  });

  it('marks status failed when initialization throws', async () => {
    const appMock = { getPath: vi.fn(() => '/tmp/cachify-studio-test') };
    const mkdirSync = vi.fn();
    const existsSync = vi.fn(() => true);
    const applyMigrations = vi.fn();
    const createSqliteDatabase = vi.fn(() => {
      throw new Error('sqlite open failed');
    });

    vi.doMock('electron', () => ({ app: appMock }));
    vi.doMock('node:fs', () => ({ mkdirSync, existsSync }));
    vi.doMock('../domain/persistence/db/migrations', () => ({ applyMigrations }));
    vi.doMock('../domain/persistence/db/sqlite', () => ({ createSqliteDatabase }));

    const mod = await import('../domain/persistence/db/connection');
    await mod.initializePersistence();
    const status = mod.getPersistenceStatus();

    expect(status.ready).toBe(false);
    expect(status.code).toBe('PERSISTENCE_INIT_FAILED');
    expect(() => mod.getDatabase()).toThrowError('Persistence is not available');
  });
});
