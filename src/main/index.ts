import path from 'path';
import { app, globalShortcut, Tray, Menu, nativeImage, clipboard, dialog, BrowserWindow, IpcMainEvent } from 'electron';
import { PopupWindowManager } from './windows/popup-window';
import { PopupChatWindowManager } from './windows/popup-chat-window';
import { createMainWindow } from './windows/main-window';
import { registerIpcHandlers } from './ipc/handlers';
import { registerChatHandlers } from './ipc/chat-handlers';
import ConfigManager from './services/config-manager';
import ShortcutManager from './services/shortcut-manager';
import PrivacyManager from './services/privacy-manager';
import { DEFAULT_SHORTCUT } from '../shared/constants';
import { getLogoIconPath } from './utils/asset-path';

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
const chatManager = new PopupChatWindowManager();

// Check if app was launched with --hidden flag
const launchedHidden = process.argv.includes('--hidden');

if (process.platform === 'linux') {
  app.commandLine.appendSwitch('no-sandbox');
}

function createMain(): void {
  mainWindow = createMainWindow();
  mainWindow.once('ready-to-show', () => {
    // Only show window if not launched hidden
    if (!launchedHidden) {
      mainWindow?.show();
      mainWindow?.focus();
    }
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

// Register chat shortcut (CommandOrControl+Shift+Space)
function registerChatShortcut(): void {
  if (!app.isReady()) return;
  
  const chatShortcut = 'CommandOrControl+Shift+Space';
  
  const success = globalShortcut.register(chatShortcut, async () => {
    try {
      // Get cursor position
      const cursorPosition = ShortcutManager.getCursorPosition();
      
      // Optionally get selected text to use as initial input
      const captureResult = await ShortcutManager.getSelectedText();
      const selectedText = captureResult.text?.trim() || '';
      
      // Create chat window at cursor position
      chatManager.create(
        cursorPosition.x,
        cursorPosition.y,
        selectedText // Pass selected text as initial message
      );
      
      console.log(`[Chat] Window opened at (${cursorPosition.x}, ${cursorPosition.y})`);
    } catch (error) {
      console.error('[Chat] Error opening chat window:', error);
    }
  });

  if (success) {
    console.log(`[Chat] Registered chat shortcut: ${chatShortcut}`);
  } else {
    console.error(`[Chat] Failed to register chat shortcut: ${chatShortcut}`);
  }
}

// Register reformulate shortcut (CommandOrControl+Shift+R)
function registerReformulateShortcut(): void {
  if (!app.isReady()) return;
  
  const reformulateShortcut = 'CommandOrControl+Shift+R';
  
  const success = globalShortcut.register(reformulateShortcut, async () => {
    try {
      // Get text with enhanced metadata
      const captureResult = await ShortcutManager.getSelectedText();
      
      const { text, capturedFrom, copySimulated, captureMethod, attemptCount, totalDuration, platformToolAvailable } = captureResult;
      
      let finalText = text?.trim() ?? '';
      
      // Filter out shortcut strings
      if (looksLikeShortcutString(finalText)) {
        finalText = '';
      }
      
      // Get cursor position
      const cursorPosition = ShortcutManager.getCursorPosition();
      
      // Create popup window (always create, even if no text)
      const popup = popupManager.create(cursorPosition.x, cursorPosition.y);
      
      // Send enhanced data to popup with rephrase enhancement type override
      popup.webContents.once('did-finish-load', () => {
        popupManager.send('text-selected', {
          text: finalText || '',
          hasText: finalText.length > 0,
          timestamp: Date.now(),
          enhancementType: 'rephrase', // Override default enhancement type
          captureMetadata: {
            capturedFrom: capturedFrom || 'none',
            copySimulated: copySimulated || false,
            captureMethod: captureMethod || undefined,
            attemptCount: attemptCount || 0,
            totalDuration: totalDuration || 0,
            platformToolAvailable: platformToolAvailable || false,
            installInstructions: platformToolAvailable ? null : ShortcutManager.getInstallationInstructions(),
          },
        });
      });
      
      // Log capture statistics
      console.log(`[Reformulate] Text captured: ${finalText.length} chars, from: ${capturedFrom || 'none'}, method: ${captureMethod || 'none'}, attempts: ${attemptCount || 0}, duration: ${totalDuration || 0}ms`);
    } catch (error) {
      console.error('[Reformulate] Error in shortcut handler:', error);
      
      // Even on error, show popup with error message
      const cursorPosition = ShortcutManager.getCursorPosition();
      const popup = popupManager.create(cursorPosition.x, cursorPosition.y);
      
      popup.webContents.once('did-finish-load', () => {
        popupManager.send('text-selected', {
          text: '',
          hasText: false,
          timestamp: Date.now(),
          enhancementType: 'rephrase', // Override default enhancement type
          captureMetadata: {
            capturedFrom: 'none',
            copySimulated: false,
            platformToolAvailable: false,
            installInstructions: ShortcutManager.getInstallationInstructions(),
          },
        });
      });
    }
  });

  if (success) {
    console.log(`[Reformulate] Registered reformulate shortcut: ${reformulateShortcut}`);
  } else {
    console.error(`[Reformulate] Failed to register reformulate shortcut: ${reformulateShortcut}`);
  }
}

function registerGlobalShortcut(accelerator: string): void {
  if (!app.isReady()) return;
  
  const normalized = normalizeShortcut(accelerator);
  globalShortcut.unregisterAll();
  
  // Enhanced logging
  console.log(`[Shortcut] Attempting to register: ${normalized}`);
  
  const onShortcutTriggered = async () => {
    try {
      // Get text with enhanced metadata
      const captureResult = await ShortcutManager.getSelectedText();
      
      const { text, capturedFrom, copySimulated, captureMethod, attemptCount, totalDuration, platformToolAvailable } = captureResult;
      
      let finalText = text?.trim() ?? '';
      
      // Filter out shortcut strings
      if (looksLikeShortcutString(finalText)) {
        finalText = '';
      }
      
      // Get cursor position
      const cursorPosition = ShortcutManager.getCursorPosition();
      
      // Create popup window (always create, even if no text)
      const popup = popupManager.create(cursorPosition.x, cursorPosition.y);
      
      // Send enhanced data to popup
      popup.webContents.once('did-finish-load', () => {
        popupManager.send('text-selected', {
          text: finalText || '',
          hasText: finalText.length > 0,
          timestamp: Date.now(),
          captureMetadata: {
            capturedFrom: capturedFrom || 'none',
            copySimulated: copySimulated || false,
            captureMethod: captureMethod || undefined,
            attemptCount: attemptCount || 0,
            totalDuration: totalDuration || 0,
            platformToolAvailable: platformToolAvailable || false,
            installInstructions: platformToolAvailable ? null : ShortcutManager.getInstallationInstructions(),
          },
        });
      });
      
      // Log capture statistics
      console.log(`[Main] Text captured: ${finalText.length} chars, from: ${capturedFrom || 'none'}, method: ${captureMethod || 'none'}, attempts: ${attemptCount || 0}, duration: ${totalDuration || 0}ms`);
    } catch (error) {
      console.error('[Main] Error in shortcut handler:', error);
      
      // Even on error, show popup with error message
      const cursorPosition = ShortcutManager.getCursorPosition();
      const popup = popupManager.create(cursorPosition.x, cursorPosition.y);
      
      popup.webContents.once('did-finish-load', () => {
        popupManager.send('text-selected', {
          text: '',
          hasText: false,
          timestamp: Date.now(),
          captureMetadata: {
            capturedFrom: 'none',
            copySimulated: false,
            platformToolAvailable: false,
            installInstructions: ShortcutManager.getInstallationInstructions(),
          },
        });
      });
    }
  };

  // Make handler async-aware
  const onShortcutTriggeredWrapper = () => {
    onShortcutTriggered().catch((error) => {
      console.error('[Main] Error in shortcut handler:', error);
    });
  };

  const success = globalShortcut.register(normalized, onShortcutTriggeredWrapper);
  
  if (!success) {
    console.error(`[Shortcut] Failed to register: ${normalized}`);
    
    // Show user-friendly notification
    if (mainWindow) {
      mainWindow.webContents.send('shortcut-registration-failed', {
        shortcut: normalized,
        reason: 'Shortcut may be in use by another application'
      });
    }
    
    // Try fallback
    if (normalized !== DEFAULT_SHORTCUT) {
      globalShortcut.unregisterAll();
      const fallbackSuccess = globalShortcut.register(
        DEFAULT_SHORTCUT, 
        onShortcutTriggeredWrapper
      );
      
      if (fallbackSuccess) {
        ConfigManager.setShortcut(DEFAULT_SHORTCUT);
        
        // Notify user of fallback
        dialog.showMessageBox({
          type: 'warning',
          title: 'Shortcut Conflict',
          message: `Could not register "${normalized}". Using default "${DEFAULT_SHORTCUT}" instead.`,
          buttons: ['OK']
        });
        return;
      }
    }
    
    dialog.showErrorBox('Shortcut conflict', 'Could not register the keyboard shortcut. It may be used by another app.');
  } else {
    console.log(`[Shortcut] Successfully registered: ${normalized}`);
  }
}

function setupAutoLaunch(): void {
  const config = ConfigManager.getAll();
  
  if (app.setLoginItemSettings) {
    app.setLoginItemSettings({
      openAtLogin: config.startAtLogin ?? false,
      openAsHidden: true, // Start minimized to tray
      path: process.execPath,
      args: ['--hidden']
    });
    
    console.log(`[AutoLaunch] Auto-launch ${config.startAtLogin ? 'enabled' : 'disabled'}`);
  } else {
    console.warn('[AutoLaunch] setLoginItemSettings not available on this platform');
  }
}

function initializeApp(): void {
  const config = ConfigManager.getAll();
  PrivacyManager.setExcludedApps(config.excludedApps ?? []);

  // Setup auto-launch
  setupAutoLaunch();

  // Log platform capabilities at startup
  const caps = ShortcutManager.getPlatformCapabilities();
  console.log('[Main] Platform capabilities:', {
    platform: caps.platform,
    hasRobotJS: caps.hasRobotJS,
    hasXdotool: caps.hasXdotool,
    hasWtype: caps.hasWtype,
    recommendedMethod: caps.recommendedMethod,
  });

  // Register IPC before creating windows so renderer getConfig() is handled
  registerIpcHandlers(
    () => popupManager.close(),
    () => registerGlobalShortcut(ConfigManager.getShortcut())
  );

  // Register chat handlers
  registerChatHandlers(chatManager);

  const { ipcMain } = require('electron');
  ipcMain.handle('window:show-settings', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
    return true;
  });

  // Register window close handler for chat windows
  ipcMain.on('window:close', (event: IpcMainEvent) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
      window.close();
    }
  });

  ipcMain.on('window:minimize', (event: IpcMainEvent) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
      window.minimize();
    }
  });

  createMain();

  const shortcut = ConfigManager.getShortcut();
  registerGlobalShortcut(shortcut);
  
  // Register chat shortcut
  registerChatShortcut();
  
  // Register reformulate shortcut
  registerReformulateShortcut();

  // System tray (minimal-example, quick-start: tray icon with Settings / Quit)
  const iconPath = getLogoIconPath();
  const icon = nativeImage.createFromPath(iconPath);
  
  if (icon.isEmpty()) {
    console.warn(`[Tray] Icon is empty or not found at: ${iconPath}, using fallback`);
  } else {
    console.log(`[Tray] Icon loaded successfully: ${iconPath}, Size: ${icon.getSize()}`);
  }
  
  const trayIcon = icon.isEmpty()
    ? nativeImage.createFromDataURL(
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMklEQVQ4T2NkYGD4z0ABYBzVMKoBBg1GNAzGMWAY1YCBgYEBogHZChQNQzQAAQYAhmgGAb+lL2AAAAAASUVORK5CYII='
      )
    : icon;
  tray = new Tray(trayIcon.resize({ width: 16, height: 16 }));
  tray.setToolTip('WriteUp');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Settings', click: () => { mainWindow?.show(); mainWindow?.focus(); } },
      { type: 'separator' },
      {
        label: 'Open AI Chat',
        click: () => {
          const cursorPosition = ShortcutManager.getCursorPosition();
          chatManager.create(cursorPosition.x, cursorPosition.y);
        },
      },
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
  globalShortcut.unregisterAll();
  // Close all chat windows
  chatManager.closeAll();
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
