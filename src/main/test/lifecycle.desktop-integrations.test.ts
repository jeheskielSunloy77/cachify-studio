// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const appHandlers = new Map<string, () => void>();
  return {
    appHandlers,
    appQuit: vi.fn(),
    appWhenReady: vi.fn(() => Promise.resolve()),
    appOn: vi.fn((event: string, handler: () => void) => {
      appHandlers.set(event, handler);
    }),
    getAllWindows: vi.fn(() => []),
    createMainWindow: vi.fn(),
    registerIpcHandlers: vi.fn(),
    initializePersistence: vi.fn(async () => undefined),
    initializeTray: vi.fn(async () => undefined),
    disposeTray: vi.fn(),
    registerGlobalSearchShortcut: vi.fn(),
    unregisterGlobalSearchShortcut: vi.fn(),
  };
});

vi.mock('electron', () => ({
  app: {
    whenReady: mocks.appWhenReady,
    on: mocks.appOn,
    quit: mocks.appQuit,
  },
  BrowserWindow: {
    getAllWindows: mocks.getAllWindows,
  },
}));

vi.mock('electron-squirrel-startup', () => ({
  default: false,
}));

vi.mock('../app/create-main-window', () => ({
  createMainWindow: mocks.createMainWindow,
}));

vi.mock('../ipc/register-handlers', () => ({
  registerIpcHandlers: mocks.registerIpcHandlers,
}));

vi.mock('../domain/persistence/db/connection', () => ({
  initializePersistence: mocks.initializePersistence,
}));

vi.mock('../app/tray', () => ({
  initializeTray: mocks.initializeTray,
  disposeTray: mocks.disposeTray,
}));

vi.mock('../app/global-shortcut', () => ({
  registerGlobalSearchShortcut: mocks.registerGlobalSearchShortcut,
  unregisterGlobalSearchShortcut: mocks.unregisterGlobalSearchShortcut,
}));

describe('app lifecycle desktop integrations', () => {
  const flushAsync = async () => new Promise((resolve) => setTimeout(resolve, 0));

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.appHandlers.clear();
  });

  it('initializes tray and global shortcut after app readiness', async () => {
    const mod = await import('../app/lifecycle');
    mod.startAppLifecycle();
    await flushAsync();
    await flushAsync();

    expect(mocks.initializePersistence).toHaveBeenCalledTimes(1);
    expect(mocks.registerIpcHandlers).toHaveBeenCalledTimes(1);
    expect(mocks.createMainWindow).toHaveBeenCalledTimes(1);
    expect(mocks.registerGlobalSearchShortcut).toHaveBeenCalledTimes(1);
    expect(mocks.initializeTray).toHaveBeenCalledTimes(1);
  });

  it('recreates window on activate when all windows are closed', async () => {
    const mod = await import('../app/lifecycle');
    mod.startAppLifecycle();
    await flushAsync();
    await flushAsync();

    mocks.getAllWindows.mockReturnValue([]);
    const activateHandler = mocks.appHandlers.get('activate');
    expect(activateHandler).toBeDefined();
    activateHandler?.();

    expect(mocks.createMainWindow).toHaveBeenCalledTimes(2);
  });

  it('cleans up tray and shortcut registrations on before-quit', async () => {
    const mod = await import('../app/lifecycle');
    mod.startAppLifecycle();
    await flushAsync();
    await flushAsync();

    const beforeQuitHandler = mocks.appHandlers.get('before-quit');
    expect(beforeQuitHandler).toBeDefined();
    beforeQuitHandler?.();

    expect(mocks.unregisterGlobalSearchShortcut).toHaveBeenCalledTimes(1);
    expect(mocks.disposeTray).toHaveBeenCalledTimes(1);
  });
});
