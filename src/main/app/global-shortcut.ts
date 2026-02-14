import { globalShortcut } from 'electron';
import { explorerFocusSearchEventChannel } from '../../shared/ipc/ipc.contract';
import {
  createMainWindow,
  getMainWindow,
  showMainWindow,
} from './create-main-window';

export const DEFAULT_GLOBAL_SEARCH_ACCELERATOR = 'CommandOrControl+Shift+K';

let activeAccelerator = DEFAULT_GLOBAL_SEARCH_ACCELERATOR;
let shortcutRegistered = false;

const triggerFocusSearch = () => {
  const existingWindow = getMainWindow();
  const window = existingWindow ?? createMainWindow();
  showMainWindow(window);
  window.webContents.send(explorerFocusSearchEventChannel, {
    requestedAt: new Date().toISOString(),
    source: 'global-shortcut',
  });
};

export const registerGlobalSearchShortcut = (
  accelerator = DEFAULT_GLOBAL_SEARCH_ACCELERATOR,
) => {
  if (shortcutRegistered && activeAccelerator === accelerator) {
    return true;
  }

  if (shortcutRegistered) {
    globalShortcut.unregister(activeAccelerator);
    shortcutRegistered = false;
  }

  try {
    const registered = globalShortcut.register(accelerator, triggerFocusSearch);
    if (!registered) {
      console.warn(
        `[global-shortcut] Registration failed for accelerator "${accelerator}". Continuing without shortcut.`,
      );
      return false;
    }

    activeAccelerator = accelerator;
    shortcutRegistered = true;
    return true;
  } catch (error) {
    console.warn(
      `[global-shortcut] Registration error for accelerator "${accelerator}". Continuing without shortcut.`,
      error,
    );
    return false;
  }
};

export const unregisterGlobalSearchShortcut = () => {
  if (!shortcutRegistered) {
    return;
  }

  globalShortcut.unregister(activeAccelerator);
  shortcutRegistered = false;
};
