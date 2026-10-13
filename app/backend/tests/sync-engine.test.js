import { describe, test, expect, beforeEach } from '@jest/globals';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createSyncEngine } from '../src/sync/engine.js';

// The server's rules, as the Postgres trigger applies them: newest updated_at
// wins, the server stamps synced_at, one user's rows only.
function fakeServer() {
  const rows = new Map(); let clock = 0;
  return {
    rows,
    refresh: async () => ({ access_token: 'T', refresh_token: 'R2', expires_at: Math.floor(Date.now() / 1000) + 3600 }),
    pull: async (tok, since) => [...rows.values()].filter(r => !since || r.synced_at > since).sort((a, b) => a.synced_at.localeCompare(b.synced_at)).map(r => ({ ...r })),
    push: async (tok, list) => {
      for (const r of list) {
        const k = `${r.kind}:${r.id}`; const cur = rows.get(k);
        if (cur && Date.parse(r.updated_at) < Date.parse(cur.updated_at)) continue;
        rows.set(k, { ...r, synced_at: new Date(Date.UTC(2026, 9, 13) + (++clock) * 1000).toISOString() });
      }
    },
  };
}

function device(server) {
  const dir = mkdtempSync(join(tmpdir(), 'clarity-sync-'));
  const file = join(dir, 'tasks.json');
  writeFileSync(file, JSON.stringify({ tasks: [], analysis: null }));
  let session = { refreshToken: 'R' };
  const readData = () => JSON.parse(readFileSync(file, 'utf8'));
  const saveData = d => writeFileSync(file, JSON.stringify(d));
  const engine = createSyncEngine({ dataDir: dir, readData, saveData, client: server, getSession: () => session, setSession: s => { session = s; }, log: { error() {} } });
  return {
    dir, engine, readData, saveData,
    titles: () => readData().tasks.map(t => t.title).sort(),
    add: (id, title, at) => { const d = readData(); d.tasks.push({ id, title, updatedAt: at, createdAt: at }); saveData(d); },
    edit: (id, title, at) => { const d = readData(); const t = d.tasks.find(x => x.id === id); t.title = title; t.updatedAt = at; saveData(d); },
    del: id => { const d = readData(); d.tasks = d.tasks.filter(x => x.id !== id); saveData(d); },
  };
}
const at = h => `2026-10-13T${String(h).padStart(2, '0')}:00:00.000Z`;

describe('two devices, one account', () => {
  let server, A, B;
  beforeEach(() => { server = fakeServer(); A = device(server); B = device(server); });

  test('tasks made on each device end up on both', async () => {
    A.add('a', 'from A', at(9)); B.add('b', 'from B', at(9));
    await A.engine.run(); await B.engine.run(); await A.engine.run();
    expect(A.titles()).toEqual(['from A', 'from B']);
    expect(B.titles()).toEqual(['from A', 'from B']);
  });

  test('an edit travels; the newer of two edits wins on both', async () => {
    A.add('x', 'v1', at(8)); await A.engine.run(); await B.engine.run();
    A.edit('x', 'A edit', at(10)); B.edit('x', 'B edit', at(11));
    await A.engine.run(); await B.engine.run(); await A.engine.run();
    expect(A.titles()).toEqual(['B edit']); expect(B.titles()).toEqual(['B edit']);
  });

  test('a deletion travels', async () => {
    A.add('x', 'doomed', at(8)); await A.engine.run(); await B.engine.run();
    B.del('x'); await B.engine.run(); await A.engine.run();
    expect(A.titles()).toEqual([]);
    expect(server.rows.get('task:x').deleted).toBe(true);
  });

  test('a quiet second run sends and applies nothing — no ping-pong', async () => {
    A.add('x', 'x', at(8)); writeFileSync(join(A.dir, 'profile.json'), JSON.stringify({ understanding: { traits: [] }, preferences: {}, proposals: [], updatedAt: at(8) }));
    await A.engine.run(); await B.engine.run();
    // a recompute on B rewrites the profile's timestamp, content unchanged
    const p = JSON.parse(readFileSync(join(B.dir, 'profile.json'), 'utf8')); p.updatedAt = at(15); p.observed = { recomputed: true };
    writeFileSync(join(B.dir, 'profile.json'), JSON.stringify(p));
    expect(await B.engine.run()).toEqual({ pulled: 0, pushed: 0 });
    expect(await A.engine.run()).toEqual({ pulled: 0, pushed: 0 });
    expect(JSON.parse(readFileSync(join(B.dir, 'profile.json'), 'utf8')).observed).toEqual({ recomputed: true });
  });

  test('threads and journal travel; journal entries are never duplicated', async () => {
    writeFileSync(join(A.dir, 'threads.json'), JSON.stringify({ version: 1, threads: { x: { taskId: 'x', state: 'open', updatedAt: at(9) } } }));
    writeFileSync(join(A.dir, 'journal.jsonl'), JSON.stringify({ id: 'j1', at: at(9), kind: 'exchange' }) + '\n');
    await A.engine.run(); await B.engine.run(); await B.engine.run(); await A.engine.run();
    expect(JSON.parse(readFileSync(join(B.dir, 'threads.json'), 'utf8')).threads.x.state).toBe('open');
    const lines = readFileSync(join(B.dir, 'journal.jsonl'), 'utf8').trim().split('\n');
    expect(lines.length).toBe(1);
  });

  test('signed out: the run refuses and writes nothing', async () => {
    const C = device(server);
    const engine = createSyncEngine({ dataDir: C.dir, readData: C.readData, saveData: C.saveData, client: server, getSession: () => null, setSession() {} });
    await expect(engine.run()).rejects.toMatchObject({ code: 'signed-out' });
    expect(existsSync(join(C.dir, 'sync.json'))).toBe(false);
    expect(engine.status().ok).toBe(false);
  });

  test('settings never leave the device', async () => {
    writeFileSync(join(A.dir, 'settings.json'), JSON.stringify({ apiKey: 'sk-secret' }));
    A.add('x', 'x', at(8)); await A.engine.run();
    expect(JSON.stringify([...server.rows.values()])).not.toContain('sk-secret');
  });
});
