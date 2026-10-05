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
    // Written for how people actually ask. "What do I start with" did not
    // reach this tool when its description only said "start here": the model
    // answered from its chat memory instead (5 October, Claude Desktop).
    description: 'The person’s to-do list and priorities, from Clarity, their task manager on this computer. '
      + 'Use it whenever they ask what to do, what to start with, what is next, what is on their plate, about their day, '
      + 'their tasks, deadlines or priorities, or say they are overwhelmed or stuck — in any language, even if they do not '
      + 'mention Clarity. Returns what Clarity suggests doing next, active and overdue counts, and the top tasks in priority order.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    run: () => call('GET', '/overview'),
  },
  {
    name: 'clarity_list_tasks',
    description: 'All of the person’s tasks in Clarity (active ones by default), e.g. “show my tasks”, “what is due this week”. Each has a ref to use with the other tools.',
    inputSchema: { type: 'object', properties: { status: { type: 'string', enum: ['not_started', 'in_progress', 'done', 'archived'], description: 'Only tasks with this status. "done" lists finished ones, "archived" the archived ones.' } } },
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
    description: 'Add a task to the person’s Clarity task list — whenever they say they need to, must, should or want to do something, or ask to be reminded. Use their own words for the title.',
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
    description: 'Mark a Clarity task done, in progress or not started — e.g. when the person says they finished or started something.',
    inputSchema: { type: 'object', properties: { ref: REF, status: STATUS }, required: ['ref', 'status'] },
    run: (a) => call('POST', `/tasks/${encodeURIComponent(a.ref)}/status`, { status: a.status }),
  },
  {
    name: 'clarity_add_way_forward',
    description: 'Add a concrete next step to a task the person is stuck on. It appears in Clarity as a suggestion they can accept or rule out.',
    inputSchema: { type: 'object', properties: { ref: REF, text: { type: 'string', description: 'One short, concrete step.' } }, required: ['ref', 'text'] },
    run: (a) => call('POST', `/tasks/${encodeURIComponent(a.ref)}/ways-forward`, { text: a.text }),
  },
  {
    name: 'clarity_update_task',
    description: 'Change a Clarity task: rename it, rewrite its description, move or remove its deadline, change its tags. Give only what changes.',
    inputSchema: {
      type: 'object',
      properties: {
        ref: REF,
        title: { type: 'string' },
        description: { type: 'string' },
        deadline: { type: ['string', 'null'], description: 'YYYY-MM-DD, or null to remove the deadline' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Replaces the current tags' },
      },
      required: ['ref'],
    },
    run: ({ ref, ...change }) => call('POST', `/tasks/${encodeURIComponent(ref)}/update`, change),
  },
  {
    name: 'clarity_add_subtask',
    description: 'Add a step (subtask) to a Clarity task — e.g. when breaking a task down with the person.',
    inputSchema: { type: 'object', properties: { ref: REF, title: { type: 'string' } }, required: ['ref', 'title'] },
    run: (a) => call('POST', `/tasks/${encodeURIComponent(a.ref)}/subtasks`, { title: a.title }),
  },
  {
    name: 'clarity_check_subtask',
    description: 'Tick a subtask as done (or untick it with done: false). Point at it by its number from clarity_get_task, or by its words.',
    inputSchema: {
      type: 'object',
      properties: { ref: REF, subtask: { type: ['integer', 'string'], description: 'Number (1 = first) or the subtask’s words' }, done: { type: 'boolean', default: true } },
      required: ['ref', 'subtask'],
    },
    run: (a) => call('POST', `/tasks/${encodeURIComponent(a.ref)}/subtasks/check`, { subtask: a.subtask, done: a.done !== false }),
  },
  {
    name: 'clarity_archive_task',
    description: 'Archive a Clarity task: it leaves the lists but is kept, and can be brought back. Prefer this to deleting.',
    inputSchema: { type: 'object', properties: { ref: REF }, required: ['ref'] },
    run: (a) => call('POST', `/tasks/${encodeURIComponent(a.ref)}/archive`),
  },
  {
    name: 'clarity_restore_task',
    description: 'Bring an archived Clarity task back into the lists. clarity_list_tasks with status "archived" gives the refs.',
    inputSchema: { type: 'object', properties: { ref: REF }, required: ['ref'] },
    run: (a) => call('POST', `/tasks/${encodeURIComponent(a.ref)}/restore`),
  },
  {
    name: 'clarity_delete_task',
    description: 'Delete a Clarity task for good — this cannot be undone. Before calling it, say which task you are about to delete and get an explicit yes from the person; then pass confirmed: true. If they only want it out of the way, archive it instead.',
    inputSchema: { type: 'object', properties: { ref: REF, confirmed: { type: 'boolean', description: 'true only after the person explicitly agreed' } }, required: ['ref', 'confirmed'] },
    annotations: { destructiveHint: true },
    run: (a) => call('POST', `/tasks/${encodeURIComponent(a.ref)}/delete`, { confirmed: a.confirmed === true }),
  },
  {
    name: 'clarity_timer',
    description: 'Start or stop the time tracker on a Clarity task — e.g. “I’m starting the report now”, “I’m done for today”.',
    inputSchema: { type: 'object', properties: { ref: REF, action: { type: 'string', enum: ['start', 'stop'] } }, required: ['ref', 'action'] },
    run: (a) => call('POST', `/tasks/${encodeURIComponent(a.ref)}/timer`, { action: a.action }),
  },
];

// ─── MCP over stdio ──────────────────────────────────────────────────────────

const INSTRUCTIONS = 'Clarity is the person’s task manager, running on their computer, and the source of truth for what '
  + 'they have to do. For any question about what to do, start, prioritise or finish — even a vague one like “what do I '
  + 'start with?” — call clarity_overview before answering, rather than relying on earlier conversations. '
  + 'Refer to tasks by title when talking to the person; use refs only in tool calls. Answer in the person’s language.';

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
