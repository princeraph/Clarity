import { describe, test, expect } from '@jest/globals';
import { createRequire } from 'module';

// electron/wake.js: when the summary appears after the computer wakes, and
// where. Shown while the session is still locked, it would wait unseen
// behind the lock screen.
const require = createRequire(import.meta.url);
const { whenUnlocked, placement, WIDTH } = require('../../electron/wake.js');

function clock() {
  const queue = [];
  return {
    timers: {
      setTimeout: (fn, ms) => { const h = { fn, ms }; queue.push(h); return h; },
      clearTimeout: (h) => { const i = queue.indexOf(h); if (i !== -1) queue.splice(i, 1); },
    },
    tick() { const h = queue.shift(); if (h) h.fn(); return !!h; },
    pending: () => queue.length,
  };
}

describe('the summary after a wake-up', () => {
  test('waits for the session to be unlocked, then shows once', () => {
    const c = clock();
    const states = ['locked', 'locked', 'active'];
    let shown = 0;
    whenUnlocked({ idleState: () => states.shift(), onReady: () => shown++, timers: c.timers });
    c.tick(); c.tick();
    expect(shown).toBe(0);
    c.tick();
    expect(shown).toBe(1);
    expect(c.pending()).toBe(0);
  });

  test('a session that was never locked shows at the first check', () => {
    const c = clock();
    let shown = 0;
    whenUnlocked({ idleState: () => 'idle', onReady: () => shown++, timers: c.timers });
    c.tick();
    expect(shown).toBe(1);
  });

  test('a second wake-up cancels the first wait: one card, not two', () => {
    const c = clock();
    let shown = 0;
    const cancel = whenUnlocked({ idleState: () => 'locked', onReady: () => shown++, timers: c.timers });
    cancel();
    expect(c.pending()).toBe(0);
  });

  test('nobody came back: it gives up and says nothing', () => {
    const c = clock();
    let shown = 0;
    whenUnlocked({ idleState: () => 'locked', onReady: () => shown++, everyMs: 1000, giveUpMs: 5000, timers: c.timers });
    while (c.tick()) { /* run every check */ }
    expect(shown).toBe(0);
  });

  test('an unknown state counts as unlocked rather than waiting forever', () => {
    const c = clock();
    let shown = 0;
    whenUnlocked({ idleState: () => { throw new Error('unsupported'); }, onReady: () => shown++, timers: c.timers });
    c.tick();
    expect(shown).toBe(1);
  });

  test('bottom-right, above the taskbar, sized to the card', () => {
    const wa = { x: 0, y: 0, width: 1920, height: 1032 };
    expect(placement(wa, 300)).toEqual({ x: 1920 - WIDTH - 12, y: 1032 - 300 - 12, width: WIDTH, height: 300 });
    // never taller than the screen, never a sliver
    expect(placement(wa, 5000).height).toBe(1032 - 24);
    expect(placement(wa, 10).height).toBe(120);
    // a second screen to the left: inside its own work area
    expect(placement({ x: -1280, y: 0, width: 1280, height: 984 }, 300).x).toBe(-WIDTH - 12);
  });
});
