import { BrowserWindow, nativeImage } from 'electron';
import path from 'path';
import { getLogoIconPath } from '../utils/asset-path';

export function createMainWindow(): BrowserWindow {
  const preloadPath = path.join(__dirname, '../../preload/index.js');
  const iconPath = getLogoIconPath();
  let icon = nativeImage.createFromPath(iconPath);
  
  if (icon.isEmpty()) {
    console.warn(`[MainWindow] Icon is empty or not found at: ${iconPath}`);
    // Try to create a fallback icon
    try {
      // Try using process.cwd() as fallback
      const fallbackPath = path.join(process.cwd(), 'assets', process.platform === 'win32' ? 'logo.ico' : 'logo.png');
      const fallbackIcon = nativeImage.createFromPath(fallbackPath);
      if (!fallbackIcon.isEmpty()) {
        console.log(`[MainWindow] Using fallback icon: ${fallbackPath}`);
        icon = fallbackIcon;
      }
    } catch (e) {
      console.error(`[MainWindow] Failed to load fallback icon:`, e);
    }
  } else {
    console.log(`[MainWindow] Icon loaded successfully: ${iconPath}, Size: ${icon.getSize()}`);
  }
  
  // Always set icon if available, especially important for Linux taskbar
  const windowIcon = icon.isEmpty() ? undefined : icon;
  
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    show: false,
    title: 'WriteUp - Settings',
    icon: windowIcon,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173/');
    mainWindow.webContents.openDevTools();
  } else {
    const packagedIndex = path.join(process.resourcesPath, 'app.asar', 'dist', 'renderer', 'index.html');
    mainWindow.loadFile(packagedIndex);
  }

  return mainWindow;
}
