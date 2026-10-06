import { describe, test, expect } from '@jest/globals';
import { createRequire } from 'module';
import { EventEmitter } from 'events';

// electron/updateFlow.js: what the person sees of an update. In 1.3.1 the
// click on the pill closed Clarity with nothing on screen, and nothing said
// afterwards that it was up to date. These pin the steps that now say so.
const require = createRequire(import.meta.url);
const { createUpdateFlow, justUpdated } = require('../../electron/updateFlow.js');

function setup({ failCheck = false } = {}) {
  const updater = new EventEmitter();
  const calls = { quit: [], checks: 0, downloads: 0 };
  updater.checkForUpdates = async () => { calls.checks++; if (failCheck) throw new Error('offline'); };
  updater.downloadUpdate = async () => { calls.downloads++; };
  updater.quitAndInstall = (silent, reopen) => calls.quit.push({ silent, reopen });
  const sent = [], notes = [], timers = [];
  let quitting = false;
  const flow = createUpdateFlow({
    updater,
    send: (s) => sent.push(s),
    notify: (n) => notes.push(n),
    onQuit: () => { quitting = true; },
    later: (fn) => timers.push(fn),
  });
  return { flow, updater, calls, sent, notes, timers, last: () => sent[sent.length - 1], quitting: () => quitting };
}

const WORDS = { title: 'Mise à jour de Clarity en cours', body: 'Clarity se rouvrira tout seul.' };

describe('an update, as the person sees it', () => {
  test('a version found as Clarity opens is flagged for the window; one found later is not', async () => {
    const { flow, updater, last } = setup();
    const first = flow.check();
    updater.emit('update-available', { version: '1.3.2' });
    await first;
    expect(last()).toMatchObject({ phase: 'downloading', version: '1.3.2', atStartup: true, wanted: false });

    const second = flow.check();
    updater.emit('update-available', { version: '1.3.3' });
    await second;
    expect(last()).toMatchObject({ version: '1.3.3', atStartup: false });
  });

  test('"now" before the download ends: progress is shown, then it installs by itself', async () => {
    const { flow, updater, calls, notes, timers, last, quitting } = setup();
    updater.emit('update-available', { version: '1.3.2' });
    flow.now(WORDS);
    expect(last().wanted).toBe(true);
    updater.emit('download-progress', { percent: 41.7 });
    expect(last().percent).toBe(41);
    updater.emit('update-downloaded', { version: '1.3.2' });
    // Said on screen and in a notification BEFORE Clarity closes...
    expect(last().phase).toBe('installing');
    expect(notes).toEqual([WORDS]);
    expect(calls.quit).toEqual([]);
    // ...and only then closed, installed in silence, reopened.
    timers.forEach(fn => fn());
    expect(quitting()).toBe(true);
    expect(calls.quit).toEqual([{ silent: true, reopen: true }]);
  });

  test('"now" once downloaded installs at once', () => {
    const { flow, updater, calls, timers, last } = setup();
    updater.emit('update-available', { version: '1.3.2' });
    updater.emit('update-downloaded', { version: '1.3.2' });
    expect(last().phase).toBe('ready');
    flow.now(WORDS);
    expect(last().phase).toBe('installing');
    timers.forEach(fn => fn());
    expect(calls.quit).toHaveLength(1);
  });

  test('"later" lets the download finish without installing', () => {
    const { flow, updater, calls, timers, last } = setup();
    updater.emit('update-available', { version: '1.3.2' });
    flow.now(WORDS);
    flow.later();
    updater.emit('update-downloaded', { version: '1.3.2' });
    expect(last()).toMatchObject({ phase: 'ready', wanted: false });
    expect(timers).toHaveLength(0);
    expect(calls.quit).toHaveLength(0);
  });

  test('a failed download is said only when the person is waiting on it, and can be retried', () => {
    const quiet = setup();
    quiet.updater.emit('update-available', { version: '1.3.2' });
    quiet.updater.emit('error', new Error('offline'));
    expect(quiet.last().phase).toBe('downloading');

    const waiting = setup();
    waiting.updater.emit('update-available', { version: '1.3.2' });
    waiting.flow.now(WORDS);
    waiting.updater.emit('error', new Error('offline'));
    expect(waiting.last().phase).toBe('error');
    waiting.flow.now(WORDS);
    expect(waiting.last()).toMatchObject({ phase: 'downloading', wanted: true });
    expect(waiting.calls.downloads).toBe(1);
  });

  test('installing is never started twice', () => {
    const { flow, updater, timers } = setup();
    updater.emit('update-available', { version: '1.3.2' });
    updater.emit('update-downloaded', { version: '1.3.2' });
    flow.now(WORDS);
    flow.now(WORDS);
    expect(timers).toHaveLength(1);
  });

  test('an offline check does not throw', async () => {
    const { flow } = setup({ failCheck: true });
    await expect(flow.check()).resolves.toBeUndefined();
    expect(flow.status()).toBeNull();
  });
});

describe('"Clarity is up to date", at the next launch', () => {
  const run = ({ last, hasData = true, version = '1.3.2' }) => {
    let written = null;
    const r = justUpdated({ version, readLast: () => { if (last === undefined) throw new Error('ENOENT'); return last; }, writeLast: (v) => { written = v; }, hasData: () => hasData });
    return { r, written };
  };

  test('after an update', () => {
    expect(run({ last: '1.3.2\n' }).r).toBeNull();
    expect(run({ last: '1.3.1' }).r).toEqual({ from: '1.3.1', to: '1.3.2' });
  });
  test('the first launch of a version that did not record it yet: an update if there is data', () => {
    expect(run({ last: undefined, hasData: true }).r).toEqual({ from: null, to: '1.3.2' });
  });
  test('a fresh install has nothing to be told', () => {
    expect(run({ last: undefined, hasData: false }).r).toBeNull();
  });
  test('the version is recorded every time', () => {
    expect(run({ last: '1.3.1' }).written).toBe('1.3.2');
    expect(run({ last: undefined, hasData: false }).written).toBe('1.3.2');
  });
});
