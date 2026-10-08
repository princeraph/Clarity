const { app, BrowserWindow, ipcMain, Notification, Tray, Menu, nativeImage, screen, safeStorage, powerMonitor, globalShortcut } = require('electron');
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
  backendProcess.stderr?.on('data', (d) => {
    process.stderr.write('[Backend] ' + d);
    backendErrTail.push(...String(d).split('\n').filter(Boolean));
    backendErrTail.splice(0, Math.max(0, backendErrTail.length - 40));
  });
  backendProcess.on('exit', (code, signal) => {
    // Stopped on its own, not by quitting: the crash that leaves nothing alive
    // to report it. Written down; the next launch sends it (if reports are on).
    if (quittingForReal || code === 0) return;
    const message = backendErrTail.filter(l => /Error|exception|rejection/i.test(l)).at(-1) || '';
    queueCrash('service', {
      message: `background service stopped (code ${code}, signal ${signal || 'none'})${message ? ` — ${message}` : ''}`,
      stack: backendErrTail.filter(l => /^\s*at /.test(l)).join('\n'),
    });
  });
  backendProcess.on('error', (err) => console.error('[Backend] Failed to start:', err.message));
  backendProcess.on('message', answerSecretRequest);
}

// ─── Crash reports ────────────────────────────────────────────────────────────
// What the backend cannot see: errors of this process, a window that crashed,
// the backend itself stopping. Sent through the backend
// (backend/src/crash/crash.js decides what leaves, and cleans it), or written
// to its queue when it is down. Nothing at all while reports are off.
const backendErrTail = [];
function crashReportsOn() {
  try {
    const s = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'data', 'settings.json'), 'utf8'));
    return s?.features?.crashReports === true;
  } catch { return false; }
}
function queueCrash(where, err) {
  if (!crashReportsOn()) return;
  try {
    fs.appendFileSync(path.join(app.getPath('userData'), 'data', 'crash-pending.jsonl'),
      JSON.stringify({ at: new Date().toISOString(), where, message: String(err?.message || err), stack: String(err?.stack || '') }) + '\n');
  } catch { /* reporting must never be the next crash */ }
}
function reportCrash(where, err) {
  if (!crashReportsOn()) return;
  fetch('http://localhost:3001/api/crash', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ where, message: String(err?.message || err), stack: String(err?.stack || '') }),
  }).catch(() => queueCrash(where, err));
}
process.on('uncaughtException', (err) => {
  console.error('[Clarity] uncaught exception in the shell:', err?.stack || err);
  reportCrash('app', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[Clarity] unhandled rejection in the shell:', reason?.stack || reason);
  reportCrash('app', reason);
});
app.on('render-process-gone', (_e, _wc, details) => {
  if (details?.reason === 'clean-exit') return;
  reportCrash('window', { message: `window ${details?.reason} (exit code ${details?.exitCode})`, stack: '' });
});

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
// ─── The "Today" panel (TrayMenu.jsx) ────────────────────────────────────────
// Opens from the tray icon, Ctrl+Alt+Space, or "Today panel" when the taskbar
// icon is right-clicked. Moved by its header, and it stays where it was put.
// Pinned, it stays open like a sticky note; unpinned, it goes away when the
// person clicks elsewhere. Both are remembered (panel.json in the profile).
const PANEL_FILE = () => path.join(app.getPath('userData'), 'panel.json');
let panelState = null;   // { x, y, pinned }
function readPanelState() {
  if (panelState) return panelState;
  try { panelState = JSON.parse(fs.readFileSync(PANEL_FILE(), 'utf8')) || {}; } catch { panelState = {}; }
  return panelState;
}
function savePanelState(patch) {
  panelState = { ...readPanelState(), ...patch };
  try { fs.writeFileSync(PANEL_FILE(), JSON.stringify(panelState)); } catch { /* next time */ }
}
// A saved spot only counts while it is on a screen that still exists.
function savedSpotFits(width, height) {
  const st = readPanelState();
  if (!Number.isFinite(st.x) || !Number.isFinite(st.y)) return false;
  return screen.getAllDisplays().some(d => {
    const wa = d.workArea;
    return st.x >= wa.x - 20 && st.y >= wa.y - 20 && st.x + Math.min(width, 120) <= wa.x + wa.width && st.y + 40 <= wa.y + wa.height;
  });
}

// An opaque window of a fixed size. It was transparent, with the card drawn
// inside it: dragged on Windows, a frameless transparent window is resized for
// the screen's scaling, and the panel came back stretched across the screen,
// pale (1.5.1). Opaque, the card IS the window: nothing for Windows to rescale,
// no invisible band around it to catch clicks. Both dimensions are locked; the
// height is the card's, set from the panel's own measure.
const PANEL_WIDTH = 380;
const PANEL_BG = '#1C1C22';   // components/glance.js, C.cardBg
let panelHeight = 420;
let panelLostFocusAt = 0;     // when the panel last lost the focus (to anything)
let panelUserMoving = false;  // a drag by the person, not a move made here

function lockPanelSize(h) {
  panelHeight = h;
  if (!trayWindow) return;
  trayWindow.setMinimumSize(PANEL_WIDTH, h);
  trayWindow.setMaximumSize(PANEL_WIDTH, h);
  const [w, cur] = trayWindow.getSize();
  if (w !== PANEL_WIDTH || cur !== h) trayWindow.setSize(PANEL_WIDTH, h);
}

function createTrayWindow() {
  trayWindow = new BrowserWindow({
    width: PANEL_WIDTH,
    height: panelHeight,
    minWidth: PANEL_WIDTH, maxWidth: PANEL_WIDTH,
    minHeight: panelHeight, maxHeight: panelHeight,
    show: false,
    frame: false,
    transparent: false,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    fullscreenable: false,
    backgroundColor: PANEL_BG,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  lockNavigation(trayWindow);
  trayWindow.loadFile(getFrontendPath(), { hash: 'tray' });
  // Unpinned, it is dismissed when it loses focus, like a Windows flyout.
  trayWindow.on('blur', () => {
    panelLostFocusAt = Date.now();
    if (!trayWindow || trayWindow.webContents.isDevToolsFocused() || readPanelState().pinned) return;
    trayWindow.hide();
  });
  // Whatever Windows does to the size (scaling, a drag between screens), the
  // panel goes back to its own.
  trayWindow.on('resize', () => {
    if (!trayWindow) return;
    const [w, h] = trayWindow.getSize();
    if (w !== PANEL_WIDTH || h !== panelHeight) trayWindow.setSize(PANEL_WIDTH, panelHeight);
  });
  // Only a move the person made is remembered: 'will-move' fires for a drag,
  // not for setPosition. Saving every move made the panel drift — each time it
  // was nudged up to fit, that became its new place.
  trayWindow.on('will-move', () => { panelUserMoving = true; });
  let moveTimer = null;
  trayWindow.on('moved', () => {
    if (!panelUserMoving) return;
    clearTimeout(moveTimer);
    moveTimer = setTimeout(() => {
      panelUserMoving = false;
      if (!trayWindow) return;
      const [x, y] = trayWindow.getPosition();
      savePanelState({ x, y });
    }, 300);
  });
  trayWindow.on('closed', () => { trayWindow = null; });
}

function positionTrayWindow() {
  if (!trayWindow) return;
  const winBounds = trayWindow.getBounds();
  if (savedSpotFits(winBounds.width, winBounds.height)) {
    const st = readPanelState();
    // Keep it on its screen when it grows: move up rather than run off the bottom.
    const wa = screen.getDisplayNearestPoint({ x: st.x, y: st.y }).workArea;
    const y = Math.min(st.y, wa.y + wa.height - winBounds.height);
    trayWindow.setPosition(st.x, Math.max(wa.y, y), false);
    return;
  }
  const trayBounds = tray ? tray.getBounds() : null;
  const display = trayBounds ? screen.getDisplayMatching(trayBounds) : screen.getPrimaryDisplay();
  const wa = display.workArea;
  if (!trayBounds || !trayBounds.width) {
    trayWindow.setPosition(wa.x + wa.width - winBounds.width - 8, wa.y + wa.height - winBounds.height - 8, false);
    return;
  }
  let x = Math.round(trayBounds.x + trayBounds.width / 2 - winBounds.width / 2);
  x = Math.max(wa.x + 8, Math.min(x, wa.x + wa.width - winBounds.width - 8));
  const y = trayBounds.y > wa.y + wa.height / 2
    ? Math.round(wa.y + wa.height - winBounds.height)
    : Math.round(trayBounds.y + trayBounds.height);
  trayWindow.setPosition(x, y, false);
}

// The panel says how tall its card is; the window follows.
ipcMain.on('tray:resize', (event, height) => {
  if (!trayWindow || event.sender !== trayWindow.webContents) return;
  const h = Math.max(160, Math.min(Math.round(Number(height) || 420), 760));
  if (h === panelHeight && trayWindow.getSize()[1] === h) return;
  lockPanelSize(h);
  if (trayWindow.isVisible()) positionTrayWindow();
});
ipcMain.handle('panel:get', () => ({ pinned: !!readPanelState().pinned, shortcut: PANEL_SHORTCUT_LABEL }));
ipcMain.handle('panel:pin', (_e, pinned) => { savePanelState({ pinned: !!pinned }); applyPin(); return !!pinned; });

// From anywhere, over any window: the phone's home-screen widget, for a laptop
// whose desktop is always covered (JOURNAL, 7 October).
const PANEL_SHORTCUT = 'CommandOrControl+Alt+Space';
const PANEL_SHORTCUT_LABEL = 'Ctrl+Alt+Space';
function registerPanelShortcut() {
  try {
    if (!globalShortcut.register(PANEL_SHORTCUT, toggleTrayWindow)) {
      console.warn(`[Clarity] ${PANEL_SHORTCUT} is taken by another app — the panel stays on the tray icon`);
    }
  } catch (err) { console.warn('[Clarity] shortcut not registered:', err.message); }
}
app.on('will-quit', () => { try { globalShortcut.unregisterAll(); } catch {} });

// Unpinned it floats over everything, like a Windows flyout; pinned it is a
// window among others, like a sticky note, that others may cover.
function applyPin() {
  if (trayWindow) trayWindow.setAlwaysOnTop(!readPanelState().pinned);
}
function showPanel() {
  if (!trayWindow) createTrayWindow();
  applyPin();
  positionTrayWindow();
  trayWindow.show();
  trayWindow.focus();
  trayWindow.webContents.send('panel-shown');
}
// Open, close, or bring back. Clicking the tray icon takes the focus from the
// panel BEFORE the click arrives: a panel that was in front a moment ago was
// in front for the person, and the click means "close". Unpinned, that same
// blur has already hidden it — the click must not open it again.
function toggleTrayWindow() {
  const justHadFocus = Date.now() - panelLostFocusAt < 500;
  if (trayWindow?.isVisible()) {
    const inFront = trayWindow.isFocused() || justHadFocus;
    // Pinned and covered by other windows: bring it back rather than hide it.
    if (readPanelState().pinned && !inFront) { trayWindow.show(); trayWindow.focus(); return; }
    trayWindow.hide();
    return;
  }
  if (justHadFocus && !readPanelState().pinned) return;   // the blur just closed it
  showPanel();
}

// For driving the panel from an end-to-end test only (Playwright's _electron,
// with CLARITY_TEST_HOOKS=1): what a tray click or the shortcut would call.
if (process.env.CLARITY_TEST_HOOKS === '1') {
  global.__clarityPanel = {
    toggle: () => toggleTrayWindow(),
    show: () => showPanel(),
    win: () => trayWindow,
    state: () => readPanelState(),
    height: () => panelHeight,
    wake: () => showWakeSummary(),
    wakeWin: () => wakeWindow,
  };
}

// Right-click on the tray icon: the menu Windows users expect, Quit included.
function showTrayMenu() {
  const fr = chosenLocale().startsWith('fr');
  const visible = !!trayWindow?.isVisible();
  tray.popUpContextMenu(Menu.buildFromTemplate([
    { label: fr ? (visible ? 'Fermer le panneau Aujourd’hui' : 'Panneau Aujourd’hui') : (visible ? 'Close the Today panel' : 'Today panel'),
      accelerator: 'CommandOrControl+Alt+Space', click: () => (visible ? trayWindow.hide() : showPanel()) },
    { label: fr ? 'Ouvrir Clarity' : 'Open Clarity', click: () => showMainWindow() },
    { type: 'separator' },
    { label: fr ? 'Quitter Clarity' : 'Quit Clarity', click: () => { quittingForReal = true; app.quit(); } },
  ]));
}

// Right-click on Clarity in the taskbar: the panel, and a new task, without
// going through the tray. Windows only (jump list).
const PANEL_ARG = '--panel';
function chosenLocale() {
  try { return fs.readFileSync(path.join(app.getPath('userData'), 'locale.txt'), 'utf8').trim(); }
  catch { return app.getLocale() || 'en'; }
}
function setTaskbarTasks() {
  if (process.platform !== 'win32') return;
  try {
    app.setUserTasks([{
      program: process.execPath, arguments: PANEL_ARG, iconPath: process.execPath, iconIndex: 0,
      title: chosenLocale().startsWith('fr') ? 'Panneau Aujourd’hui' : 'Today panel',
      description: PANEL_SHORTCUT_LABEL,
    }]);
  } catch (err) { console.warn('[Clarity] jump list not set:', err.message); }
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
  tray.on('right-click', showTrayMenu);
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
// Launched from the taskbar's "Today panel": the panel alone, like the tray.
const START_HIDDEN = process.argv.includes(BACKGROUND_ARG) || process.argv.includes('--panel');

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
    if (argv.includes(PANEL_ARG)) { showPanel(); return; }
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
    registerPanelShortcut();
    setTaskbarTasks();
    if (process.argv.includes(PANEL_ARG)) setTimeout(showPanel, 800);
    startUpdateChecks();
    watchForWake();
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
    setTaskbarTasks();   // the jump list speaks it too
  } catch { /* the installer then follows Windows' language */ }
});
ipcMain.handle('update:later', () => updateFlow?.later());

// ─── Notifications ────────────────────────────────────────────────────────────
ipcMain.on('show-notification', (event, { title, body }) => {
  if (Notification.isSupported()) new Notification({ title, body }).show();
});

// ─── Back from sleep ──────────────────────────────────────────────────────────
// When the computer wakes from sleep or hibernation, a small card in the
// bottom-right corner shows the tasks at hand (WakeCard.jsx). It waits for the
// session to be unlocked (wake.js), never takes the focus from what the person
// is typing, and is turned off in Settings or from the card itself
// (`wakeSummary` in settings.json, on unless set to false).
const { whenUnlocked, placement, WIDTH: WAKE_WIDTH } = require('./wake');
let wakeWindow = null;
let cancelWakeWait = null;

async function wakeSummaryWanted() {
  try {
    const s = await (await fetch('http://localhost:3001/api/settings')).json();
    return s.wakeSummary !== false;
  } catch { return false; }   // no backend: nothing to show
}

function showWakeSummary() {
  if (wakeWindow) wakeWindow.close();
  wakeWindow = new BrowserWindow({
    width: WAKE_WIDTH,
    height: 200,
    show: false,
    frame: false,
    // Opaque, like the panel: on Windows a transparent frameless window is
    // rescaled with the screen's scaling, and the card came out stretched.
    transparent: false,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: true,
    fullscreenable: false,
    backgroundColor: PANEL_BG,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  lockNavigation(wakeWindow);
  wakeWindow.loadFile(getFrontendPath(), { hash: 'wake' });
  wakeWindow.on('closed', () => { wakeWindow = null; });
  // The card says when it is drawn, and how tall (wake:ready); a card that
  // never does is closed rather than left invisible on top of the desktop.
  const win = wakeWindow;
  setTimeout(() => { if (win === wakeWindow && !win.isDestroyed() && !win.isVisible()) win.close(); }, 15000);
}

ipcMain.on('wake:ready', (event, height) => {
  if (!wakeWindow || event.sender !== wakeWindow.webContents) return;
  const { workArea } = screen.getPrimaryDisplay();
  wakeWindow.setBounds(placement(workArea, Number(height) || 300));
  wakeWindow.setAlwaysOnTop(true, 'floating');
  wakeWindow.showInactive();
});
ipcMain.on('wake:close', (event) => {
  if (wakeWindow && event.sender === wakeWindow.webContents) wakeWindow.close();
});

function watchForWake() {
  powerMonitor.on('resume', () => {
    cancelWakeWait?.();
    cancelWakeWait = whenUnlocked({
      idleState: () => powerMonitor.getSystemIdleState(1),
      onReady: async () => { if (await wakeSummaryWanted()) showWakeSummary(); },
    });
  });
}

// ─── System tray actions ────────────────────────────────────────────────────────
ipcMain.on('tray-action', (event, action) => {
  // A pinned panel stays where it is when it opens Clarity or a task; only its
  // own close button (or Escape) puts it away.
  if (trayWindow && (action === 'hide' || action === 'quit' || !readPanelState().pinned)) trayWindow.hide();
  if (action === 'hide') return;
  if (wakeWindow && event.sender === wakeWindow.webContents) wakeWindow.close();
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
