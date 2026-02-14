import { BrowserWindow } from 'electron';
import path from 'node:path';

let mainWindow: BrowserWindow | null = null;

const loadMainWindow = (window: BrowserWindow) => {
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void window.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    void window.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }
};

export const createMainWindow = () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return mainWindow;
  }

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  loadMainWindow(mainWindow);
  return mainWindow;
};

export const getMainWindow = () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return mainWindow;
  }
  return null;
};

export const showMainWindow = (window: BrowserWindow) => {
  if (window.isMinimized()) {
    window.restore();
  }
  window.show();
  window.focus();
};

export const showOrCreateMainWindow = () => {
  const window = getMainWindow() ?? createMainWindow();
  showMainWindow(window);
  return window;
};
