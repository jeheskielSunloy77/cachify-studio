// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { explorerFocusSearchEventChannel } from '../../shared/ipc/ipc.contract';

const mocks = vi.hoisted(() => ({
  register: vi.fn(),
  unregister: vi.fn(),
  createMainWindow: vi.fn(),
  getMainWindow: vi.fn(),
  showMainWindow: vi.fn(),
}));

vi.mock('electron', () => ({
  globalShortcut: {
    register: mocks.register,
    unregister: mocks.unregister,
  },
}));

vi.mock('../app/create-main-window', () => ({
  createMainWindow: mocks.createMainWindow,
  getMainWindow: mocks.getMainWindow,
  showMainWindow: mocks.showMainWindow,
}));

describe('global shortcut integration', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    const mockWindow = {
      webContents: {
        send: vi.fn(),
      },
    };
    mocks.createMainWindow.mockReturnValue(mockWindow);
    mocks.getMainWindow.mockReturnValue(mockWindow);
    mocks.register.mockReturnValue(true);
  });

  it('registers shortcut once for repeated startup calls', async () => {
    const mod = await import('../app/global-shortcut');
    expect(mod.registerGlobalSearchShortcut()).toBe(true);
    expect(mod.registerGlobalSearchShortcut()).toBe(true);
    expect(mocks.register).toHaveBeenCalledTimes(1);
    expect(mocks.register).toHaveBeenCalledWith(
      mod.DEFAULT_GLOBAL_SEARCH_ACCELERATOR,
      expect.any(Function),
    );
  });

  it('foregrounds app and emits typed focus-search event on shortcut callback', async () => {
    const mod = await import('../app/global-shortcut');
    mod.registerGlobalSearchShortcut();

    const callback = mocks.register.mock.calls[0]?.[1] as (() => void) | undefined;
    expect(callback).toBeDefined();
    callback?.();

    const sent = mocks.getMainWindow.mock.results[0]?.value?.webContents?.send as ReturnType<
      typeof vi.fn
    >;
    expect(mocks.getMainWindow).toHaveBeenCalledTimes(1);
    expect(mocks.createMainWindow).not.toHaveBeenCalled();
    expect(mocks.showMainWindow).toHaveBeenCalledTimes(1);
    expect(sent).toHaveBeenCalledWith(
      explorerFocusSearchEventChannel,
      expect.objectContaining({
        source: 'global-shortcut',
        requestedAt: expect.any(String),
      }),
    );
  });

  it('creates a window when none exists before emitting focus-search event', async () => {
    const createdWindow = {
      webContents: {
        send: vi.fn(),
      },
    };
    mocks.getMainWindow.mockReturnValue(null);
    mocks.createMainWindow.mockReturnValue(createdWindow);

    const mod = await import('../app/global-shortcut');
    mod.registerGlobalSearchShortcut();
    const callback = mocks.register.mock.calls[0]?.[1] as (() => void) | undefined;
    callback?.();

    expect(mocks.createMainWindow).toHaveBeenCalledTimes(1);
    expect(mocks.showMainWindow).toHaveBeenCalledWith(createdWindow);
    expect(createdWindow.webContents.send).toHaveBeenCalledWith(
      explorerFocusSearchEventChannel,
      expect.objectContaining({
        source: 'global-shortcut',
      }),
    );
  });

  it('logs warning and continues when accelerator registration fails', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mocks.register.mockReturnValue(false);
    const mod = await import('../app/global-shortcut');

    expect(mod.registerGlobalSearchShortcut()).toBe(false);
    expect(warning).toHaveBeenCalledWith(
      expect.stringContaining('Registration failed'),
    );
  });

  it('unregisters active shortcut on cleanup', async () => {
    const mod = await import('../app/global-shortcut');
    mod.registerGlobalSearchShortcut();
    mod.unregisterGlobalSearchShortcut();

    expect(mocks.unregister).toHaveBeenCalledWith(
      mod.DEFAULT_GLOBAL_SEARCH_ACCELERATOR,
    );
  });
});
