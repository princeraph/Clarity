// The sync run: read what is on disk, ask the server what changed, decide
// (plan.js), write, send. One run at a time; a run that fails changes nothing
// it has not finished, and the next one picks up where the agreement stands.
//
// What travels: tasks (archived included), follow-up threads, the profile's
// understanding/proposals/preferences, and the journal. What never does:
// settings.json (API key, machine choices), the computed `observed` layer and
// the AI analysis — both are recomputed on each device from the tasks.

import { createHash, randomUUID } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { hostname } from 'os';
import { writeJSONAtomic, appendJSONL, readJSONL } from '../storage.js';
import { planSync, afterPush, keyOf } from './plan.js';
import { SyncError } from './client.js';

const PULL_OVERLAP_MS = 2 * 60 * 1000;   // server stamps can commit out of order
const PROFILE_SYNCED = ['understanding', 'proposals', 'preferences'];

function readJSON(file, fallback) {
  if (!existsSync(file)) return fallback;
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return fallback; }
}
const hashOf = v => createHash('sha256').update(JSON.stringify(v)).digest('hex');

export function createSyncEngine({ dataDir, readData, saveData, client, getSession, setSession, log = console, onApplied = () => {} }) {
  const STATE_FILE = join(dataDir, 'sync.json');
  const THREADS_FILE = join(dataDir, 'threads.json');
  const PROFILE_FILE = join(dataDir, 'profile.json');
  const JOURNAL_FILE = join(dataDir, 'journal.jsonl');

  let running = null;
  let last = { at: null, ok: null, error: null, pulled: 0, pushed: 0 };

  function readState() {
    const s = readJSON(STATE_FILE, {});
    return {
      deviceId: s.deviceId || randomUUID(),
      device: s.device || hostname().slice(0, 100),
      known: s.known && typeof s.known === 'object' ? s.known : {},
      cursor: s.cursor || null,
      profileHash: s.profileHash || null,
      profileAt: s.profileAt || null,
    };
  }
  const saveState = s => writeJSONAtomic(STATE_FILE, s);

  // ── disk → items ───────────────────────────────────────────────────────────
  function snapshot(state, now) {
    const local = new Map();
    const put = (kind, id, data, updatedAt) => local.set(keyOf(kind, id), { kind, id: String(id), data, updatedAt });

    for (const t of readData().tasks || []) if (t?.id) put('task', t.id, t, t.updatedAt || t.createdAt || now.toISOString());

    const threads = readJSON(THREADS_FILE, { threads: {} }).threads || {};
    for (const [id, th] of Object.entries(threads)) put('thread', id, th, th.updatedAt || now.toISOString());

    // The profile rewrites its own timestamp on every recompute; only a change
    // of what is synced counts, or two devices would send it back and forth.
    const profile = readJSON(PROFILE_FILE, null);
    if (profile) {
      const part = Object.fromEntries(PROFILE_SYNCED.map(k => [k, profile[k] ?? null]));
      const h = hashOf(part);
      if (h !== state.profileHash) { state.profileHash = h; state.profileAt = now.toISOString(); }
      put('profile', 'profile', part, state.profileAt);
    }

    for (const e of readJSONL(JOURNAL_FILE).entries) if (e?.id) put('journal', e.id, e, e.at || now.toISOString());
    return local;
  }

  // ── items → disk ───────────────────────────────────────────────────────────
  // Re-reads each file at write time and re-checks "newer": the disk may have
  // changed while the network round trip was in flight.
  function applyRemote(apply, state) {
    const by = kind => apply.filter(a => a.kind === kind);
    const newer = (incoming, current) => !current || Date.parse(incoming.updatedAt || 0) >= Date.parse(current.updatedAt || 0);

    const tasks = by('task');
    if (tasks.length) {
      const data = readData();
      const list = data.tasks || [];
      for (const a of tasks) {
        const i = list.findIndex(t => t.id === a.id);
        if (a.deleted) { if (i !== -1) list.splice(i, 1); }
        else if (i === -1) list.push(a.data);
        else if (newer(a.data, list[i])) list[i] = a.data;
      }
      data.tasks = list;
      saveData(data);
    }

    const threads = by('thread');
    if (threads.length) {
      const store = readJSON(THREADS_FILE, { version: 1, threads: {} });
      store.threads = store.threads || {};
      for (const a of threads) {
        if (a.deleted) delete store.threads[a.id];
        else if (newer(a.data, store.threads[a.id])) store.threads[a.id] = a.data;
      }
      writeJSONAtomic(THREADS_FILE, store);
    }

    const profile = by('profile').find(a => !a.deleted);
    if (profile) {
      const current = readJSON(PROFILE_FILE, {});
      const next = { ...current, ...profile.data };      // `observed` stays this device's
      writeJSONAtomic(PROFILE_FILE, next);
      state.profileHash = hashOf(Object.fromEntries(PROFILE_SYNCED.map(k => [k, next[k] ?? null])));
      state.profileAt = profile.updated_at;   // or it reads as older next run, and is applied again
    }

    const journal = by('journal').filter(a => !a.deleted);
    if (journal.length) {
      const have = new Set(readJSONL(JOURNAL_FILE).entries.map(e => e.id));
      for (const a of journal) if (!have.has(a.id)) appendJSONL(JOURNAL_FILE, a.data);
    }
    if (apply.length) onApplied(apply);
  }

  async function token() {
    const s = getSession();
    if (!s?.refreshToken) throw new SyncError('signed-out', 'not signed in');
    if (s.accessToken && s.expiresAt && s.expiresAt * 1000 > Date.now() + 60_000) return s.accessToken;
    const fresh = await client.refresh(s.refreshToken);
    await setSession({ ...s, accessToken: fresh.access_token, refreshToken: fresh.refresh_token, expiresAt: fresh.expires_at });
    return fresh.access_token;
  }

  async function runOnce({ now = new Date() } = {}) {
    const state = readState();
    const tok = await token();
    const since = state.cursor ? new Date(Date.parse(state.cursor) - PULL_OVERLAP_MS).toISOString() : null;
    const remote = await client.pull(tok, since);
    const local = snapshot(state, now);
    const plan = planSync({ local, known: state.known, remote, now });
    applyRemote(plan.apply, state);
    await client.push(tok, plan.push, { device: state.device });
    const cursor = remote.reduce((m, r) => (!m || r.synced_at > m ? r.synced_at : m), state.cursor);
    saveState({ ...state, known: afterPush(plan.nextKnown, plan.push), cursor });
    return { pulled: plan.apply.length, pushed: plan.push.length };
  }

  return {
    /** One run at a time; a second call while one runs joins it. */
    run(opts) {
      if (running) return running;
      running = runOnce(opts)
        .then(r => { last = { at: new Date().toISOString(), ok: true, error: null, ...r }; return r; })
        .catch(err => { last = { ...last, at: new Date().toISOString(), ok: false, error: err.code || 'error', message: err.message }; throw err; })
        .finally(() => { running = null; });
      return running;
    },
    status: () => ({ ...last, running: !!running }),
    /** Forget the agreement: the next sign-in merges from scratch. */
    reset: () => saveState({ ...readState(), known: {}, cursor: null, profileHash: null, profileAt: null }),
  };
}
