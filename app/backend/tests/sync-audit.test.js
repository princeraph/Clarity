import { describe, test, expect, beforeEach } from '@jest/globals';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createSyncEngine } from '../src/sync/engine.js';
import { createSyncClient } from '../src/sync/client.js';

// One test per defect found by the audit of 13 October, each written to fail
// on the code that had it.

function fakeServer() {
  const rows = new Map(); let clock = 0; let gate = null;
  return {
    rows,
    hold() { let open; gate = new Promise(r => { open = r; }); return () => { gate = null; open(); }; },
    refresh: async () => ({ access_token: 'T', refresh_token: 'R2', expires_at: Math.floor(Date.now() / 1000) + 3600 }),
    pull: async (tok, since) => {
      const out = [...rows.values()].filter(r => !since || r.synced_at > since).map(r => ({ ...r }));
      if (gate) await gate;
      return out;
    },
    push: async (tok, list) => {
      for (const r of list) {
        const k = `${r.kind}:${r.id}`; const cur = rows.get(k);
        if (cur && Date.parse(r.updated_at) < Date.parse(cur.updated_at)) continue;
        rows.set(k, { ...r, synced_at: new Date(Date.UTC(2026, 9, 13) + (++clock) * 1000).toISOString() });
      }
    },
  };
}
function device(server, opts = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'clarity-audit-'));
  const file = join(dir, 'tasks.json');
  writeFileSync(file, JSON.stringify({ tasks: [] }));
  let session = { refreshToken: 'R' };
  const readData = () => existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { tasks: [] };
  const saveData = d => writeFileSync(file, JSON.stringify(d));
  const engine = createSyncEngine({ dataDir: dir, readData, saveData, client: server, getSession: () => session, setSession: s => { session = s; }, ...opts });
  const at = h => `2026-10-13T${String(h).padStart(2, '0')}:00:00.000Z`;
  return {
    dir, engine, file, readData,
    add: (id, h = 9) => { const d = readData(); d.tasks.push({ id, title: id, updatedAt: at(h) }); saveData(d); },
    ids: () => readData().tasks.map(t => t.id).sort(),
    writeProfile: p => writeFileSync(join(dir, 'profile.json'), JSON.stringify(p)),
    readProfile: () => JSON.parse(readFileSync(join(dir, 'profile.json'), 'utf8')),
  };
}
const insight = (key, extra = {}) => ({ id: `ins-${key}`, key, category: 'traits', statement: key, confidence: 0.5, source: 'elicited', status: 'active', lastConfirmed: '2026-10-13T08:00:00Z', ...extra });
const profile = (traits = []) => ({ understanding: { traits, drivers: [], blockers: [], strengths: [], skills: [], context: [] }, proposals: [], preferences: {} });
const fiveTasks = d => ['a', 'b', 'c', 'd', 'e', 'f'].forEach(id => d.add(id));

