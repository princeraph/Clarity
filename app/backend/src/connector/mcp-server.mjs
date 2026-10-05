// Clarity's MCP server: what Claude Desktop (or any MCP client) runs to reach
// the person's tasks. It speaks MCP over stdin/stdout and nothing else — every
// read and write goes through Clarity's own backend, on this machine, under the
// connector token. No dependency: this file is the whole server, so the bundle
// is one file plus a manifest.
//
// If Clarity is closed, it starts it in the background (tray icon, no window)
// and waits for it, so the assistant can be used without opening the app first.
//
// Environment: CLARITY_CONNECTOR_TOKEN (required), CLARITY_URL (default
// http://127.0.0.1:3001), CLARITY_APP (path to Clarity.exe — for the wake-up).

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { createInterface } from 'readline';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const URL_BASE = process.env.CLARITY_URL || 'http://127.0.0.1:3001';
const TOKEN = process.env.CLARITY_CONNECTOR_TOKEN || '';
const APP = process.env.CLARITY_APP || '';
const VERSION = '1.0.0';
const PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const WAKE_MS = Number(process.env.CLARITY_WAKE_MS) || 45000;

const log = (...a) => process.stderr.write(`[clarity-mcp] ${a.join(' ')}\n`);

// ─── Talking to Clarity ──────────────────────────────────────────────────────

class ClarityError extends Error {}

async function up() {
  try { return (await fetch(`${URL_BASE}/api/health`, { signal: AbortSignal.timeout(2000) })).ok; }
  catch { return false; }
}

let waking = null;
async function ensureRunning() {
  if (await up()) return;
  if (!APP || !existsSync(APP)) {
    throw new ClarityError('Clarity is not running. Ask the person to open Clarity, then try again.');
  }
  waking ??= (async () => {
    log('Clarity is closed — starting it in the background');
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;   // Clarity.exe must start as the app, not as Node
    const p = spawn(APP, ['--background'], { detached: true, stdio: 'ignore', windowsHide: true, env });
    p.on('error', () => {});
    p.unref();
    const until = Date.now() + WAKE_MS;
    while (Date.now() < until) {
      if (await up()) return;
      await new Promise(r => setTimeout(r, 500));
    }
    throw new ClarityError('Clarity was started but did not answer in time. Ask the person to open it.');
  })().finally(() => { waking = null; });
  await waking;
}

async function call(method, path, body) {
  await ensureRunning();
  const resp = await fetch(`${URL_BASE}/api/connector/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30000),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new ClarityError(data.error || `Clarity answered ${resp.status}`);
  return data;
}

// ─── Tools ───────────────────────────────────────────────────────────────────

const REF = { type: 'string', description: 'The task’s ref, as given by clarity_list_tasks or clarity_overview (8 characters).' };
const STATUS = { type: 'string', enum: ['not_started', 'in_progress', 'done'] };

export const TOOLS = [
  {
    name: 'clarity_overview',
    description: 'Start here. What Clarity suggests doing next, how many tasks are active or overdue, and the top tasks in priority order.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    run: () => call('GET', '/overview'),
  },
  {
    name: 'clarity_list_tasks',
    description: 'List the person’s tasks (active ones by default). Each has a ref to use with the other tools.',
    inputSchema: { type: 'object', properties: { status: { ...STATUS, description: 'Only tasks with this status. "done" lists finished ones.' } } },
    annotations: { readOnlyHint: true },
    run: (a) => call('GET', `/tasks${a.status ? `?status=${encodeURIComponent(a.status)}` : ''}`),
  },
  {
    name: 'clarity_get_task',
    description: 'One task in detail: subtasks, what the person said they are stuck on, and the ways forward already tried or open.',
    inputSchema: { type: 'object', properties: { ref: REF }, required: ['ref'] },
    annotations: { readOnlyHint: true },
    run: (a) => call('GET', `/tasks/${encodeURIComponent(a.ref)}`),
  },
  {
    name: 'clarity_add_task',
    description: 'Add a task to Clarity. Use the person’s own words for the title.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        deadline: { type: 'string', description: 'YYYY-MM-DD' },
        tags: { type: 'array', items: { type: 'string' } },
      },
      required: ['title'],
    },
    run: (a) => call('POST', '/tasks', a),
  },
  {
    name: 'clarity_set_status',
    description: 'Mark a task not started, in progress or done.',
    inputSchema: { type: 'object', properties: { ref: REF, status: STATUS }, required: ['ref', 'status'] },
    run: (a) => call('POST', `/tasks/${encodeURIComponent(a.ref)}/status`, { status: a.status }),
  },
  {
    name: 'clarity_add_way_forward',
    description: 'Add a concrete next step to a task the person is stuck on. It appears in Clarity as a suggestion they can accept or rule out.',
    inputSchema: { type: 'object', properties: { ref: REF, text: { type: 'string', description: 'One short, concrete step.' } }, required: ['ref', 'text'] },
    run: (a) => call('POST', `/tasks/${encodeURIComponent(a.ref)}/ways-forward`, { text: a.text }),
  },
];

// ─── MCP over stdio ──────────────────────────────────────────────────────────

const INSTRUCTIONS = 'Clarity is the person’s task manager, running on their computer. Call clarity_overview first. '
  + 'Refer to tasks by title when talking to the person; use refs only in tool calls.';

export async function handle(msg) {
  const { id, method, params } = msg;
  if (id === undefined || id === null) return null;   // a notification: nothing to answer
  const ok = (result) => ({ jsonrpc: '2.0', id, result });
  const fail = (code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });

  switch (method) {
    case 'initialize': {
      const asked = params?.protocolVersion;
      return ok({
        protocolVersion: PROTOCOLS.includes(asked) ? asked : PROTOCOLS[0],
        capabilities: { tools: {} },
        serverInfo: { name: 'clarity', version: VERSION },
        instructions: INSTRUCTIONS,
      });
    }
    case 'ping':
      return ok({});
    case 'tools/list':
      return ok({ tools: TOOLS.map(({ run, ...t }) => t) });
    case 'tools/call': {
      const tool = TOOLS.find(t => t.name === params?.name);
      if (!tool) return fail(-32602, `Unknown tool: ${params?.name}`);
      try {
        const result = await tool.run(params.arguments || {});
        return ok({ content: [{ type: 'text', text: JSON.stringify(result, null, 1) }] });
      } catch (err) {
        // A tool error is reported to the model, which can explain it to the person.
        return ok({ content: [{ type: 'text', text: err instanceof ClarityError ? err.message : `Clarity could not be reached: ${err.message}` }], isError: true });
      }
    }
    default:
      return fail(-32601, `Method not found: ${method}`);
  }
}

function serve() {
  if (!TOKEN) log('no CLARITY_CONNECTOR_TOKEN — every call will be refused; reconnect from Clarity’s Settings');
  const rl = createInterface({ input: process.stdin });
  rl.on('line', async (line) => {
    if (!line.trim()) return;
    let msg;
    try { msg = JSON.parse(line); }
    catch { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }) + '\n'); return; }
    const reply = await handle(msg);
    if (reply) process.stdout.write(JSON.stringify(reply) + '\n');
  });
  rl.on('close', () => process.exit(0));
}

// Run as a program (by the MCP client), not when imported by the tests.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) serve();
