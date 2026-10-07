import { describe, test, expect } from '@jest/globals';
import { mkdtempSync, readFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { scrub, makeReport, formatReport, createCrashReporter, MAX_PENDING } from '../src/crash/crash.js';

// Crash reports leave the computer, so what they carry is pinned here: the
// error and where it happened, never a name, a path to the person's files or
// anything recorded while reports were off.
const HOME = 'C:\\Users\\Raphael';
const STACK = `TypeError: Cannot read properties of undefined (reading 'title')
    at renderTask (C:\\Users\\Raphael\\AppData\\Local\\Programs\\Clarity\\resources\\app.asar\\frontend\\dist\\assets\\index.js:12:3)
    at C:/Users/Raphael/AppData/Local/Programs/Clarity/resources/backend/server.js:400:9
    at /home/someone/clarity/x.js:1:1`;

describe('what a crash report carries', () => {
  test('the home folder, other profiles and e-mails are blanked out', () => {
    const s = scrub(`${STACK}\nwrite to raphael@example.com failed`, HOME);
    expect(s).not.toMatch(/Raphael/i);
    expect(s).not.toMatch(/someone/);
    expect(s).not.toMatch(/@example/);
    expect(s).toContain('~\\AppData\\Local\\Programs\\Clarity');
  });

  test('only the message and the stack frames, bounded', () => {
    const r = makeReport({ where: 'window', message: 'x'.repeat(2000), stack: STACK }, { home: HOME });
    expect(r.message).toHaveLength(500);
    expect(r.stack).toHaveLength(3);
    expect(r.stack.every(f => f.startsWith('at '))).toBe(true);
    expect(makeReport({ where: 'elsewhere', message: 'm' }).where).toBe('app');
  });

  test('the text sent names the place, the version and the system', () => {
    const text = formatReport(makeReport({ where: 'service', message: 'boom', stack: STACK }, { home: HOME }), { version: '1.4.0', system: 'win32 10.0' });
    expect(text).toMatch(/plantage — service/);
    expect(text).toMatch(/Version : 1\.4\.0 · Système : win32 10\.0/);
    expect(text).toContain('boom');
  });
});

describe('the queue', () => {
  const setup = ({ on = true, fail = false } = {}) => {
    const sent = [];
    const state = { on };
    const reporter = createCrashReporter({
      dataDir: mkdtempSync(join(tmpdir(), 'clarity-crash-')),
      enabled: () => state.on,
      send: async (text) => { if (fail) throw new Error('offline'); sent.push(text); },
      version: '1.4.0', system: 'test', home: HOME,
    });
    return { reporter, sent, state };
  };

  test('nothing recorded while off ever leaves, even if turned on later', async () => {
    const { reporter, sent, state } = setup({ on: false });
    expect(reporter.record({ where: 'app', message: 'boom', stack: STACK })).toBeNull();
    expect(existsSync(reporter.PENDING)).toBe(false);
    state.on = true;
    expect((await reporter.flush()).sent).toBe(0);
    expect(sent).toHaveLength(0);
  });

  test('sent once, kept when offline, then sent at the next try', async () => {
    const offline = setup({ fail: true });
    offline.reporter.record({ where: 'app', message: 'boom', stack: STACK });
    expect((await offline.reporter.flush()).sent).toBe(0);
    expect(readFileSync(offline.reporter.PENDING, 'utf8')).toContain('boom');

    const { reporter, sent } = setup();
    reporter.record({ where: 'app', message: 'boom', stack: STACK });
    reporter.record({ where: 'app', message: 'boom', stack: STACK });   // same error, same day
    expect((await reporter.flush()).sent).toBe(1);
    expect(sent).toHaveLength(1);
    expect(sent[0]).not.toMatch(/Raphael/i);
    expect(readFileSync(reporter.PENDING, 'utf8')).toBe('');
    expect(reporter.recent()).toEqual([expect.objectContaining({ where: 'app', message: 'boom' })]);
  });

  test('a crash loop cannot grow the queue without bound, nor flood the form', async () => {
    const { reporter, sent } = setup();
    for (let i = 0; i < MAX_PENDING + 20; i++) reporter.record({ where: 'app', message: `boom ${i}`, stack: STACK });
    expect(readFileSync(reporter.PENDING, 'utf8').trim().split('\n')).toHaveLength(MAX_PENDING);
    await reporter.flush();
    expect(sent).toHaveLength(3);
  });

  test('a queue left by another process is emptied unsent while reports are off', async () => {
    const { reporter, sent, state } = setup();
    reporter.record({ where: 'service', message: 'boom', stack: STACK });
    state.on = false;
    expect(await reporter.flush()).toEqual({ sent: 0, dropped: 1 });
    state.on = true;
    expect((await reporter.flush()).sent).toBe(0);
    expect(sent).toHaveLength(0);
  });

  test('a raw entry written by the Electron shell is cleaned before it leaves', async () => {
    const { reporter, sent } = setup();
    const { appendFileSync } = await import('fs');
    appendFileSync(reporter.PENDING, JSON.stringify({ at: new Date().toISOString(), where: 'service',
      message: 'background service stopped (code 1) — Error at C:\\Users\\Raphael\\x', stack: STACK }) + '\n');
    expect((await reporter.flush()).sent).toBe(1);
    expect(sent[0]).toMatch(/background service stopped/);
    expect(sent[0]).not.toMatch(/Raphael/i);
  });

  test('no queue file until something happens', () => {
    const { reporter } = setup();
    expect(existsSync(reporter.PENDING)).toBe(false);
  });
});