describe('audit 13 October — sync', () => {
  let server, A, B;
  beforeEach(() => { server = fakeServer(); A = device(server); B = device(server); });

  test('an unreadable threads.json stops the run: nothing is deleted anywhere', async () => {
    writeFileSync(join(A.dir, 'threads.json'), JSON.stringify({ threads: { t1: { taskId: 't1', updatedAt: '2026-10-13T09:00:00Z' } } }));
    await A.engine.run(); await B.engine.run();
    writeFileSync(join(A.dir, 'threads.json'), '{"threads": {"t1": ');   // torn write
    await expect(A.engine.run()).rejects.toMatchObject({ code: 'local-unreadable' });
    expect(server.rows.get('thread:t1').deleted).toBe(false);
  });

  test('tasks recovered from damage: what went missing is not sent as deleted', async () => {
    let trusted = true;
    const C = device(server, { isLocalTrusted: () => trusted });
    C.add('x'); C.add('y'); await C.engine.run();
    writeFileSync(C.file, JSON.stringify({ tasks: [] })); trusted = false;   // restored empty
    await C.engine.run();
    expect(server.rows.get('task:x').deleted).toBe(false);
    expect(server.rows.get('task:y').deleted).toBe(false);
  });

  test('a run that would delete most of the account is refused — unless asked for', async () => {
    let allowed = false;
    const C = device(server, { massDeleteAllowed: () => allowed });
    fiveTasks(C); await C.engine.run();
    writeFileSync(C.file, JSON.stringify({ tasks: [] }));
    await expect(C.engine.run()).rejects.toMatchObject({ code: 'mass-delete' });
    expect([...server.rows.values()].some(r => r.deleted)).toBe(false);
    allowed = true;                                                    // « Delete all tasks »
    await C.engine.run();
    expect([...server.rows.values()].every(r => r.deleted)).toBe(true);
  });

  test('a factory reset during a run: the run writes, sends and saves nothing', async () => {
    A.add('t1'); A.add('t2'); await A.engine.run(); await B.engine.run();
    const release = server.hold();
    const run = A.engine.run().catch(e => e);
    const stopped = A.engine.stop();
    for (const f of ['tasks.json', 'sync.json']) { try { unlinkSync(join(A.dir, f)); } catch {} }
    release();
    expect((await run).code).toBe('cancelled');
    await stopped;
    expect([...server.rows.values()].some(r => r.deleted)).toBe(false);
    expect(existsSync(join(A.dir, 'sync.json'))).toBe(false);
    await B.engine.run();
    expect(B.ids()).toEqual(['t1', 't2']);
  });

  test('signing in a second device merges profiles instead of replacing one', async () => {
    A.writeProfile(profile([insight('early')])); await A.engine.run();
    B.writeProfile(profile([insight('night')])); await B.engine.run(); await A.engine.run(); await B.engine.run();
    const keys = p => p.understanding.traits.map(i => i.key).sort();
    expect(keys(A.readProfile())).toEqual(['early', 'night']);
    expect(keys(B.readProfile())).toEqual(['early', 'night']);
  });

  test('a rejection travels and wins', async () => {
    A.writeProfile(profile([insight('k')])); await A.engine.run(); await B.engine.run();
    B.writeProfile(profile([insight('k', { status: 'user-rejected' })])); await B.engine.run(); await A.engine.run();
    expect(A.readProfile().understanding.traits[0].status).toBe('user-rejected');
  });

  test('recomputed insights do not bounce between devices', async () => {
    A.writeProfile(profile([insight('obs', { source: 'observed' }), insight('mine')])); await A.engine.run(); await B.engine.run();
    for (let i = 0; i < 4; i++) {
      const dev = i % 2 ? B : A;
      const p = dev.readProfile();
      p.understanding.traits = p.understanding.traits.map(x => ({ ...x, lastConfirmed: `2026-10-13T1${i}:00:00Z` }));
      p.observed = { recomputedAt: i };
      dev.writeProfile(p);
      expect(await dev.engine.run()).toEqual({ pulled: 0, pushed: 0 });
    }
  });

  test('clearing conversation history here clears it on the other devices', async () => {
    writeFileSync(join(A.dir, 'journal.jsonl'), JSON.stringify({ id: 'j1', at: '2026-10-13T09:00:00Z', kind: 'exchange', message: 'my private worry' }) + '\n');
    await A.engine.run(); await B.engine.run();
    writeFileSync(join(A.dir, 'journal.jsonl'), '');
    A.engine.noteJournalDeleted(['j1']);
    await A.engine.run(); await B.engine.run();
    expect(server.rows.get('journal:j1').deleted).toBe(true);
    expect(readFileSync(join(B.dir, 'journal.jsonl'), 'utf8')).not.toContain('private');
  });

  test('a refused refresh token is « session expired », not « wrong code »', async () => {
    const c = createSyncClient({ url: 'https://x', key: 'k', fetchImpl: async () => ({ ok: false, status: 400, text: async () => JSON.stringify({ error_code: 'refresh_token_already_used', msg: 'Invalid Refresh Token: Already Used' }) }) });
    await expect(c.refresh('R')).rejects.toMatchObject({ code: 'session-expired' });
  });

  test('signed out while a run was in flight: the run does not sign back in or save state', async () => {
    let session = { refreshToken: 'R' };
    const dir = mkdtempSync(join(tmpdir(), 'clarity-audit-'));
    const release = server.hold();
    const engine = createSyncEngine({ dataDir: dir, readData: () => ({ tasks: [] }), saveData() {}, client: server, getSession: () => session, setSession: s => { session = s; } });
    const run = engine.run().catch(e => e);
    session = null;
    release();
    expect((await run).code).toBe('cancelled');
    expect(session).toBe(null);
  });
});
