import { describe, test, expect } from '@jest/globals';
import { createConnector, findByRef, taskView, taskDetail, listView, overviewView } from '../src/connector/connector.js';
import { handle, TOOLS } from '../src/connector/mcp-server.mjs';
import { manifest, zip, buildBundle } from '../src/connector/bundle.js';

const task = (id, over = {}) => ({
  id, title: `Tâche ${id}`, status: 'not_started', deadline: null, tags: [], subtasks: [],
  description: 'd'.repeat(500), notes: 'privé', history: [{ type: 'created' }], archived: false, ...over,
});

function settingsStore(initial = {}) {
  let s = { ...initial };
  return { readSettings: () => s, saveSettings: async (n) => { s = n; }, get: () => s };
}
const reqWith = (auth) => ({ get: (h) => (h.toLowerCase() === 'authorization' ? auth : undefined) });
const runGuard = (c, auth) => {
  let passed = false, code = null;
  c.guard()(reqWith(auth), { status(x) { code = x; return this; }, json() { return this; } }, () => { passed = true; });
  return { passed, code };
};

describe('the connector token', () => {
  test('off by default: nothing gets through', () => {
    const c = createConnector(settingsStore());
    expect(c.status().enabled).toBe(false);
    expect(runGuard(c, 'Bearer anything').code).toBe(403);
  });

  test('issued once, stored only as a hash, and replaced by the next one', async () => {
    const st = settingsStore();
    const c = createConnector(st);
    const first = await c.issue();
    expect(JSON.stringify(st.get())).not.toContain(first);
    expect(runGuard(c, `Bearer ${first}`).passed).toBe(true);
    const second = await c.issue();
    expect(runGuard(c, `Bearer ${first}`).code).toBe(403);
    expect(runGuard(c, `Bearer ${second}`).passed).toBe(true);
  });

  test('turned off: the token stops working and the activity is forgotten', async () => {
    const c = createConnector(settingsStore());
    const token = await c.issue();
    c.record('overview');
    await c.disable();
    expect(runGuard(c, `Bearer ${token}`).code).toBe(403);
    expect(c.status()).toMatchObject({ enabled: false, activity: [] });
  });
});

describe('what an assistant sees', () => {
  test('never notes, history or the full id; descriptions cut at 300', () => {
    const v = taskView(task('a1b2c3d4-0000'));
    expect(v).not.toHaveProperty('notes');
    expect(v).not.toHaveProperty('history');
    expect(v).not.toHaveProperty('id');
    expect(v.ref).toBe('a1b2c3d4');
    expect(v.description).toHaveLength(300);
  });

  test('a ref resolves only when it is unambiguous', () => {
    const tasks = [task('abcd1111-x'), task('abcd2222-x')];
    expect(findByRef(tasks, 'abcd1111').id).toBe('abcd1111-x');
    expect(findByRef(tasks, 'abcd')).toBeNull();
    expect(findByRef(tasks, 'ab')).toBeNull();
  });

  test('the detail shows the blocker and ways forward, not the check-in answers', () => {
    const d = taskDetail(task('a1'), null, {
      blocker: { text: 'pas le temps' }, options: [{ text: 'Commencer par 10 min', status: 'open', id: 'x' }],
      checkIns: [{ answer: 'réponse privée' }],
    });
    expect(d.stuckOn).toBe('pas le temps');
    expect(d.waysForward).toEqual([{ text: 'Commencer par 10 min', status: 'open' }]);
    expect(JSON.stringify(d)).not.toContain('réponse privée');
  });

  test('lists leave out archived and done tasks unless asked; the overview follows the analysis order', () => {
    const tasks = [task('a1'), task('b2', { status: 'done' }), task('c3', { archived: true }), task('d4', { status: 'in_progress' })];
    expect(listView(tasks, null).map(t => t.ref)).toEqual(['a1', 'd4']);
    expect(listView(tasks, null, { status: 'done' }).map(t => t.ref)).toEqual(['b2']);
    const o = overviewView(tasks, { whatToDoNext: 'D4 d’abord', taskAnalysis: [{ id: 'd4', priority: 1 }, { id: 'a1', priority: 2 }] });
    expect(o.topTasks.map(t => t.ref)).toEqual(['d4', 'a1']);
    expect(o.whatToDoNext).toBe('D4 d’abord');
  });
});

describe('the MCP server', () => {
  test('negotiates the protocol and lists its tools', async () => {
    const init = await handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } });
    expect(init.result.protocolVersion).toBe('2025-03-26');
    expect(init.result.serverInfo.name).toBe('clarity');
    const odd = await handle({ jsonrpc: '2.0', id: 2, method: 'initialize', params: { protocolVersion: '1999-01-01' } });
    expect(odd.result.protocolVersion).toBe('2025-06-18');
    const list = await handle({ jsonrpc: '2.0', id: 3, method: 'tools/list' });
    expect(list.result.tools.map(t => t.name)).toEqual(TOOLS.map(t => t.name));
    expect(list.result.tools.every(t => t.inputSchema && !('run' in t))).toBe(true);
  });

  test('notifications get no answer; unknown methods and tools get an error', async () => {
    expect(await handle({ jsonrpc: '2.0', method: 'notifications/initialized' })).toBeNull();
    expect((await handle({ jsonrpc: '2.0', id: 4, method: 'nope' })).error.code).toBe(-32601);
    expect((await handle({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'nope' } })).error.code).toBe(-32602);
  });
});

describe('the Claude Desktop extension', () => {
  test('its manifest carries the token and the server, and nothing points elsewhere than this machine', () => {
    const m = manifest({ token: 't'.repeat(48), appPath: 'C:\\Clarity.exe', version: '1.2.0', platform: 'win32' });
    expect(m.server.mcp_config.env).toEqual({ CLARITY_CONNECTOR_TOKEN: 't'.repeat(48), CLARITY_URL: 'http://127.0.0.1:3001', CLARITY_APP: 'C:\\Clarity.exe' });
    expect(m.server.mcp_config.args).toEqual(['${__dirname}/server/index.mjs']);
    expect(m.tools).toHaveLength(TOOLS.length);
  });

  test('the zip holds exactly the manifest and the server', () => {
    const buf = buildBundle({ token: 'x', appPath: null, version: '1.2.0' });
    expect(buf.readUInt32LE(0)).toBe(0x04034b50);
    expect(buf.subarray(buf.length - 22).readUInt16LE(10)).toBe(2);
    expect(buf.includes(Buffer.from('manifest.json'))).toBe(true);
    expect(buf.includes(Buffer.from('server/index.mjs'))).toBe(true);
    expect(zip([]).length).toBe(22);
  });
});
