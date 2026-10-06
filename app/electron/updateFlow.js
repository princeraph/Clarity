// How an update reaches the person, step by step — kept apart from main.js so
// it can be tested without Electron.
//
// Before (1.3.1): the update downloaded unseen, a small pill offered a
// restart, and the click closed Clarity, installed in silence and reopened it —
// with nothing on screen to say what was happening, before or after.
//
// Now: a new version is announced in a window as soon as Clarity opens, with
// "now" or "later". "Now" shows the download, then says that Clarity will close
// and reopen, and a Windows notification covers the seconds when no window is
// left. "Later" lets the download finish quietly; it installs when the person
// quits. Either way, the next launch says that Clarity is up to date.
//
// The installer itself stays silent: the assisted NSIS installer, run visibly,
// would walk the person through its pages and a "Finish" button for an update
// they already agreed to.

const PHASES = ['downloading', 'ready', 'installing', 'error'];

/**
 * updater: electron-updater's autoUpdater (or a stand-in with the same events).
 * send(state): pushes the state to the window.
 * notify({ title, body }): a system notification.
 * later(fn, ms): setTimeout, replaceable in tests.
 */
function createUpdateFlow({ updater, send, notify, onQuit, later = setTimeout, installDelayMs = 1500 }) {
  let state = null;   // { phase, version, percent, wanted, atStartup }
  let startup = true;
  let notice = null;  // the notification's words, in the person's language

  const push = (patch) => {
    state = { ...(state || {}), ...patch };
    send({ ...state });
  };

  function install() {
    if (state?.phase === 'installing') return;
    push({ phase: 'installing' });
    if (notice) notify(notice);
    later(() => {
      onQuit();
      updater.quitAndInstall(true, true);   // silent, then reopen Clarity
    }, installDelayMs);
  }

  updater.on('update-available', (info) => {
    push({ phase: 'downloading', version: info.version, percent: 0, wanted: state?.wanted || false, atStartup: startup });
  });
  updater.on('download-progress', (p) => {
    if (!state || state.phase !== 'downloading') return;
    const percent = Math.floor(p.percent || 0);
    if (percent !== state.percent) push({ percent });
  });
  updater.on('update-downloaded', (info) => {
    push({ phase: 'ready', version: info.version, percent: 100 });
    if (state.wanted) install();
  });
  updater.on('error', () => {
    // Only worth a word if the person is waiting on it; a background check
    // that failed (offline, say) simply tries again later.
    if (state?.wanted && state.phase === 'downloading') push({ phase: 'error' });
  });

  return {
    /** The result of a check, flagged when it is the one made at launch. */
    async check() {
      try { await updater.checkForUpdates(); } catch { /* offline: next time */ }
      startup = false;
    },
    status: () => (state ? { ...state } : null),
    /** "Update now": install at once if downloaded, as soon as it is otherwise. */
    now(words) {
      if (words?.title) notice = { title: String(words.title), body: String(words.body || '') };
      if (!state) return;
      if (state.phase === 'ready') { state.wanted = true; install(); return; }
      if (state.phase === 'error') {
        push({ phase: 'downloading', percent: 0, wanted: true });
        updater.downloadUpdate?.().catch(() => {});
        return;
      }
      if (state.phase === 'downloading') push({ wanted: true });
    },
    /** "Later": it keeps downloading, and installs when the person quits.
     *  After a failed download, the next periodic check starts it again. */
    later() {
      if (state && state.phase !== 'installing') push({ wanted: false });
    },
  };
}

/**
 * Was Clarity just updated? Compares this version with the one that ran last.
 * The first launch of a version that did not record it yet (1.3.1 and before)
 * counts as an update when the person already has data — a fresh install
 * has none, and has nothing to be told.
 */
function justUpdated({ version, readLast, writeLast, hasData }) {
  let last = null;
  try { last = (readLast() || '').trim() || null; } catch { /* first time */ }
  try { writeLast(version); } catch { /* read-only profile: ask again next time */ }
  if (last === version) return null;
  if (!last && !hasData()) return null;
  return { from: last, to: version };
}

module.exports = { createUpdateFlow, justUpdated, PHASES };
