import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (config: unknown) => ipcRenderer.invoke('config:set', config),
  getProviders: () => ipcRenderer.invoke('config:get-providers'),
  saveProvider: (name: string, config: unknown) =>
    ipcRenderer.invoke('config:save-provider', name, config),
  getShortcut: () => ipcRenderer.invoke('config:get-shortcut'),
  setShortcut: (shortcut: string) => ipcRenderer.invoke('config:set-shortcut', shortcut),
  enhanceText: (text: string, options: unknown) =>
    ipcRenderer.invoke('ai:enhance', text, options),
  testProvider: (providerName: string) =>
    ipcRenderer.invoke('ai:test-provider', providerName),
  getAvailableProviders: () => ipcRenderer.invoke('ai:get-providers'),
  getExcludedApps: () => ipcRenderer.invoke('privacy:get-excluded-apps'),
  addExcludedApp: (appName: string) =>
    ipcRenderer.invoke('privacy:add-excluded-app', appName),
  removeExcludedApp: (appName: string) =>
    ipcRenderer.invoke('privacy:remove-excluded-app', appName),
  closePopup: () => ipcRenderer.invoke('window:close-popup'),
  showSettings: () => ipcRenderer.invoke('window:show-settings'),
  writeClipboard: (text: string) => ipcRenderer.invoke('clipboard:write', text),
  readClipboard: () => ipcRenderer.invoke('clipboard:read'),
  writeAndPaste: (text: string) => ipcRenderer.invoke('clipboard:write-and-paste', text),
  onTextSelected: (callback: (data: { text: string; timestamp: number }) => void) => {
    ipcRenderer.on('text-selected', (_event, data) => callback(data));
  },
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },
  getHistory: () => ipcRenderer.invoke('history:get'),
  addHistory: (item: { original: string; enhanced: string; type: string; provider: string }) =>
    ipcRenderer.invoke('history:add', item),
  clearHistory: () => ipcRenderer.invoke('history:clear'),
});
