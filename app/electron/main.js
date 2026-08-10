const { app, BrowserWindow, ipcMain, Notification, Tray, nativeImage, screen } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

let mainWindow;
let trayWindow;
let tray;
let backendProcess;

function getIconPath() {
  const base = app.isPackaged ? process.resourcesPath : path.join(__dirname, '..');
  if (process.platform === 'win32') return path.join(base, 'build', 'icon.ico');
  if (process.platform === 'darwin') return path.join(base, 'build', 'icon.icns');
  return path.join(base, 'build', 'icon.png');
}

function getBackendPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'backend', 'server.js')
    : path.join(__dirname, '..', 'backend', 'server.js');
}

function getFrontendPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'frontend', 'dist', 'index.html')
    : path.join(__dirname, '..', 'frontend', 'dist', 'index.html');
}

function startBackend() {
  backendProcess = spawn('node', [getBackendPath()], {
    windowsHide: true,
    stdio: 'pipe',
    env: {
      ...process.env,
      CLARITY_DATA_DIR: path.join(app.getPath('userData'), 'data'),
    },
  });
  backendProcess.stdout?.on('data', (d) => process.stdout.write('[Backend] ' + d));
  backendProcess.stderr?.on('data', (d) => process.stderr.write('[Backend] ' + d));
  backendProcess.on('error', (err) => console.error('[Backend] Failed to start:', err.message));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    frame: false,
    backgroundColor: '#FAFAF7',
    show: false,
    icon: getIconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(getFrontendPath());

  // DevTools only in development
  if (!app.isPackaged) {
    // mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.once('ready-to-show', () => mainWindow.show());
  // With a tray present, the close button hides the window (Win11 tray app
  // convention) so app state is preserved. Real quit happens from the tray.
  mainWindow.on('close', (e) => {
    if (tray && !quittingForReal) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
  mainWindow.on('closed', () => { mainWindow = null; });
}

// ─── System tray (Windows 11 taskbar popup) ────────────────────────────────────
function createTrayWindow() {
  trayWindow = new BrowserWindow({
    width: 336,
    height: 420,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    fullscreenable: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  trayWindow.loadFile(getFrontendPath(), { hash: 'tray' });
  // Dismiss when the popup loses focus (clicking elsewhere), matching Win11 behaviour.
  trayWindow.on('blur', () => { if (trayWindow && !trayWindow.webContents.isDevToolsFocused()) trayWindow.hide(); });
  trayWindow.on('closed', () => { trayWindow = null; });
}

function positionTrayWindow() {
  if (!tray || !trayWindow) return;
  const trayBounds = tray.getBounds();
  const winBounds = trayWindow.getBounds();
  const display = screen.getDisplayMatching(trayBounds);
  const wa = display.workArea;

  let x = Math.round(trayBounds.x + trayBounds.width / 2 - winBounds.width / 2);
  // Clamp horizontally inside the work area (with an 8px gutter).
  x = Math.max(wa.x + 8, Math.min(x, wa.x + wa.width - winBounds.width - 8));

  // Place above the taskbar if the tray sits in the bottom half, else below it.
  let y;
  if (trayBounds.y > wa.y + wa.height / 2) {
    y = Math.round(wa.y + wa.height - winBounds.height);
  } else {
    y = Math.round(trayBounds.y + trayBounds.height);
  }
  trayWindow.setPosition(x, y, false);
}

function toggleTrayWindow() {
  if (!trayWindow) createTrayWindow();
  if (trayWindow.isVisible()) {
    trayWindow.hide();
  } else {
    positionTrayWindow();
    trayWindow.show();
    trayWindow.focus();
  }
}

function createTray() {
  let image = nativeImage.createFromPath(getIconPath());
  if (image.isEmpty()) image = nativeImage.createEmpty();
  // Windows tray icons render best at 16px.
  if (!image.isEmpty() && process.platform !== 'darwin') {
    image = image.resize({ width: 16, height: 16 });
  }
  tray = new Tray(image);
  tray.setToolTip('Clarity');
  tray.on('click', toggleTrayWindow);
  tray.on('right-click', toggleTrayWindow);
  createTrayWindow();
}

function showMainWindow() {
  if (!mainWindow) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

const APP_VERSION = '1.2.0';

async function checkForUpdates() {
  try {
    const res = await fetch('http://localhost:3001/api/version');
    if (!res.ok) return;
  } catch {}
}

async function waitForBackend(retries = 20, delayMs = 250) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch('http://localhost:3001/api/health');
      if (res.ok) return;
    } catch {}
    await new Promise(r => setTimeout(r, delayMs));
  }
}

let quittingForReal = false;

app.whenReady().then(async () => {
  startBackend();
  await waitForBackend();
  createWindow();
  createTray();
  checkForUpdates();
});

app.on('window-all-closed', () => {
  // The tray keeps the app alive after the main window closes (Win11 tray convention).
  // Only tear down when the user explicitly quits from the tray.
  if (!tray || quittingForReal) {
    if (backendProcess) backendProcess.kill();
    app.quit();
  }
});

app.on('before-quit', () => {
  quittingForReal = true;
  if (backendProcess) backendProcess.kill();
});

// ─── Window controls ──────────────────────────────────────────────────────────
ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.on('window-close', () => mainWindow?.close());

// ─── Notifications ────────────────────────────────────────────────────────────
ipcMain.on('show-notification', (event, { title, body }) => {
  if (Notification.isSupported()) new Notification({ title, body }).show();
});

// ─── System tray actions ────────────────────────────────────────────────────────
ipcMain.on('tray-action', (event, action) => {
  if (trayWindow) trayWindow.hide();
  if (action === 'quit') {
    quittingForReal = true;
    app.quit();
    return;
  }
  // Every other action surfaces the main window, then forwards a command the
  // renderer maps to a UI action (open capture, chat, navigate to Today).
  showMainWindow();
  if (action !== 'open' && mainWindow) {
    // Wait for the window to exist/paint before sending the command.
    const send = () => mainWindow.webContents.send('tray-command', action);
    if (mainWindow.webContents.isLoading()) mainWindow.webContents.once('did-finish-load', send);
    else send();
  }
});
