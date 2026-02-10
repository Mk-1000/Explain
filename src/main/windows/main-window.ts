import { BrowserWindow } from 'electron';
import path from 'path';

export function createMainWindow(): BrowserWindow {
  const preloadPath = path.join(__dirname, '../../preload/index.js');
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    show: false,
    title: 'AI Text Enhancer - Settings',
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
