// Quiet rules and the delivery log.
//
// Its own file, like the profile and the threads, for the reason that keeps
// recurring: clearing your task list must not silence Clarity, and it must not
// un-silence it either. A person who said "stop suggesting" and then tidied
// their tasks has not changed their mind.

import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { writeJSONAtomic, quarantine } from '../storage.js';
import { makeQuietRule, activeQuietRules, countToday, lastDeliveryAt } from './policy.js';

export const SUGGEST_VERSION = 1;

// The log is what the budget is computed from, so it is trimmed by age rather
// than by count — dropping the newest entries would hand back spent budget.
const KEEP_DAYS = 30;

const isStore = (d) => !!d && typeof d === 'object' && Array.isArray(d.quiet) && Array.isArray(d.log);

export function createSuggestStore({ dataDir, log: logger = console }) {
  const FILE = join(dataDir, 'suggestions.json');

  function read() {
    if (!existsSync(FILE)) return { version: SUGGEST_VERSION, quiet: [], log: [] };
    try {
      const parsed = JSON.parse(readFileSync(FILE, 'utf8'));
      if (!isStore(parsed)) throw new Error('missing quiet/log arrays');
      return { version: SUGGEST_VERSION, ...parsed };
    } catch (err) {
      const kept = quarantine(FILE, 'corrupt');
      logger.error(`[Clarity] suggestions.json unreadable (${err.message})${kept ? ` — kept at ${kept}` : ''}`);
      return { version: SUGGEST_VERSION, quiet: [], log: [] };
    }
  }

  function save(store) {
    if (!isStore(store)) throw new Error('refusing to save a malformed suggestion store');
    const cutoff = Date.now() - KEEP_DAYS * 86400000;
    writeJSONAtomic(FILE, {
      ...store,
      version: SUGGEST_VERSION,
      log: store.log.filter(e => { const t = Date.parse(e?.at); return !Number.isNaN(t) && t >= cutoff; }),
    });
  }

  function addQuiet(spec, { now = new Date() } = {}) {
    const store = read();
    const rule = makeQuietRule(spec, { now });          // throws on a rule it cannot honour
    store.quiet.push(rule);
    save(store);
    return rule;
  }

  function liftQuiet(id) {
    const store = read();
    const before = store.quiet.length;
    store.quiet = store.quiet.filter(r => r.id !== id);
    if (store.quiet.length === before) return false;
    save(store);
    return true;
  }

  /** Drop rules that have expired, so the list shown is the list in force. */
  function pruneQuiet({ now = new Date(), tasks = null } = {}) {
    const store = read();
    const active = activeQuietRules(store.quiet, { now, tasks });
    if (active.length === store.quiet.length) return store.quiet;
    store.quiet = active;
    save(store);
    return active;
  }

  /**
   * Record that something was actually said. ONLY called on delivery — a
   * refused check must never land here, or the budget drains while Clarity
   * stays silent.
   */
  function recordDelivery(candidate, { now = new Date() } = {}) {
    const store = read();
    const entry = {
      id: `sug-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      at: now.toISOString(),
      kind: candidate.kind,
      taskId: candidate.taskId,
      title: candidate.title,
      because: candidate.because,
      outcome: null,
    };
    store.log.push(entry);
    save(store);
    return entry;
  }

  function recordOutcome(id, outcome) {
    const store = read();
    const entry = store.log.find(e => e.id === id);
    if (!entry) return null;
    entry.outcome = outcome;
    entry.answeredAt = new Date().toISOString();
    save(store);
    return entry;
  }

  function budgetState({ now = new Date() } = {}) {
    const store = read();
    return { sentToday: countToday(store.log, now), lastSentAt: lastDeliveryAt(store.log), log: store.log };
  }

  return { FILE, read, save, addQuiet, liftQuiet, pruneQuiet, recordDelivery, recordOutcome, budgetState };
}
