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
  isElectron: true,
});
