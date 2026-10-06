const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('clarity', {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  showNotification: (title, body) => ipcRenderer.send('show-notification', { title, body }),
  // Tray popup → main process
  trayAction: (action) => ipcRenderer.send('tray-action', action),
  // Main process → main window (tray command forwarding)
  onTrayCommand: (cb) => {
    const handler = (_e, action) => cb(action);
    ipcRenderer.on('tray-command', handler);
    return () => ipcRenderer.removeListener('tray-command', handler);
  },
  // Start with Windows (Settings): { supported, enabled }
  loginItem: {
    get: () => ipcRenderer.invoke('login-item:get'),
    set: (enabled) => ipcRenderer.invoke('login-item:set', !!enabled),
  },
  // AI connector: install into Claude Desktop in one click
  connector: {
    install: () => ipcRenderer.invoke('connector:install'),
    getClaude: () => ipcRenderer.invoke('connector:get-claude'),
    showFile: () => ipcRenderer.invoke('connector:show-file'),
    openClaude: () => ipcRenderer.invoke('connector:open-claude'),
  },
  // The language chosen in Clarity, for the installer of the next update
  setLocale: (locale) => ipcRenderer.invoke('locale:set', locale),
  // Updates: announced as Clarity opens, "now" or "later" (updateFlow.js)
  updates: {
    status: () => ipcRenderer.invoke('update:status'),
    now: (words) => ipcRenderer.invoke('update:now', words),
    later: () => ipcRenderer.invoke('update:later'),
    onState: (cb) => {
      const handler = (_e, state) => cb(state);
      ipcRenderer.on('update-state', handler);
      return () => ipcRenderer.removeListener('update-state', handler);
    },
  },
  isElectron: true,
});
