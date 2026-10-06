const { app, BrowserWindow, ipcMain, Notification, Tray, nativeImage, screen, safeStorage } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Windows identifies an app by its AppUserModelID. The installer's shortcuts
// carry build.appId (package.json); the running window carried none, so for
// Windows the pinned shortcut and the open window were two different apps —
// a pinned Clarity came unpinned after closing it or after an update
// (reported 6 October). Must match build.appId: tests/identite-windows.test.js.
const APP_USER_MODEL_ID = 'com.clarity.app';
if (process.platform === 'win32') app.setAppUserModelId(APP_USER_MODEL_ID);

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
  // Electron's own binary, run as plain Node. Spawning 'node' used whatever Node
  // the user had installed — on a normal PC, none, and the packaged app opened
  // an empty window with no backend behind it. ELECTRON_RUN_AS_NODE makes the
  // Electron executable behave as the Node runtime it embeds, so the installer
  // carries everything the backend needs.
  backendProcess = spawn(process.execPath, [getBackendPath()], {
    windowsHide: true,
    // The fourth channel is IPC: the backend asks this process to encrypt and
    // decrypt its secrets (backend/src/security/secrets.js).
    stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      CLARITY_DATA_DIR: path.join(app.getPath('userData'), 'data'),
      CLARITY_VERSION: app.getVersion(),
    },
  });
  backendProcess.stdout?.on('data', (d) => process.stdout.write('[Backend] ' + d));
  backendProcess.stderr?.on('data', (d) => process.stderr.write('[Backend] ' + d));
  backendProcess.on('error', (err) => console.error('[Backend] Failed to start:', err.message));
  backendProcess.on('message', answerSecretRequest);
}

// Encryption that only this process can do: safeStorage uses the OS store
// (DPAPI on Windows, Keychain on macOS), tied to the user's account.
function canEncrypt() {
  if (!safeStorage.isEncryptionAvailable()) return false;
  // On Linux without a keyring Electron falls back to a fixed, publicly known
  // key ("basic_text"). That is obfuscation, not encryption: say so, rather
  // than let the backend believe a secret is protected when it is not.
  if (process.platform === 'linux' && safeStorage.getSelectedStorageBackend?.() === 'basic_text') return false;
  return true;
}

function answerSecretRequest(m) {
  if (m?.type !== 'secret') return;
  let reply;
  try {
    if (m.op === 'available') reply = { ok: true, data: canEncrypt() };
    else if (!canEncrypt()) reply = { ok: false, error: 'encryption unavailable' };
    else if (m.op === 'encrypt') reply = { ok: true, data: safeStorage.encryptString(String(m.data)).toString('base64') };
    else if (m.op === 'decrypt') reply = { ok: true, data: safeStorage.decryptString(Buffer.from(String(m.data), 'base64')) };
    else reply = { ok: false, error: `unknown op ${m.op}` };
  } catch (err) {
    reply = { ok: false, error: err.message };
  }
  try { backendProcess?.send({ type: 'secret:reply', id: m.id, ...reply }); } catch {}
}

