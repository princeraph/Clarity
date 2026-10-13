// The sync run: read what is on disk, ask the server what changed, decide
// (plan.js), write, send. One run at a time; a run that fails changes nothing
// it has not finished, and the next one picks up where the agreement stands.
//
// What travels: tasks (archived included), follow-up threads, the profile's
// confirmed understanding / proposals / preferences (profileSync.js), and the
// journal. What never does: settings.json (API key, machine choices), the
// computed `observed` layer and insights derived from it, and the AI analysis
// — all recomputed on each device from the synced tasks.
//
// Guards, each from the audit of 13 October:
//   - an unreadable local file stops the run. Falling back to "empty" would
//     have read as "everything deleted here" and erased it on every device;
//   - when the host says its files were just recovered (from damage or a
//     backup), nothing missing is sent as a deletion;
//   - a run that would delete more than half of what was synced is refused,
//     unless the person just asked for exactly that ("Delete all tasks");
//   - reset() and stop() end the agreement a run in flight still holds: that
//     run then writes nothing, sends nothing and saves no state. Without it a
//     factory reset during a run tombstoned every task of the account.

import { randomUUID } from 'crypto';
import { existsSync, readFileSync, writeFileSync, renameSync, unlinkSync } from 'fs';
import { join } from 'path';
import { hostname } from 'os';
import { writeJSONAtomic, appendJSONL, readJSONL } from '../storage.js';
import { planSync, afterPush, keyOf } from './plan.js';
import { SyncError } from './client.js';
import { syncedPart, fingerprintOf, mergeProfile } from './profileSync.js';

const PULL_OVERLAP_MS = 2 * 60 * 1000;   // server stamps can commit out of order
const MASS_DELETE_SHARE = 0.5;
const MASS_DELETE_MIN = 5;

// Absent → fallback. Present but unreadable → stop: never treat damage as empty.
function readJSONStrict(file, fallback) {
  if (!existsSync(file)) return fallback;
  try { return JSON.parse(readFileSync(file, 'utf8')); }
  catch (err) { throw new SyncError('local-unreadable', `${file.split(/[\\/]/).pop()} unreadable: ${err.message}`); }
}

