import path from 'path';
import { app, globalShortcut, Tray, Menu, nativeImage } from 'electron';
import { PopupWindowManager } from './windows/popup-window';
import { createMainWindow } from './windows/main-window';
import { registerIpcHandlers } from './ipc/handlers';
import ConfigManager from './services/config-manager';
import ShortcutManager from './services/shortcut-manager';
import PrivacyManager from './services/privacy-manager';

declare global {
  namespace Electron {
    interface App {
      isQuitting?: boolean;
    }
  }
}

let mainWindow: ReturnType<typeof createMainWindow> | null = null;
let tray: Tray | null = null;
const popupManager = new PopupWindowManager();

function createMain(): void {
  mainWindow = createMainWindow();

  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function registerGlobalShortcut(accelerator: string): void {
  globalShortcut.unregisterAll();
  const success = globalShortcut.register(accelerator, () => {
    const selectedText = ShortcutManager.getSelectedText();
    if (!selectedText?.trim()) return;
    const cursorPosition = ShortcutManager.getCursorPosition();
    const popup = popupManager.create(cursorPosition.x, cursorPosition.y);
    popup.webContents.once('did-finish-load', () => {
      popupManager.send('text-selected', {
        text: selectedText,
        timestamp: Date.now(),
      });
    });
  });
  if (!success) {
    console.error('Failed to register global shortcut');
  }
}

function initializeApp(): void {
  const config = ConfigManager.getAll();
  PrivacyManager.setExcludedApps(config.excludedApps ?? []);

  // Register IPC before creating windows so renderer getConfig() is handled
  registerIpcHandlers(
    () => popupManager.close(),
    () => registerGlobalShortcut(ConfigManager.getShortcut())
  );

  const { ipcMain } = require('electron');
  ipcMain.handle('window:show-settings', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
    return true;
  });

  createMain();

  const shortcut = ConfigManager.getShortcut();
  registerGlobalShortcut(shortcut);

  // System tray (minimal-example, quick-start: tray icon with Settings / Quit)
  const iconPath = path.join(__dirname, '../../assets/icon.png');
  const icon = nativeImage.createFromPath(iconPath);
  const trayIcon = icon.isEmpty()
    ? nativeImage.createFromDataURL(
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMklEQVQ4T2NkYGD4z0ABYBzVMKoBBg1GNAzGMWAY1YCBgYEBogHZChQNQzQAAQYAhmgGAb+lL2AAAAAASUVORK5CYII='
      )
    : icon;
  tray = new Tray(trayIcon.resize({ width: 16, height: 16 }));
  tray.setToolTip('AI Text Enhancer');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Settings', click: () => { mainWindow?.show(); mainWindow?.focus(); } },
      { type: 'separator' },
      { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } },
    ])
  );
  tray.on('click', () => { mainWindow?.show(); mainWindow?.focus(); });
}

app.whenReady().then(initializeApp);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createMain();
  } else {
    mainWindow.show();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}
