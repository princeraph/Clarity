// The AI connector end to end, the way Claude Desktop uses it: get the
// extension from Clarity, unpack it, start its server with the manifest's
// environment, and talk MCP to it over stdio.
//
// Usage: node tools/essai-connecteur.mjs [--node <runtime>] [--wake] [--expect-app]
//   --node  the program that runs the server (default: this Node). The CI
//           passes Clarity.exe, with ELECTRON_RUN_AS_NODE, as a stand-in.
//   --wake  Clarity has just been closed: the first call must start it.
//   --expect-app  the extension must carry Clarity.exe's path (installed app).
// Clarity's backend must be running on 127.0.0.1:3001, unless --wake.

import { spawn } from 'child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { createInterface } from 'readline';

const API = 'http://127.0.0.1:3001/api';
const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const runtime = arg('--node') || process.execPath;
const wake = process.argv.includes('--wake');
const fail = (msg) => { console.error(`ÉCHEC : ${msg}`); process.exit(1); };
const say = (msg) => console.log(msg);

// A stored zip, as bundle.js writes it — read back by hand.
function unzip(buf) {
  const files = {};
  let i = 0;
  while (buf.readUInt32LE(i) === 0x04034b50) {
    const method = buf.readUInt16LE(i + 8), size = buf.readUInt32LE(i + 18);
    const nameLen = buf.readUInt16LE(i + 26), extra = buf.readUInt16LE(i + 28);
    if (method !== 0) fail('compressed entry in the bundle');
    const name = buf.subarray(i + 30, i + 30 + nameLen).toString('utf8');
    files[name] = buf.subarray(i + 30 + nameLen + extra, i + 30 + nameLen + extra + size);
    i += 30 + nameLen + extra + size;
  }
  return files;
}

async function getBundle(path) {
  const r = await fetch(`${API}/connector/bundle`, { method: 'POST' });
  if (!r.ok) fail(`bundle: HTTP ${r.status}`);
  const files = unzip(Buffer.from(await r.arrayBuffer()));
  const dir = mkdtempSync(join(tmpdir(), 'clarity-mcpb-'));
  for (const [name, data] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), data);
  }
  writeFileSync(path, JSON.stringify({ dir, manifest: JSON.parse(files['manifest.json']) }));
  return { dir, manifest: JSON.parse(files['manifest.json']) };
}

function client(dir, manifest) {
  const cfg = manifest.server.mcp_config;
  const args = cfg.args.map(a => a.replace('${__dirname}', dir));
  const p = spawn(runtime, args, { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', ...cfg.env }, stdio: ['pipe', 'pipe', 'inherit'] });
  const waiting = new Map(); let next = 1;
  createInterface({ input: p.stdout }).on('line', (line) => {
    const msg = JSON.parse(line);
    waiting.get(msg.id)?.(msg); waiting.delete(msg.id);
  });
  return {
    request(method, params = {}) {
      const id = next++;
      return new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error(`${method}: no answer in 90 s`)), 90000);
        waiting.set(id, (m) => { clearTimeout(t); resolve(m); });
        p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
      });
    },
    async tool(name, args = {}) {
      const m = await this.request('tools/call', { name, arguments: args });
      if (m.error) fail(`${name}: ${m.error.message}`);
      return { isError: !!m.result.isError, text: m.result.content[0].text };
    },
    close() { p.stdin.end(); },
  };
}

const state = join(tmpdir(), 'clarity-essai-connecteur.json');
let bundle;
if (wake) {
  bundle = JSON.parse((await import('fs')).readFileSync(state, 'utf8'));
} else {
  bundle = await getBundle(state);
  say(`extension reçue : ${Object.keys(bundle.manifest.server.mcp_config.env).join(', ')}`);
  if (!/^[0-9a-f]{48}$/.test(bundle.manifest.server.mcp_config.env.CLARITY_CONNECTOR_TOKEN)) fail('no token in the manifest');
  if (process.argv.includes('--expect-app') && !bundle.manifest.server.mcp_config.env.CLARITY_APP) fail('no CLARITY_APP: the extension could not wake Clarity');
  const st = await (await fetch(`${API}/settings`)).json();
  if (JSON.stringify(st).includes(bundle.manifest.server.mcp_config.env.CLARITY_CONNECTOR_TOKEN)) fail('token readable through /api/settings');
  if ('connectorTokenHash' in st) fail('token hash readable through /api/settings');
}

const c = client(bundle.dir, bundle.manifest);
const init = await c.request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'essai', version: '1' } });
if (init.result?.serverInfo?.name !== 'clarity') fail('initialize');
const tools = (await c.request('tools/list')).result.tools.map(t => t.name);
say(`outils : ${tools.join(', ')}`);

if (wake) {
  const t0 = Date.now();
  const o = await c.tool('clarity_overview');
  if (o.isError) fail(`Clarity was not woken: ${o.text}`);
  say(`réveil : Clarity démarré par le connecteur et a répondu en ${Date.now() - t0} ms`);
  c.close();
  process.exit(0);
}

const added = await c.tool('clarity_add_task', { title: 'Appeler le comptable', deadline: '2026-12-01', tags: ['admin'] });
if (added.isError) fail(added.text);
const ref = JSON.parse(added.text).added.ref;
say(`tâche ajoutée : ${ref}`);
const list = JSON.parse((await c.tool('clarity_list_tasks')).text).tasks;
if (!list.some(t => t.ref === ref)) fail('added task missing from the list');
const leaked = list.some(t => 'notes' in t || 'history' in t || 'id' in t);
if (leaked) fail('the list carries fields that must stay on this machine');
const fwd = await c.tool('clarity_add_way_forward', { ref, text: 'Retrouver son numéro dans les courriels' });
if (fwd.isError) fail(fwd.text);
const done = await c.tool('clarity_set_status', { ref, status: 'done' });
if (done.isError || JSON.parse(done.text).updated.status !== 'done') fail(`status: ${done.text}`);
const detail = JSON.parse((await c.tool('clarity_get_task', { ref })).text);
if (detail.waysForward?.[0]?.text !== 'Retrouver son numéro dans les courriels') fail('way forward not stored');
const ov = JSON.parse((await c.tool('clarity_overview')).text);
say(`aperçu : ${ov.activeTasks} tâche(s) active(s), ${ov.topTasks.length} en tête`);
const unknown = await c.tool('clarity_get_task', { ref: 'zzzzzzzz' });
if (!unknown.isError) fail('unknown ref accepted');

// Turned off in Clarity: the same extension must be refused at once.
await fetch(`${API}/connector/disable`, { method: 'POST' });
const after = await c.tool('clarity_overview');
if (!after.isError || !/off/.test(after.text)) fail(`still answering after being turned off: ${after.text}`);
say('désactivé : l’extension est refusée');

// Turned back on (as the CI's wake-up check needs): a new extension, a new token.
const again = await getBundle(state);
if (again.manifest.server.mcp_config.env.CLARITY_CONNECTOR_TOKEN === bundle.manifest.server.mcp_config.env.CLARITY_CONNECTOR_TOKEN) fail('token reused');
const old = await c.tool('clarity_overview');
if (!old.isError) fail('the replaced extension still works');
say('reconnecté : nouveau jeton, l’ancienne extension est refusée');
c.close();
