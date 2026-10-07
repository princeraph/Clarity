// The summary shown when the computer wakes from sleep or hibernation — the
// timing and the placement, kept apart from main.js so they can be tested
// without Electron.
//
// Windows signals the wake-up before the person is back: with a password on
// wake, the session is still locked, and a window shown then would wait
// behind the lock screen. So the summary waits for the session to be unlocked
// (or for it never to have been locked), checking every few seconds.

const WIDTH = 360;
const MARGIN = 12;

/**
 * Calls onReady once the session is unlocked after a wake-up.
 * idleState(): powerMonitor.getSystemIdleState — 'locked' while locked.
 * Returns a function that cancels the wait (a second wake-up replaces it).
 */
function whenUnlocked({ idleState, onReady, firstCheckMs = 3000, everyMs = 2000, giveUpMs = 4 * 3600 * 1000, timers = { setTimeout, clearTimeout } }) {
  let timer = null;
  let waited = 0;
  const check = () => {
    let state = 'active';
    try { state = idleState(); } catch { /* unknown: treat as unlocked */ }
    if (state !== 'locked') { timer = null; onReady(); return; }
    waited += everyMs;
    if (waited > giveUpMs) { timer = null; return; }   // nobody came back: say nothing
    timer = timers.setTimeout(check, everyMs);
  };
  timer = timers.setTimeout(check, firstCheckMs);
  return () => { if (timer) timers.clearTimeout(timer); timer = null; };
}

/** Bottom-right of the work area (above the taskbar), sized to the card. */
function placement(workArea, height) {
  const h = Math.max(120, Math.min(Math.round(height), workArea.height - 2 * MARGIN));
  return {
    x: workArea.x + workArea.width - WIDTH - MARGIN,
    y: workArea.y + workArea.height - h - MARGIN,
    width: WIDTH,
    height: h,
  };
}

module.exports = { whenUnlocked, placement, WIDTH };
