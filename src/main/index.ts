import path from 'path';
import { app, globalShortcut, Tray, Menu, nativeImage, clipboard, dialog } from 'electron';
import { PopupWindowManager } from './windows/popup-window';
import { createMainWindow } from './windows/main-window';
import { registerIpcHandlers } from './ipc/handlers';
import ConfigManager from './services/config-manager';
import ShortcutManager from './services/shortcut-manager';
import PrivacyManager from './services/privacy-manager';
import { DEFAULT_SHORTCUT } from '../shared/constants';

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

if (process.platform === 'linux') {
  app.commandLine.appendSwitch('no-sandbox');
}

function createMain(): void {
  mainWindow = createMainWindow();
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

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

/** Treat clipboard/selection that looks like a shortcut accelerator as empty so we don't enhance it. */
function looksLikeShortcutString(s: string): boolean {
  const t = s.trim();
  if (!t) return true;
  const shortcutTokens = /^(CommandOrControl|Ctrl|Control|Command|Shift|Alt|Option|Super)(\+[A-Za-z0-9]+)*$/;
  return shortcutTokens.test(t) || /\b(Ctrl|Control|Command|Shift|Alt|CommandOrControl)\b/.test(t);
}

function normalizeShortcut(input: string): string {
  const raw = (input || '').trim();
  if (!raw) return DEFAULT_SHORTCUT;
  return raw
    .replace(/\s+/g, '')
    .replace(/\bCtrl\b/gi, 'CommandOrControl')
    .replace(/\bControl\b/gi, 'CommandOrControl')
    .replace(/\bOption\b/gi, 'Alt')
    .replace(/^\+|\+$/g, '');
}

function registerGlobalShortcut(accelerator: string): void {
  if (!app.isReady()) return;
  const normalized = normalizeShortcut(accelerator);
  globalShortcut.unregisterAll();
  const onShortcutTriggered = () => {
    let text = ShortcutManager.getSelectedText()?.trim() ?? '';
    if (!text) {
      text = clipboard.readText()?.trim() ?? '';
    }
    if (looksLikeShortcutString(text)) {
      text = '';
    }
    const cursorPosition = ShortcutManager.getCursorPosition();
    const popup = popupManager.create(cursorPosition.x, cursorPosition.y);
    popup.webContents.once('did-finish-load', () => {
      popupManager.send('text-selected', {
        text: text || '',
        timestamp: Date.now(),
      });
    });
  };

  const success = globalShortcut.register(normalized, onShortcutTriggered);
  if (!success) {
    console.error(`Failed to register shortcut: ${normalized}`);
    if (normalized !== DEFAULT_SHORTCUT) {
      globalShortcut.unregisterAll();
      const fallbackSuccess = globalShortcut.register(DEFAULT_SHORTCUT, onShortcutTriggered);
      if (fallbackSuccess) {
        ConfigManager.setShortcut(DEFAULT_SHORTCUT);
        dialog.showErrorBox(
          'Shortcut fallback',
          `Could not register "${normalized}". Switched to default "${DEFAULT_SHORTCUT}".`
        );
        return;
      }
    }
    dialog.showErrorBox('Shortcut conflict', 'Could not register the keyboard shortcut. It may be used by another app.');
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
  const iconPath = path.join(__dirname, '../../../assets/icon.png');
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
  if (app.isReady()) {
    globalShortcut.unregisterAll();
  }
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
