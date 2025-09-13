import { app, BrowserWindow } from 'electron';
import started from 'electron-squirrel-startup';
import { createMainWindow } from './create-main-window';
import { registerIpcHandlers } from '../ipc/register-handlers';

export const startAppLifecycle = () => {
  if (started) {
    app.quit();
    return;
  }

  app.whenReady().then(() => {
    registerIpcHandlers();
    createMainWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
};