// Clarity only ever loads its own bundled files. Anything that tries to navigate
// the window elsewhere — a stray link, injected markup, AI-generated content
// rendered as HTML — would run in a renderer holding this app's preload bridge.
// Navigation is refused and external URLs are handed to the real browser.
function lockNavigation(win) {
  const { shell } = require('electron');
  win.webContents.on('will-navigate', (e, url) => {
    if (url !== win.webContents.getURL()) {
      e.preventDefault();
      if (/^https?:/.test(url)) shell.openExternal(url);
    }
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
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

  lockNavigation(mainWindow);
  mainWindow.loadFile(getFrontendPath());

  // DevTools only in development
  if (!app.isPackaged) {
    // mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // Started in the background — at Windows login, or woken by the AI connector —
  // Clarity stays in the tray until someone opens it.
  mainWindow.once('ready-to-show', () => { if (!START_HIDDEN) mainWindow.show(); });
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

  lockNavigation(trayWindow);
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

const APP_VERSION = app.getVersion();   // app/package.json — the one place the version lives

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

// `--background`: start in the tray, no window. Used by the start-with-Windows
// option and by the AI connector, which wakes Clarity when an assistant needs
// it and the person has not opened it.
const BACKGROUND_ARG = '--background';
const START_HIDDEN = process.argv.includes(BACKGROUND_ARG);

// Two copies of Clarity meant two backends writing the same tasks.json, each
// unaware of the other's writes. The second launch now surfaces the first
// instance instead of starting a rival.
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    // The connector waking a Clarity that is already running: nothing to show.
    if (argv.includes(BACKGROUND_ARG)) return;
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    startBackend();
    await waitForBackend();
    createWindow();
    createTray();
    startUpdateChecks();
  });
}

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

// ─── Start with Windows ──────────────────────────────────────────────────────
// Off unless the person turns it on in Settings. The entry carries
// `--background`, so a login starts Clarity in the tray rather than opening a
// window over whatever the person is doing.
const loginItemSupported = process.platform === 'win32' || process.platform === 'darwin';
const loginQuery = { args: [BACKGROUND_ARG] };
ipcMain.handle('login-item:get', () => ({
  supported: loginItemSupported,
  enabled: loginItemSupported ? app.getLoginItemSettings(loginQuery).openAtLogin : false,
}));
ipcMain.handle('login-item:set', (_event, enabled) => {
  if (!loginItemSupported) return { supported: false, enabled: false };
  app.setLoginItemSettings({ openAtLogin: !!enabled, args: [BACKGROUND_ARG] });
  return { supported: true, enabled: app.getLoginItemSettings(loginQuery).openAtLogin };
});

// ─── AI connector: one click ─────────────────────────────────────────────────
// Downloading a file, finding it, double-clicking it: three steps a new user
// got lost in. Here Clarity writes Clarity.mcpb to Downloads and, when Windows
// knows what opens .mcpb files, opens it itself — Claude Desktop's own
// "Install?" dialog is then the only step left.
//
// Never a gate. The first version refused to go on when one registry key was
// missing, and told a person who HAD Claude Desktop that it was not installed
// (6 October): some installs do not register .mcpb at all. Now every signal is
// only a hint for the wording, and the file is always prepared.
function regHas(key) {
  return new Promise((resolve) => {
    require('child_process').execFile('reg', ['query', key], { windowsHide: true }, (err) => resolve(!err));
  });
}

async function claudeDesktopSignals() {
  const env = process.env;
  const has = (...parts) => parts.every(Boolean) && fs.existsSync(path.join(...parts));
  let protocol = '';
  try { protocol = app.getApplicationNameForProtocol('claude://') || ''; } catch {}
  const opensMcpb = process.platform === 'win32'
    ? (await regHas('HKCR\\.mcpb')) || (await regHas('HKCU\\Software\\Classes\\.mcpb'))
    : process.platform === 'darwin';
  return {
    opensMcpb,
    found: !!protocol || opensMcpb
      || has(env.APPDATA, 'Claude')                 // its settings folder, once it has run
      || has(env.LOCALAPPDATA, 'AnthropicClaude')   // its program folder
      || (process.platform === 'darwin' && fs.existsSync('/Applications/Claude.app')),
  };
}

let lastConnectorFile = null;

ipcMain.handle('connector:install', async () => {
  const resp = await fetch('http://127.0.0.1:3001/api/connector/bundle', { method: 'POST' });
  if (!resp.ok) return { error: `HTTP ${resp.status}` };
  const file = path.join(app.getPath('downloads'), 'Clarity.mcpb');
  fs.writeFileSync(file, Buffer.from(await resp.arrayBuffer()));
  lastConnectorFile = file;
  const claude = await claudeDesktopSignals();
  let opened = false;
  if (claude.opensMcpb) opened = !(await require('electron').shell.openPath(file));
  return { file, opened, claudeFound: claude.found };
});

ipcMain.handle('connector:show-file', () => {
  if (lastConnectorFile && fs.existsSync(lastConnectorFile)) require('electron').shell.showItemInFolder(lastConnectorFile);
});

ipcMain.handle('connector:open-claude', () => {
  require('electron').shell.openExternal('claude://');
});

ipcMain.handle('connector:get-claude', () => {
  require('electron').shell.openExternal('https://claude.ai/download');
});

// ─── Updates ─────────────────────────────────────────────────────────────────
// Friends testing Clarity have no Git and no Node: Update.bat is not for them.
// The installed app looks for a newer version in the public clarity-releases
// repository (installers only — the source stays private, and no token is
// needed to read a public release). What the person sees, step by step, is in
// updateFlow.js.
const { createUpdateFlow, justUpdated } = require('./updateFlow');
let updateFlow = null;

// Read before the backend starts: it creates the data folder on a fresh install.
const UPDATED = app.isPackaged ? justUpdated({
  version: APP_VERSION,
  readLast: () => fs.readFileSync(path.join(app.getPath('userData'), 'last-version.txt'), 'utf8'),
  writeLast: (v) => {
    // On a fresh install the folder does not exist yet; without it, the second
    // launch would find data and no version, and call that an update.
    fs.mkdirSync(app.getPath('userData'), { recursive: true });
    fs.writeFileSync(path.join(app.getPath('userData'), 'last-version.txt'), v);
  },
  hasData: () => fs.existsSync(path.join(app.getPath('userData'), 'data', 'tasks.json')),
}) : null;
let updatedToShow = UPDATED;

function startUpdateChecks() {
  if (!app.isPackaged) return;   // a development copy updates through Git
  let autoUpdater;
  try { ({ autoUpdater } = require('electron-updater')); } catch { return; }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;      // "later" means: when the person quits
  autoUpdater.on('error', (err) => console.error('[update]', err?.message || err));
  updateFlow = createUpdateFlow({
    updater: autoUpdater,
    send: (state) => mainWindow?.webContents.send('update-state', state),
    notify: ({ title, body }) => { if (Notification.isSupported()) new Notification({ title, body }).show(); },
    onQuit: () => { quittingForReal = true; },
  });
  setTimeout(() => updateFlow.check(), 3000);   // as Clarity opens, once the window is up
  setInterval(() => updateFlow.check(), 6 * 60 * 60 * 1000).unref?.();
}
ipcMain.handle('update:status', () => {
  const updated = updatedToShow;
  updatedToShow = null;                         // "up to date" is said once
  return { state: updateFlow?.status() || null, updated };
});
ipcMain.handle('update:now', (_e, words) => updateFlow?.now(words));

// The installer speaks the language chosen in Clarity: it reads this file
// (build/installer.nsh), since it runs while Clarity is closed.
const LOCALE_FILE = 'locale.txt';
ipcMain.handle('locale:set', (_e, locale) => {
  if (typeof locale !== 'string' || !/^[a-z]{2}-[A-Z]{2}$/.test(locale)) return;
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true });
    fs.writeFileSync(path.join(app.getPath('userData'), LOCALE_FILE), locale);
  } catch { /* the installer then follows Windows' language */ }
});
ipcMain.handle('update:later', () => updateFlow?.later());

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
