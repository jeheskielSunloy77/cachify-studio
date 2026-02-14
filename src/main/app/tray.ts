import {
  Menu,
  Tray,
  app,
  nativeImage,
  type MenuItemConstructorOptions,
} from 'electron';
import { connectionSessionService } from '../domain/cache/session/connection-session.service';
import { profilesService } from '../domain/persistence/services/connection-profiles.service';
import { showOrCreateMainWindow } from './create-main-window';

const TRAY_ICON_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wm0f8YAAAAASUVORK5CYII=';
const TRAY_TITLE = 'Cachify Studio';
const MAX_RECENT_CONNECTIONS = 5;

let tray: Tray | null = null;
let unsubscribeStatus: (() => void) | null = null;
let refreshQueue = Promise.resolve();

const resolveEnvironmentLabel = (value: string | null) => value ?? 'none';

const resolveSafetyLabel = () => {
  const status = connectionSessionService.getStatus();
  if (status.state !== 'connected' || !status.activeProfileId) {
    return 'Safety: [SAFE] no active connection · readOnly';
  }

  const marker = status.safetyMode === 'unlocked' ? '[UNLOCKED]' : '[SAFE]';
  return `Safety: ${marker} ${resolveEnvironmentLabel(status.environmentLabel)} · ${status.safetyMode}`;
};

const logConnectionError = (action: 'connect' | 'switch', profileId: string, error: unknown) => {
  const details =
    typeof error === 'object' && error != null && 'message' in error
      ? (error as { message?: unknown }).message
      : error;
  console.warn(`[tray] ${action} failed for profile ${profileId}`, details);
};

const activateRecentConnection = async (profileId: string) => {
  showOrCreateMainWindow();
  const status = connectionSessionService.getStatus();
  if (status.state === 'connected') {
    if (status.activeProfileId === profileId) {
      return;
    }
    const switched = await connectionSessionService.switch(profileId);
    if ('error' in switched) {
      logConnectionError('switch', profileId, switched.error);
    }
    return;
  }

  const connected = await connectionSessionService.connect(profileId);
  if ('error' in connected) {
    logConnectionError('connect', profileId, connected.error);
  }
};

const buildRecentConnectionsMenu = async (): Promise<MenuItemConstructorOptions[]> => {
  try {
    const profiles = await profilesService.list();
    const recentProfiles = profiles.slice(0, MAX_RECENT_CONNECTIONS);
    if (recentProfiles.length === 0) {
      return [
        {
          label: 'No recent connections',
          enabled: false,
        },
      ];
    }

    return recentProfiles.map((profile) => ({
      label: `${profile.name} (${profile.environment})`,
      click: () => {
        void activateRecentConnection(profile.id);
      },
    }));
  } catch (error) {
    console.error('[tray] Failed to load recent connections', error);
    return [
      {
        label: 'Unable to load recent connections',
        enabled: false,
      },
    ];
  }
};

const buildMenuTemplate = async (): Promise<MenuItemConstructorOptions[]> => {
  const recentConnectionsSubmenu = await buildRecentConnectionsMenu();
  return [
    {
      label: resolveSafetyLabel(),
      enabled: false,
    },
    {
      type: 'separator',
    },
    {
      label: 'Open app',
      click: () => {
        showOrCreateMainWindow();
      },
    },
    {
      label: 'Recent connections',
      submenu: recentConnectionsSubmenu,
    },
    {
      type: 'separator',
    },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      },
    },
  ];
};

export const refreshTrayMenu = async () => {
  if (!tray) {
    return;
  }

  refreshQueue = refreshQueue
    .then(async () => {
      const template = await buildMenuTemplate();
      tray?.setToolTip(TRAY_TITLE);
      tray?.setContextMenu(Menu.buildFromTemplate(template));
    })
    .catch((error) => {
      console.error('[tray] Failed to rebuild tray menu', error);
    });

  await refreshQueue;
};

export const initializeTray = async () => {
  if (tray) {
    return tray;
  }

  tray = new Tray(nativeImage.createFromDataURL(TRAY_ICON_DATA_URL));
  tray.setToolTip(TRAY_TITLE);
  tray.on('click', () => {
    showOrCreateMainWindow();
  });

  unsubscribeStatus = connectionSessionService.subscribe(() => {
    void refreshTrayMenu();
  });

  await refreshTrayMenu();
  return tray;
};

export const disposeTray = () => {
  if (unsubscribeStatus) {
    unsubscribeStatus();
    unsubscribeStatus = null;
  }
  if (tray) {
    tray.destroy();
    tray = null;
  }
};
