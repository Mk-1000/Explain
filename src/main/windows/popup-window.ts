import { BrowserWindow, screen, nativeImage } from 'electron';
import path from 'path';
import { getLogoIconPath } from '../utils/asset-path';

export class PopupWindowManager {
  private window: BrowserWindow | null = null;

  create(cursorX: number, cursorY: number): BrowserWindow {
    if (this.window) {
      this.window.close();
    }
    const display = screen.getDisplayNearestPoint({ x: cursorX, y: cursorY });
    const { width: screenWidth, height: screenHeight } = display.workArea;
    const popupWidth = 520;
    const popupHeight = 600;
    const offset = 20;
    let x = cursorX;
    let y = cursorY + offset;
    if (x + popupWidth > screenWidth) {
      x = screenWidth - popupWidth - 20;
    }
    if (y + popupHeight > screenHeight) {
      y = cursorY - popupHeight - offset;
    }
    if (x < display.workArea.x) x = display.workArea.x;
    if (y < display.workArea.y) y = display.workArea.y;

    const preloadPath = path.join(__dirname, '../../preload/index.js');
    const iconPath = getLogoIconPath();
    const icon = nativeImage.createFromPath(iconPath);
    
    if (icon.isEmpty()) {
      console.warn(`[PopupWindow] Icon is empty or not found at: ${iconPath}`);
    } else {
      console.log(`[PopupWindow] Icon loaded successfully: ${iconPath}, Size: ${icon.getSize()}`);
    }
    
    this.window = new BrowserWindow({
      width: popupWidth,
      height: popupHeight,
      x,
      y,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      minimizable: false,
      maximizable: false,
      show: false,
      icon: icon.isEmpty() ? undefined : icon,
      webPreferences: {
        preload: preloadPath,
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    if (process.env.NODE_ENV === 'development') {
      this.window.loadURL('http://localhost:5173/popup.html');
    } else {
      const packagedPopup = path.join(process.resourcesPath, 'app.asar', 'dist', 'renderer', 'popup.html');
      this.window.loadFile(packagedPopup);
    }

    this.window.once('ready-to-show', () => {
      this.window?.show();
    });

    this.window.on('blur', () => {
      setTimeout(() => {
        if (this.window && !this.window.isFocused()) {
          this.window.close();
        }
      }, 200);
    });

    this.window.on('closed', () => {
      this.window = null;
    });

    return this.window;
  }

  send(channel: string, data: unknown): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send(channel, data);
    }
  }

  close(): void {
    if (this.window) {
      this.window.close();
    }
  }

  isOpen(): boolean {
    return this.window !== null && !this.window.isDestroyed();
  }
}
