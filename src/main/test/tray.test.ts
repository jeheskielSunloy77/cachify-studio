// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConnectionStatus } from '../../shared/ipc/ipc.contract';

type MockMenuItem = {
  label?: string;
  enabled?: boolean;
  type?: 'separator';
  submenu?: MockMenuItem[];
  click?: () => void | Promise<void>;
};

const mocks = vi.hoisted(() => {
  const subscribers = new Set<() => void>();
  const traySetContextMenu = vi.fn();
  const traySetToolTip = vi.fn();
  const trayOn = vi.fn();
  const trayDestroy = vi.fn();
  const trayInstance = {
    setContextMenu: traySetContextMenu,
    setToolTip: traySetToolTip,
    on: trayOn,
    destroy: trayDestroy,
  };

  return {
    subscribers,
    traySetContextMenu,
    traySetToolTip,
    trayOn,
    trayDestroy,
    trayInstance,
    trayCtor: vi.fn(function TrayMock() {
      return trayInstance;
    }),
    menuBuildFromTemplate: vi.fn((template: MockMenuItem[]) => ({ template })),
    appQuit: vi.fn(),
    createFromDataURL: vi.fn(() => ({ icon: true })),
    profilesService: {
      list: vi.fn(),
    },
    connectionSessionService: {
      subscribe: vi.fn((listener: () => void) => {
        subscribers.add(listener);
        return () => {
          subscribers.delete(listener);
        };
      }),
      getStatus: vi.fn(),
      connect: vi.fn(),
      switch: vi.fn(),
    },
    showOrCreateMainWindow: vi.fn(),
  };
});

vi.mock('electron', () => ({
  Tray: mocks.trayCtor,
  Menu: {
    buildFromTemplate: mocks.menuBuildFromTemplate,
  },
  app: {
    quit: mocks.appQuit,
  },
  nativeImage: {
    createFromDataURL: mocks.createFromDataURL,
  },
}));

vi.mock('../domain/persistence/services/connection-profiles.service', () => ({
  profilesService: mocks.profilesService,
}));

vi.mock('../domain/cache/session/connection-session.service', () => ({
  connectionSessionService: mocks.connectionSessionService,
}));

vi.mock('../app/create-main-window', () => ({
  showOrCreateMainWindow: mocks.showOrCreateMainWindow,
}));

const flushAsync = async () => new Promise((resolve) => setTimeout(resolve, 0));

const defaultDisconnectedStatus: ConnectionStatus = {
  state: 'disconnected',
  activeProfileId: null,
  pendingProfileId: null,
  activeKind: null,
  environmentLabel: null,
  safetyMode: 'readOnly',
  safetyUpdatedAt: 'now',
  lastConnectionError: null,
  updatedAt: 'now',
};

