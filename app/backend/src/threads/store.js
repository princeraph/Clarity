// Persistence for follow-up threads.
//
// Its own file rather than a field on each task, for the same reason the
// profile is its own file: the two have different lifetimes. A thread outlives
// the state of the task it is about, and `DELETE /api/tasks/all` must not be
// the thing that erases why something never got done.
//
// Threads are keyed by task id. A thread whose task is gone is pruned on read —
// keeping it would mean carrying a conversation about nothing, and there is no
// screen that could ever show it.

import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { writeJSONAtomic, quarantine } from '../storage.js';
import { emptyThread } from './logic.js';

export const THREADS_VERSION = 1;

const isStore = (d) => !!d && typeof d === 'object' && !!d.threads && typeof d.threads === 'object';

export function createThreadStore({ dataDir, log = console }) {
  const FILE = join(dataDir, 'threads.json');

  function readAll() {
    if (!existsSync(FILE)) return { version: THREADS_VERSION, threads: {} };
    try {
      const parsed = JSON.parse(readFileSync(FILE, 'utf8'));
      if (!isStore(parsed)) throw new Error('missing threads object');
      return { version: THREADS_VERSION, ...parsed };
    } catch (err) {
      // Unreadable is not empty. Keep the bytes: a thread records things the
      // person said, which nothing else on disk can reconstruct.
      const kept = quarantine(FILE, 'corrupt');
      log.error(`[Clarity] threads.json unreadable (${err.message})${kept ? ` — kept at ${kept}` : ''}`);
      return { version: THREADS_VERSION, threads: {} };
    }
  }

  function save(store) {
    if (!isStore(store)) throw new Error('refusing to save a malformed thread store');
    writeJSONAtomic(FILE, { ...store, version: THREADS_VERSION });
  }

  function get(taskId) {
    return readAll().threads[taskId] ?? null;
  }

  /** Open on demand — never automatically, or every task becomes a conversation. */
  function open(taskId, { now = new Date() } = {}) {
    const store = readAll();
    if (store.threads[taskId]) return store.threads[taskId];
    store.threads[taskId] = emptyThread(taskId, { now });
    save(store);
    return store.threads[taskId];
  }

  /** Apply a pure transform from logic.js and persist the result. */
  function update(taskId, fn) {
    const store = readAll();
    const current = store.threads[taskId];
    if (!current) return null;
    const next = fn(current);
    store.threads[taskId] = next;
    save(store);
    return next;
  }

  function remove(taskId) {
    const store = readAll();
    if (!store.threads[taskId]) return false;
    delete store.threads[taskId];
    save(store);
    return true;
  }

  /** Drop threads whose task no longer exists. Returns how many went. */
  function prune(taskIds) {
    const live = taskIds instanceof Set ? taskIds : new Set(taskIds || []);
    const store = readAll();
    let dropped = 0;
    for (const id of Object.keys(store.threads)) {
      if (!live.has(id)) { delete store.threads[id]; dropped++; }
    }
    if (dropped) save(store);
    return dropped;
  }

  return { FILE, readAll, save, get, open, update, remove, prune };
}
