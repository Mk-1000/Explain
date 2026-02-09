import { app } from 'electron';

/**
 * Optional auto-updater. Install electron-updater and uncomment to enable.
 * When enabled, call checkForUpdates() from main index after app is ready (when app.isPackaged).
 */
export function checkForUpdates(): void {
  if (!app.isPackaged) return;
  // const { autoUpdater } = require('electron-updater');
  // autoUpdater.checkForUpdates();
}
