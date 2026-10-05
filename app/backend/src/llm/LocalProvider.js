import { existsSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import { createRequire } from 'module';
import { pathToFileURL, fileURLToPath } from 'url';
import { fork } from 'child_process';
import { LLMProvider } from './LLMProvider.js';

// The assistant built into Clarity: a GGUF model run in this process by
// node-llama-cpp, so someone without Ollama still gets the AI. Nothing leaves
// the machine — it counts as local for every privacy decision.
//
// Measured on a 4-core CPU without a GPU (BACKLOG, 5 October): Gemma 4 E2B
// answers a French chat in 4 s, E4B in 7 s; linking six tasks takes 38 s and
// 58 s. Slow enough that the engine must stay loaded between requests, which
// is why it lives at module level and not in the provider object — server.js
// builds a fresh provider for every request.

// Same reasoning as Ollama's NUM_CTX: one size, large enough for the biggest
// prompt Clarity composes. Changing it means reloading the model.
export const CONTEXT_SIZE = 8192;
// A chat, a suggestion and an analysis can overlap; a fourth waits its turn.
export const SEQUENCES = 3;
export const DEFAULT_KEEP_ALIVE = '30m';

/** '30m' → ms. Ollama's duration format, so one setting serves both engines. */
export function keepAliveMs(value) {
  const m = /^(\d+)\s*(ms|s|m|h)?$/.exec(String(value ?? '').trim());
  if (!m) return keepAliveMs(DEFAULT_KEEP_ALIVE);
  const n = Number(m[1]);
  return n * { ms: 1, s: 1000, m: 60000, h: 3600000 }[m[2] || 's'];
}

/** Where downloaded models live: next to the data folder, never inside it —
 *  the data folder is what backups copy, and a 3 GB model has no place there. */
export function listLocalModels(modelsDir) {
  if (!modelsDir || !existsSync(modelsDir)) return [];
  return readdirSync(modelsDir).filter(f => f.endsWith('.gguf')).sort();
}

// ─── The engine ──────────────────────────────────────────────────────────────
// One per model file, shared by every request. Loading takes 5 to 8 seconds
// and holds 3 to 5 GB of RAM, so it happens once and is released after an
// idle period, as Ollama's keep_alive does.

const engines = new Map();   // modelPath → { ready: Promise<engine>, timer }

async function loadNodeLlamaCpp() {
  const lib = await import('node-llama-cpp');
  // The compact grammar (no newlines, no indentation) is what made the
  // analysis fit: 621 tokens instead of 1 020 on six tasks, which is the
  // difference between an answer and a truncated one on the small model.
  // node-llama-cpp does not export the function that builds it, so it is
  // reached by file. The version is pinned exactly; a test fails if it moves.
  let compactGrammar = null;
  try {
    const url = new URL('./utils/gbnfJson/getGbnfGrammarForGbnfJsonSchema.js', pathToFileURL(createRequire(import.meta.url).resolve('node-llama-cpp')));
    const { getGbnfGrammarForGbnfJsonSchema } = await import(url.href);
    compactGrammar = (schema) => getGbnfGrammarForGbnfJsonSchema(schema, { allowNewLines: false, scopePadSpaces: 0 });
  } catch { /* falls back to the library's own JSON-schema grammar */ }
  return { lib, compactGrammar };
}

export function isSoftwareGpu(name) {
  return /llvmpipe|lavapipe|swiftshader|basic render|microsoft basic|software|dozen/i.test(String(name));
}

/** The engine itself. Runs inside engineWorker.js, never in the backend. */
export async function loadLlamaEngine(modelPath) {
  const { lib, compactGrammar } = await loadNodeLlamaCpp();
  const { getLlama, LlamaChatSession, LlamaGrammar, Gemma4ChatWrapper, LlamaLogLevel } = lib;
  // Never compile, never download: the installed app carries its binaries,
  // and a missing one must be an error, not a ten-minute build on someone's laptop.
  const base = { build: 'never', skipDownload: true, progressLogs: false, logLevel: LlamaLogLevel.error };
  let llama = await getLlama(base);
  // A Vulkan "GPU" that is really the CPU drawing in software (Windows' basic
  // driver, llvmpipe, SwiftShader) is far slower than the CPU itself: on the
  // Windows CI runner, which has no graphics card, a reply came at 9 tokens in
  // five minutes. Such a device is refused and the CPU build used instead.
  let devices = [];
  if (llama.gpu) {
    devices = await llama.getGpuDeviceNames().catch(() => []);
    if (!devices.length || devices.every(isSoftwareGpu)) {
      await llama.dispose().catch(() => {});
      llama = await getLlama({ ...base, gpu: false });
    }
  }
  const model = await llama.loadModel({ modelPath });
  // CLARITY_LLAMA_THREADS: an escape hatch to pin the thread count, for
  // diagnosing a machine where the default does badly.
  const threads = Number(process.env.CLARITY_LLAMA_THREADS) || undefined;
  const context = await model.createContext({ contextSize: CONTEXT_SIZE, sequences: SEQUENCES, ...(threads ? { threads } : {}) });
  const jsonGrammar = await llama.getGrammarFor('json');
  // Gemma 4 thinks out loud by default: with reasoning on, a short chat reply
  // came back empty because the whole budget went to thoughts nobody sees.
  const isGemma4 = /gemma-?4/i.test(basename(modelPath));

  const grammarFor = async (schema) => {
    if (!schema) return jsonGrammar;
    if (compactGrammar) return new LlamaGrammar(llama, { grammar: compactGrammar(schema) });
    return llama.createGrammarForJsonSchema(schema);
  };

  return {
    gpu: llama.gpu ? `${llama.gpu} (${devices.join(', ')})` : 'cpu',
    /** Run one exchange. history: [{role, content}], prompt: the last user turn. */
    async run({ system, history = [], prompt, grammar, schema, temperature, maxTokens, signal, onText }) {
      const sequence = context.getSequence();
      const session = new LlamaChatSession({
        contextSequence: sequence,
        ...(isGemma4 ? { chatWrapper: new Gemma4ChatWrapper({ reasoning: false }) } : {}),
      });
      try {
        const items = [];
        if (system) items.push({ type: 'system', text: system });
        for (const m of history) {
          if (m.role === 'user') items.push({ type: 'user', text: m.content });
          else if (m.role === 'assistant') items.push({ type: 'model', response: [m.content] });
        }
        if (items.length) session.setChatHistory(items);
        return await session.prompt(prompt, {
          temperature, maxTokens, signal, stopOnAbortSignal: false,
          grammar: grammar ? await grammarFor(schema) : undefined,
          onTextChunk: onText,
        });
      } finally {
        session.dispose({ disposeSequence: true });
      }
    },
    async dispose() { await context.dispose(); await model.dispose(); },
  };
}

// ─── The engine, in its own process ──────────────────────────────────────────
// What the backend actually uses: the same run()/dispose() as loadLlamaEngine,
// carried over IPC to engineWorker.js. Why a separate process is explained
// there — in one line, a native crash must not take the task store with it.

const WORKER = fileURLToPath(new URL('./engineWorker.js', import.meta.url));
export const ENGINE_STOPPED = 'The built-in assistant stopped unexpectedly — try again.';
export const ENGINE_LOAD_TIMEOUT = 'The built-in assistant took too long to start — try again.';
// The largest model loads in 8 s from an SSD (measured). Three minutes covers a
// slow disk; past that, something is stuck, and a request must not wait forever
// on it — without a limit, a load that hangs held its request indefinitely.
export const LOAD_TIMEOUT_MS = 180000;

export function loadProcessEngine(modelPath, { onExit = () => {}, workerPath = WORKER, loadTimeoutMs = LOAD_TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    // fork() reuses process.execPath — Electron's binary in the installed app,
    // which ELECTRON_RUN_AS_NODE (inherited) turns into Node, as for the backend.
    const child = fork(workerPath, [], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
    const pending = new Map();   // id → { resolve, reject, onText }
    let nextId = 1, ready = false, exited = false;
    const loadTimer = setTimeout(() => { reject(new Error(ENGINE_LOAD_TIMEOUT)); child.kill(); }, loadTimeoutMs);

    child.on('message', (msg) => {
      if (msg.type === 'ready') {
        ready = true;
        clearTimeout(loadTimer);
        resolve(engine(msg.gpu));
      } else if (msg.type === 'failed') {
        clearTimeout(loadTimer);
        child.kill();
        reject(new Error(msg.message));
      } else {
        const p = pending.get(msg.id);
        if (!p) return;
        if (msg.type === 'text') p.onText?.(msg.text);
        else if (msg.type === 'done') { pending.delete(msg.id); p.resolve(msg.text); }
        else if (msg.type === 'error') { pending.delete(msg.id); p.reject(new Error(msg.message)); }
      }
    });
    child.on('exit', () => {
      exited = true;
      clearTimeout(loadTimer);
      for (const p of pending.values()) p.reject(new Error(ENGINE_STOPPED));
      pending.clear();
      if (!ready) reject(new Error(ENGINE_STOPPED));
      onExit();
    });
    child.on('error', () => {});
    child.send({ type: 'load', modelPath });

    const engine = (gpu) => ({
      gpu,
      run({ signal, onText, ...req }) {
        if (exited) return Promise.reject(new Error(ENGINE_STOPPED));
        const id = nextId++;
        return new Promise((res, rej) => {
          pending.set(id, { resolve: res, reject: rej, onText });
          signal?.addEventListener('abort', () => {
            if (!exited) child.send({ type: 'abort', id });
          }, { once: true });
          child.send({ type: 'run', id, req });
        });
      },
      async dispose() {
        if (exited) return;
        child.send({ type: 'dispose' });
        // A worker stuck in native code gets five seconds, then is ended.
        const timer = setTimeout(() => child.kill(), 5000);
        await new Promise(r => child.once('exit', r));
        clearTimeout(timer);
      },
    });
  });
}

// The context has SEQUENCES slots; asking for one more throws "No sequences
// left". Requests beyond that wait here instead of failing.
function slots(n) {
  let free = n; const waiting = [];
  return {
    async take() { if (free > 0) { free--; return; } await new Promise(r => waiting.push(r)); },
    give() { const next = waiting.shift(); if (next) next(); else free++; },
  };
}

function acquire(modelPath, loadEngine) {
  let entry = engines.get(modelPath);
  if (!entry) {
    entry = { ready: null, timer: null, slots: slots(SEQUENCES), busy: 0 };
    // A worker that dies is forgotten, so the next request starts a new one.
    const forget = () => { if (engines.get(modelPath) === entry) { clearTimeout(entry.timer); engines.delete(modelPath); } };
    entry.ready = loadEngine(modelPath, { onExit: forget }).catch(err => { forget(); throw err; });
    engines.set(modelPath, entry);
  }
  clearTimeout(entry.timer);
  return entry;
}

function release(modelPath, entry, idleMs) {
  if (entry.busy > 0 || engines.get(modelPath) !== entry) return;
  clearTimeout(entry.timer);
  entry.timer = setTimeout(() => {
    if (entry.busy > 0) return;
    engines.delete(modelPath);
    entry.ready.then(e => e.dispose()).catch(() => {});
  }, idleMs);
  entry.timer.unref?.();
}

/** Release every loaded model. For tests and for a model change. */
export async function unloadAll() {
  const all = [...engines.values()];
  engines.clear();
  for (const e of all) {
    clearTimeout(e.timer);
    await e.ready.then(x => x.dispose()).catch(() => {});
  }
}

// ─── The provider ────────────────────────────────────────────────────────────

export class LocalProvider extends LLMProvider {
  constructor(config = {}) {
    super();
    this.modelsDir = config.modelsDir || '';
    this.model     = config.localModel || listLocalModels(this.modelsDir).at(-1) || '';
    this.idleMs    = keepAliveMs(config.keepAlive ?? DEFAULT_KEEP_ALIVE);
    this.loadEngine = config.loadEngine || loadProcessEngine;
  }

  get modelPath() {
    // A file name, never a path: a setting cannot point the engine outside the folder.
    return this.model ? join(this.modelsDir, basename(this.model)) : '';
  }

  async _with(fn) {
    const path = this.modelPath;
    if (!path || !existsSync(path)) {
      throw new Error('The built-in assistant has no model yet — download one in Settings.');
    }
    const entry = acquire(path, this.loadEngine);
    entry.busy++;
    try {
      const engine = await entry.ready;
      await entry.slots.take();
      try { return await fn(engine); }
      finally { entry.slots.give(); }
    } finally {
      entry.busy--;
      release(path, entry, this.idleMs);
    }
  }

  // The engine reports text through a callback; the rest of Clarity reads a
  // stream. A small queue turns one into the other.
  async *_stream(request, options) {
    const queue = []; let wake = null; let done = false; let failure = null;
    const push = (t) => { queue.push(t); wake?.(); };
    // A reader that stops early (the person closed the chat) stops the engine
    // too, instead of leaving it to write an answer nobody will read.
    const stop = new AbortController();
    const signal = AbortSignal.any([stop.signal, AbortSignal.timeout(options.timeout ?? 300000)]);
    this._with(engine => engine.run({ ...request, signal, onText: push,
      temperature: options.temperature ?? 0.7, maxTokens: options.maxTokens ?? 1024 }))
      .catch(err => { failure = err; })
      .finally(() => { done = true; wake?.(); });
    try {
      while (true) {
        if (queue.length) { yield queue.shift(); continue; }
        if (done) break;
        await new Promise(r => { wake = r; });
        wake = null;
      }
    } finally {
      if (!done) stop.abort();
    }
    if (failure) throw failure;
  }

  async *generate(prompt, options = {}) {
    yield* this._stream({ prompt }, options);
  }

  async *generateChat(systemPrompt, messages, options = {}) {
    const history = messages.slice(0, -1);
    const last = messages.at(-1);
    yield* this._stream({ system: systemPrompt, history, prompt: last?.content ?? '' }, options);
  }

  /** options.schema, when given, constrains the reply to it — the model cannot
   *  write an id that is not in the list, or skip a task. */
  async generateJSON(prompt, options = {}) {
    const text = await this._with(engine => engine.run({
      prompt, grammar: true, schema: options.schema,
      temperature: options.temperature ?? 0.2,
      maxTokens: options.maxTokens ?? 1024,
      signal: AbortSignal.timeout(options.timeout ?? 300000),
    }));
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`The built-in assistant returned non-JSON: ${String(text).slice(0, 120)}`);
    }
  }

  /** Load the model now, so the first question does not pay for it. */
  async warm() {
    const started = Date.now();
    try {
      const gpu = await this._with(engine => engine.gpu);
      return { ok: true, ms: Date.now() - started, gpu };
    } catch (err) {
      return { ok: false, ms: Date.now() - started, error: err.message };
    }
  }

  /** Reachable means a model is on disk. Loading it is too costly for a status check. */
  async ping() {
    return !!this.modelPath && existsSync(this.modelPath);
  }

  async listModels() {
    return listLocalModels(this.modelsDir);
  }
}
