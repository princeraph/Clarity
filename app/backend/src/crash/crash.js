// Crash reports: the bugs a tester hits and never writes about.
//
// Off until the person says yes (asked once, changeable in Settings ›
// Privacy). What leaves is decided here and nowhere else: where it happened
// (window, app, background service), the error's message and stack, the
// version and the system — with the user's home folder blanked out of every
// path. Never tasks, notes or settings: no argument here can carry them.
//
// A report is first written to a local queue (crash-pending.jsonl), because
// the worst crashes leave no process alive to send anything: the next launch
// sends what the last one could not. With reports off nothing is written, and
// a queue found while off (left by another process) is emptied unsent.

import { existsSync, readFileSync, writeFileSync, appendFileSync, renameSync } from 'fs';
import { join } from 'path';

export const WHERE = ['window', 'app', 'service'];
export const MAX_MESSAGE = 500;
export const MAX_FRAMES = 25;
export const MAX_PENDING = 50;          // a crash loop must not grow the queue forever
export const SEND_PER_FLUSH = 3;
export const RECENT_KEPT = 10;

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Blanks out what could name the person: their home folder, and e-mail addresses. */
export function scrub(text, home = '') {
  let out = String(text ?? '');
  if (home) {
    for (const variant of new Set([home, home.replace(/\\/g, '/'), home.replace(/\//g, '\\')])) {
      out = out.replace(new RegExp(escapeRe(variant), 'gi'), '~');
    }
  }
  // C:\Users\<name>\… or /home/<name>/… that is not this home (another profile).
  out = out.replace(/([A-Za-z]:[\\/](?:Users|Documents and Settings)[\\/])[^\\/\s:]+/gi, '$1…');
  out = out.replace(/(\/(?:home|Users)\/)[^/\s:]+/g, '$1…');
  out = out.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '…@…');
  return out;
}

/** One report, cleaned and bounded. */
export function makeReport({ where, message, stack }, { home = '', now = new Date() } = {}) {
  const w = WHERE.includes(where) ? where : 'app';
  const msg = scrub(message, home).slice(0, MAX_MESSAGE);
  const frames = scrub(stack, home).split('\n')
    .map(l => l.trim()).filter(l => l.startsWith('at '))
    .slice(0, MAX_FRAMES);
  return { at: now.toISOString(), where: w, message: msg, stack: frames };
}

// Same error, same place, same day: one report.
const signature = (r) => `${r.where}|${r.message}|${r.stack[0] || ''}|${r.at.slice(0, 10)}`;

/** The text that goes into the form. */
export function formatReport(r, { version = '', system = '' } = {}) {
  return [
    `[Rapport de plantage — ${r.where}]`,
    `Quand : ${r.at}`,
    `Version : ${version} · Système : ${system}`,
    '',
    r.message || '(sans message)',
    ...r.stack.map(f => `  ${f}`),
  ].join('\n');
}

const readLines = (file) => {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8').split('\n').filter(Boolean)
    .map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
};
const writeLines = (file, rows) => {
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, rows.map(r => JSON.stringify(r) + '\n').join(''));
  renameSync(tmp, file);
};

/**
 * dataDir: where the queue lives. enabled(): the person's choice, read each
 * time. send(text): resolves once the form accepted it, throws otherwise.
 */
export function createCrashReporter({ dataDir, enabled, send, version = '', system = '', home = '', now = () => new Date() }) {
  const PENDING = join(dataDir, 'crash-pending.jsonl');
  const SENT = join(dataDir, 'crash-sent.jsonl');
  let flushing = null;

  function record(input) {
    if (!enabled()) return null;            // off: not even written down
    const r = makeReport(input, { home, now: now() });
    const pending = readLines(PENDING);
    if (pending.some(p => signature(p) === signature(r))) return null;
    if (pending.length >= MAX_PENDING) return null;
    appendFileSync(PENDING, JSON.stringify(r) + '\n');
    return r;
  }

  async function flushOnce() {
    // The Electron shell writes raw entries when this process is down (its
    // stack still a string): cleaned here like any other.
    const pending = readLines(PENDING).map(r => (Array.isArray(r.stack) ? r
      : makeReport(r, { home, now: new Date(Date.parse(r.at) || now().getTime()) })));
    if (!pending.length) return { sent: 0, dropped: 0 };
    if (!enabled()) {                       // recorded while off: never leaves
      writeLines(PENDING, []);
      return { sent: 0, dropped: pending.length };
    }
    const sentSigs = new Set(readLines(SENT).map(signature));
    let sent = 0;
    const left = [];
    for (const r of pending) {
      if (sentSigs.has(signature(r))) continue;          // already reported today
      if (sent >= SEND_PER_FLUSH) { left.push(r); continue; }
      try {
        await send(formatReport(r, { version, system }));
        sent++;
        sentSigs.add(signature(r));
        writeLines(SENT, [...readLines(SENT), r].slice(-RECENT_KEPT));
      } catch {
        left.push(r);                        // offline: next time
      }
    }
    writeLines(PENDING, left);
    return { sent, dropped: 0 };
  }

  return {
    record,
    /** Sends what is queued (or drops it, with reports off). One flush at a time. */
    flush() {
      if (!flushing) flushing = flushOnce().finally(() => { flushing = null; });
      return flushing;
    },
    /** What was sent lately, for Settings — date, place and message, nothing more. */
    recent: () => readLines(SENT).reverse().map(r => ({ at: r.at, where: r.where, message: r.message })),
    PENDING,
  };
}
