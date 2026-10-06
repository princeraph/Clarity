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
  // Updates: a new version downloaded in the background, ready on restart
  updates: {
    status: () => ipcRenderer.invoke('update:status'),
    install: () => ipcRenderer.invoke('update:install'),
    onReady: (cb) => {
      const handler = (_e, info) => cb(info);
      ipcRenderer.on('update-ready', handler);
      return () => ipcRenderer.removeListener('update-ready', handler);
    },
  },
  isElectron: true,
});
