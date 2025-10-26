import { app } from 'electron';
import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { applyMigrations } from './migrations';
import { createSqliteDatabase, type SqliteDrizzleDatabase } from './sqlite';

let cachedDatabase: SqliteDrizzleDatabase | null = null;
let initializationAttempted = false;

type PersistenceStatus = {
  ready: boolean;
  code?: 'PERSISTENCE_INIT_FAILED' | 'PERSISTENCE_UNAVAILABLE';
  diagnosticId?: string;
};

let persistenceStatus: PersistenceStatus = {
  ready: false,
  code: 'PERSISTENCE_UNAVAILABLE',
};

const buildDiagnosticId = () =>
  `persist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const toErrorDetails = (error: unknown) => {
  if (!(error instanceof Error)) {
    return { message: String(error) };
  }

  return {
    name: error.name,
    message: error.message,
    stack: error.stack?.split('\n').slice(0, 3).join('\n'),
  };
};

const getAbiDiagnostics = () => {
  const electronVersion = process.versions.electron ?? 'unknown';
  const electronAbi = process.versions.modules;
  return {
    electronVersion,
    electronAbi,
    hostNodeVersion: process.version,
    hostNodeAbi: process.versions.modules,
    nativeBinaryPath:
      process.platform === 'win32'
        ? join(process.cwd(), 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node')
        : join(process.cwd(), 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node'),
  };
};

const resolveDatabasePath = () => {
  const userDataPath = app.getPath('userData');
  if (!existsSync(userDataPath)) {
    mkdirSync(userDataPath, { recursive: true });
  }
  return {
    userDataPath,
    dbPath: join(userDataPath, 'cachify.sqlite'),
  };
};

const logLegacyDataPathHint = (userDataPath: string) => {
  const legacyPath = join(homedir(), '.config', 'cachify-studio');
  if (legacyPath !== userDataPath && existsSync(legacyPath)) {
    console.info(`[persistence] legacy data path detected (not migrated): ${legacyPath}`);
  }
};

export const initializePersistence = async (): Promise<void> => {
  if (initializationAttempted && cachedDatabase) {
    return;
  }

  initializationAttempted = true;

  try {
    const { userDataPath, dbPath } = resolveDatabasePath();
    console.info(`[persistence] userData path: ${userDataPath}`);
    logLegacyDataPathHint(userDataPath);

    const { sqlite, db } = createSqliteDatabase(dbPath);
    applyMigrations(sqlite);
    cachedDatabase = db;
    persistenceStatus = { ready: true };
  } catch (error) {
    const diagnosticId = buildDiagnosticId();
    persistenceStatus = {
      ready: false,
      code: 'PERSISTENCE_INIT_FAILED',
      diagnosticId,
    };
    console.error(`[persistence:${diagnosticId}] abi diagnostics`, getAbiDiagnostics());
    console.error(`[persistence:${diagnosticId}] initialization failed`, toErrorDetails(error));
  }
};

export const getPersistenceStatus = (): PersistenceStatus => {
  if (cachedDatabase) {
    return { ready: true };
  }

  return persistenceStatus;
};

export const getDatabase = () => {
  if (cachedDatabase) {
    return cachedDatabase;
  }

  const status = getPersistenceStatus();
  const error = new Error('Persistence is not available');
  (error as Error & { code?: string; diagnosticId?: string }).code =
    status.code ?? 'PERSISTENCE_UNAVAILABLE';
  (error as Error & { code?: string; diagnosticId?: string }).diagnosticId = status.diagnosticId;
  throw error;
};