export function createSyncEngine({
  dataDir, readData, saveData, client, getSession, setSession, log = console,
  onApplied = () => {},
  isLocalTrusted = () => true,          // false right after a recovery
  massDeleteAllowed = () => false,      // true right after "Delete all tasks"
}) {
  const STATE_FILE = join(dataDir, 'sync.json');
  const THREADS_FILE = join(dataDir, 'threads.json');
  const PROFILE_FILE = join(dataDir, 'profile.json');
  const JOURNAL_FILE = join(dataDir, 'journal.jsonl');
  const JOURNAL_DELETED = join(dataDir, 'journal-deleted.json');

  let running = null;
  let generation = 0;
  let last = { at: null, ok: null, error: null, pulled: 0, pushed: 0 };

  function readState() {
    let s = {};
    if (existsSync(STATE_FILE)) { try { s = JSON.parse(readFileSync(STATE_FILE, 'utf8')); } catch { s = {}; } }
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

    const threads = readJSONStrict(THREADS_FILE, { threads: {} })?.threads || {};
    for (const [id, th] of Object.entries(threads)) if (th) put('thread', id, th, th.updatedAt || now.toISOString());

    const profile = readJSONStrict(PROFILE_FILE, null);
    if (profile) {
      const part = syncedPart(profile);
      const h = fingerprintOf(part);
      if (h !== state.profileHash) {
        // First look in this agreement (fresh sign-in): not "newer than the
        // server". The server's copy is merged in first, then the union is sent.
        // Otherwise: changed here, so strictly newer than the copy last agreed
        // on — an edit in the same millisecond as the last sync tied with it,
        // and a tie is not sent (a rejection was lost that way: 8 test runs in 30).
        state.profileAt = state.profileHash == null ? new Date(0).toISOString()
          : new Date(Math.max(now.getTime(), (Date.parse(state.profileAt) || 0) + 1)).toISOString();
        state.profileHash = h;
      }
      put('profile', 'profile', part, state.profileAt);
    }

    for (const e of readJSONL(JOURNAL_FILE).entries) if (e?.id) put('journal', e.id, e, e.at || now.toISOString());
    return local;
  }

  function explicitDeletes() {
    const d = readJSONStrict(JOURNAL_DELETED, []);
    return Array.isArray(d) ? d.filter(id => typeof id === 'string').map(id => ({ kind: 'journal', id })) : [];
  }

  // ── items → disk ───────────────────────────────────────────────────────────
  // Re-reads each file at write time and re-checks "newer": the disk may have
  // changed while the network round trip was in flight.
  function applyRemote(apply, state, now) {
    const by = kind => apply.filter(a => a.kind === kind);
    const newer = (incoming, current) => !current || Date.parse(incoming?.updatedAt || 0) >= Date.parse(current.updatedAt || 0);

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
      const store = readJSONStrict(THREADS_FILE, { version: 1, threads: {} });
      store.threads = store.threads || {};
      for (const a of threads) {
        if (a.deleted) delete store.threads[a.id];
        else if (newer(a.data, store.threads[a.id])) store.threads[a.id] = a.data;
      }
      writeJSONAtomic(THREADS_FILE, store);
    }

    let merged = null;
    const profile = by('profile').find(a => !a.deleted);
    if (profile) {
      const current = readJSONStrict(PROFILE_FILE, {}) || {};
      const next = mergeProfile(current, profile.data);
      writeJSONAtomic(PROFILE_FILE, next);
      const h = fingerprintOf(syncedPart(next));
      state.profileHash = h;
      // The merge added something the server lacks: send the union back in this
      // same run — waiting for the next one leaves the other device behind.
      if (h === fingerprintOf(profile.data)) state.profileAt = profile.updated_at;
      else {
        state.profileAt = new Date(Math.max(now.getTime(), Date.parse(profile.updated_at) + 1)).toISOString();
        merged = { kind: 'profile', id: 'profile', data: syncedPart(next), deleted: false, updated_at: state.profileAt };
      }
    }

    const journal = by('journal');
    if (journal.length) {
      const gone = new Set(journal.filter(a => a.deleted).map(a => a.id));
      const entries = readJSONL(JOURNAL_FILE).entries;
      if (gone.size && entries.some(e => gone.has(e.id))) {
        const tmp = `${JOURNAL_FILE}.tmp`;
        writeFileSync(tmp, entries.filter(e => !gone.has(e.id)).map(e => JSON.stringify(e) + '\n').join(''));
        renameSync(tmp, JOURNAL_FILE);
      }
      const have = new Set(entries.map(e => e.id));
      for (const a of journal) if (!a.deleted && !have.has(a.id)) appendJSONL(JOURNAL_FILE, a.data);
    }
    if (apply.length) onApplied(apply);
    return merged;
  }

  async function token(gen) {
    const s = getSession();
    if (!s?.refreshToken) throw new SyncError('signed-out', 'not signed in');
    if (s.accessToken && s.expiresAt && s.expiresAt * 1000 > Date.now() + 60_000) return s.accessToken;
    const fresh = await client.refresh(s.refreshToken);
    // Signed out (or reset) while the refresh was in flight: do not sign back in.
    if (gen !== generation || !getSession()) throw new SyncError('cancelled', 'session ended during the run');
    await setSession({ ...s, accessToken: fresh.access_token, refreshToken: fresh.refresh_token, expiresAt: fresh.expires_at });
    return fresh.access_token;
  }

  async function runOnce({ now = new Date() } = {}) {
    const gen = generation;
    const alive = () => { if (gen !== generation || !getSession()) throw new SyncError('cancelled', 'session ended during the run'); };
    const state = readState();
    const tok = await token(gen);
    const since = state.cursor ? new Date(Date.parse(state.cursor) - PULL_OVERLAP_MS).toISOString() : null;
    const remote = await client.pull(tok, since);
    alive();

    const local = snapshot(state, now);
    const deletes = explicitDeletes();
    const plan = planSync({ local, known: state.known, remote, now, allowDeletes: isLocalTrusted(), explicitDeletes: deletes });

    // A fresh profile is dated 1970 so that a server copy wins and is merged in.
    // With no server copy it is sent — but never dated 1970 on the server, or
    // the next fresh device would tie with it and skip the merge.
    for (const p of plan.push) {
      if (p.kind === 'profile' && Date.parse(p.updated_at) === 0) { p.updated_at = now.toISOString(); state.profileAt = p.updated_at; }
    }

    const tombstones = plan.push.filter(p => p.deleted && p.kind !== 'journal').length;
    const knownCount = Object.keys(state.known).filter(k => !k.startsWith('journal:')).length;
    if (tombstones >= MASS_DELETE_MIN && tombstones > knownCount * MASS_DELETE_SHARE && !massDeleteAllowed()) {
      throw new SyncError('mass-delete', `${tombstones} of ${knownCount} items would be deleted on every device`);
    }

    const merged = applyRemote(plan.apply, state, now);
    if (merged) plan.push = [...plan.push.filter(p => p.kind !== 'profile'), merged];
    await client.push(tok, plan.push, { device: state.device });
    alive();
    if (deletes.length) { try { unlinkSync(JOURNAL_DELETED); } catch { /* already gone */ } }
    const cursor = remote.reduce((m, r) => (!m || r.synced_at > m ? r.synced_at : m), state.cursor);
    saveState({ ...state, known: afterPush(plan.nextKnown, plan.push), cursor });
    return { pulled: plan.apply.length, pushed: plan.push.length };
  }

  const engine = {
    /** One run at a time; a second call while one runs joins it. */
    run(opts) {
      if (running) return running;
      running = runOnce(opts)
        .then(r => { last = { at: new Date().toISOString(), ok: true, error: null, ...r }; return r; })
        .catch(err => {
          if (err?.code !== 'cancelled') last = { ...last, at: new Date().toISOString(), ok: false, error: err.code || 'error', message: err.message };
          throw err;
        })
        .finally(() => { running = null; });
      return running;
    },
    status: () => ({ ...last, running: !!running }),
    /** End the current agreement: a run in flight finishes without effect. Resolves once it has. */
    async stop() {
      generation++;
      if (running) { try { await running; } catch { /* cancelled */ } }
    },
    /** Forget the agreement: the next sign-in merges from scratch. */
    async reset() {
      await engine.stop();
      saveState({ ...readState(), known: {}, cursor: null, profileHash: null, profileAt: null });
      last = { at: null, ok: null, error: null, pulled: 0, pushed: 0 };
    },
    /** "Clear conversation history" here must clear it on the other devices too. */
    noteJournalDeleted(ids) {
      if (!ids?.length) return;
      let cur = [];
      if (existsSync(JOURNAL_DELETED)) { try { cur = JSON.parse(readFileSync(JOURNAL_DELETED, 'utf8')); } catch { cur = []; } }
      writeJSONAtomic(JOURNAL_DELETED, [...new Set([...(Array.isArray(cur) ? cur : []), ...ids])]);
    },
  };
  return engine;
}