describe('tray menu', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.subscribers.clear();
    mocks.profilesService.list.mockResolvedValue([]);
    mocks.connectionSessionService.getStatus.mockReturnValue(defaultDisconnectedStatus);
    mocks.connectionSessionService.connect.mockResolvedValue({ ok: true, data: defaultDisconnectedStatus });
    mocks.connectionSessionService.switch.mockResolvedValue({ ok: true, data: defaultDisconnectedStatus });
    mocks.showOrCreateMainWindow.mockReturnValue({
      isMinimized: () => false,
      restore: vi.fn(),
      show: vi.fn(),
      focus: vi.fn(),
      webContents: {
        send: vi.fn(),
      },
    });
  });

  afterEach(async () => {
    const mod = await import('../app/tray');
    mod.disposeTray();
  });

  it('builds tray menu with safety indicator and fallback recent item while disconnected', async () => {
    const mod = await import('../app/tray');
    await mod.initializeTray();
    await flushAsync();

    expect(mocks.trayCtor).toHaveBeenCalledTimes(1);
    expect(mocks.menuBuildFromTemplate).toHaveBeenCalled();

    const template = mocks.menuBuildFromTemplate.mock.calls.at(-1)?.[0] as MockMenuItem[];
    expect(template.some((item) => item.label?.includes('Safety:'))).toBe(true);
    expect(template.some((item) => item.label === 'Open app')).toBe(true);
    expect(template.some((item) => item.label === 'Quit')).toBe(true);

    const recentRoot = template.find((item) => item.label === 'Recent connections');
    expect(recentRoot?.submenu?.[0]?.label).toContain('No recent connections');
  });

  it('renders read-only and unlocked safety markers with environment labels', async () => {
    const mod = await import('../app/tray');

    mocks.connectionSessionService.getStatus.mockReturnValue({
      ...defaultDisconnectedStatus,
      state: 'connected',
      activeProfileId: 'profile-1',
      activeKind: 'redis',
      environmentLabel: 'prod',
      safetyMode: 'readOnly',
    });
    await mod.initializeTray();
    await flushAsync();

    let template = mocks.menuBuildFromTemplate.mock.calls.at(-1)?.[0] as MockMenuItem[];
    expect(template.some((item) => item.label?.includes('[SAFE] prod'))).toBe(true);

    mocks.connectionSessionService.getStatus.mockReturnValue({
      ...defaultDisconnectedStatus,
      state: 'connected',
      activeProfileId: 'profile-1',
      activeKind: 'redis',
      environmentLabel: 'local',
      safetyMode: 'unlocked',
    });
    mocks.subscribers.forEach((listener) => listener());
    await flushAsync();

    template = mocks.menuBuildFromTemplate.mock.calls.at(-1)?.[0] as MockMenuItem[];
    expect(template.some((item) => item.label?.includes('[UNLOCKED] local'))).toBe(true);
  });

  it('wires recent connection click to focus/open app and connect/switch flow', async () => {
    const mod = await import('../app/tray');
    mocks.profilesService.list.mockResolvedValue([
      {
        id: 'profile-2',
        name: 'Redis B',
        updatedAt: '2026-02-14T10:00:00.000Z',
      },
      {
        id: 'profile-1',
        name: 'Redis A',
        updatedAt: '2026-02-14T09:00:00.000Z',
      },
    ]);

    await mod.initializeTray();
    await flushAsync();

    let template = mocks.menuBuildFromTemplate.mock.calls.at(-1)?.[0] as MockMenuItem[];
    const recentRoot = template.find((item) => item.label === 'Recent connections');
    const firstRecent = recentRoot?.submenu?.find((item) => item.label?.includes('Redis B'));
    expect(firstRecent?.click).toBeDefined();
    await firstRecent?.click?.();
    expect(mocks.showOrCreateMainWindow).toHaveBeenCalled();
    expect(mocks.connectionSessionService.connect).toHaveBeenCalledWith('profile-2');

    mocks.connectionSessionService.getStatus.mockReturnValue({
      ...defaultDisconnectedStatus,
      state: 'connected',
      activeProfileId: 'profile-1',
      activeKind: 'redis',
      environmentLabel: 'local',
    });
    mocks.subscribers.forEach((listener) => listener());
    await flushAsync();

    template = mocks.menuBuildFromTemplate.mock.calls.at(-1)?.[0] as MockMenuItem[];
    const reconnectTarget = template
      .find((item) => item.label === 'Recent connections')
      ?.submenu?.find((item) => item.label?.includes('Redis B'));
    await reconnectTarget?.click?.();
    expect(mocks.connectionSessionService.switch).toHaveBeenCalledWith('profile-2');
  });

  it('creates a single tray instance and refreshes menu on status changes', async () => {
    const mod = await import('../app/tray');

    await mod.initializeTray();
    await mod.initializeTray();
    await flushAsync();

    expect(mocks.trayCtor).toHaveBeenCalledTimes(1);
    const initialRenderCount = mocks.traySetContextMenu.mock.calls.length;

    mocks.subscribers.forEach((listener) => listener());
    await flushAsync();

    expect(mocks.traySetContextMenu.mock.calls.length).toBeGreaterThan(initialRenderCount);

    mod.disposeTray();
    expect(mocks.trayDestroy).toHaveBeenCalledTimes(1);
  });
});
