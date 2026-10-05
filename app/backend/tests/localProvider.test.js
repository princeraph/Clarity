import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createRequire } from 'module';
import { pathToFileURL, fileURLToPath } from 'url';
import { LocalProvider, keepAliveMs, unloadAll, SEQUENCES, loadProcessEngine, ENGINE_STOPPED } from '../src/llm/LocalProvider.js';
import { createProvider } from '../src/llm/index.js';

// A stand-in for node-llama-cpp: records what it was asked, answers what it is told.
function fakeEngine({ reply = 'Bonjour', chunks = null, delay = 0 } = {}) {
  const state = { loads: 0, disposed: 0, calls: [], running: 0, peak: 0 };
  const loadEngine = async (modelPath) => {
    state.loads++;
    state.modelPath = modelPath;
    return {
      async run(req) {
        state.calls.push(req);
        state.running++; state.peak = Math.max(state.peak, state.running);
        try {
          if (delay) await new Promise(r => setTimeout(r, delay));
          for (const c of chunks || [reply]) {
            if (req.signal?.aborted) throw req.signal.reason;
            req.onText?.(c);
            await new Promise(r => setImmediate(r));
          }
          return chunks ? chunks.join('') : reply;
        } finally { state.running--; }
      },
      async dispose() { state.disposed++; },
    };
  };
  return { state, loadEngine };
}

let dir;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'clarity-models-'));
  writeFileSync(join(dir, 'gemma-4-E2B-it-Q4_0.gguf'), 'x');
});
afterEach(async () => { await unloadAll(); rmSync(dir, { recursive: true, force: true }); });

const collect = async (gen) => { let s = ''; for await (const t of gen) s += t; return s; };

describe('LocalProvider', () => {
  test('is what providerType "local" builds', () => {
    expect(createProvider({ providerType: 'local', modelsDir: dir })).toBeInstanceOf(LocalProvider);
  });

  test('streams the engine’s text, chunk by chunk', async () => {
    const { loadEngine } = fakeEngine({ chunks: ['Commence ', 'par ', 'la plus petite.'] });
    const p = new LocalProvider({ modelsDir: dir, loadEngine });
    const seen = [];
    for await (const t of p.generate('Par quoi je commence ?')) seen.push(t);
    expect(seen).toEqual(['Commence ', 'par ', 'la plus petite.']);
  });

  test('a chat passes the system prompt and earlier turns, and asks the last message', async () => {
    const { state, loadEngine } = fakeEngine();
    const p = new LocalProvider({ modelsDir: dir, loadEngine });
    await collect(p.generateChat('Tu es Clarity.', [
      { role: 'user', content: 'Salut' },
      { role: 'assistant', content: 'Bonjour !' },
      { role: 'user', content: 'Je suis bloqué.' },
    ]));
    const call = state.calls[0];
    expect(call.system).toBe('Tu es Clarity.');
    expect(call.history).toEqual([{ role: 'user', content: 'Salut' }, { role: 'assistant', content: 'Bonjour !' }]);
    expect(call.prompt).toBe('Je suis bloqué.');
  });

  test('generateJSON constrains the reply with the caller’s schema and parses it', async () => {
    const { state, loadEngine } = fakeEngine({ reply: '["Ouvrir le site des impôts"]' });
    const p = new LocalProvider({ modelsDir: dir, loadEngine });
    const schema = { type: 'array', items: { type: 'string' }, maxItems: 4 };
    expect(await p.generateJSON('pistes ?', { schema, maxTokens: 300 })).toEqual(['Ouvrir le site des impôts']);
    expect(state.calls[0]).toMatchObject({ grammar: true, schema, maxTokens: 300 });
  });

  test('non-JSON from the engine is an error, not a silent empty result', async () => {
    const { loadEngine } = fakeEngine({ reply: 'désolé' });
    const p = new LocalProvider({ modelsDir: dir, loadEngine });
    await expect(p.generateJSON('x')).rejects.toThrow(/non-JSON/);
  });

  test('the model is loaded once and shared by every request', async () => {
    const { state, loadEngine } = fakeEngine();
    // server.js builds a new provider for every request — the engine must not follow.
    for (let i = 0; i < 3; i++) await collect(new LocalProvider({ modelsDir: dir, loadEngine }).generate('x'));
    expect(state.loads).toBe(1);
  });

  test('more requests than sequences wait their turn instead of failing', async () => {
    const { state, loadEngine } = fakeEngine({ delay: 20 });
    const p = new LocalProvider({ modelsDir: dir, loadEngine });
    const all = Array.from({ length: SEQUENCES + 2 }, () => collect(p.generate('x')));
    expect(await Promise.all(all)).toHaveLength(SEQUENCES + 2);
    expect(state.peak).toBe(SEQUENCES);
  });

  test('released after the idle period, reloaded on the next request', async () => {
    const { state, loadEngine } = fakeEngine();
    const p = new LocalProvider({ modelsDir: dir, loadEngine, keepAlive: '30ms' });
    await collect(p.generate('x'));
    await new Promise(r => setTimeout(r, 80));
    expect(state.disposed).toBe(1);
    await collect(p.generate('x'));
    expect(state.loads).toBe(2);
  });

  test('a reader that stops early stops the engine', async () => {
    const { state, loadEngine } = fakeEngine({ chunks: ['a', 'b', 'c', 'd', 'e'] });
    const p = new LocalProvider({ modelsDir: dir, loadEngine });
    for await (const t of p.generate('x')) { if (t === 'a') break; }
    await new Promise(r => setTimeout(r, 20));
    expect(state.calls[0].signal.aborted).toBe(true);
  });

  test('without a model on disk: not reachable, and a plain-language error', async () => {
    const empty = mkdtempSync(join(tmpdir(), 'clarity-empty-'));
    const p = new LocalProvider({ modelsDir: empty, loadEngine: fakeEngine().loadEngine });
    expect(await p.ping()).toBe(false);
    await expect(p.generateJSON('x')).rejects.toThrow(/download one in Settings/);
    rmSync(empty, { recursive: true, force: true });
  });

  test('with a model on disk: reachable and listed, without loading it', async () => {
    const { state, loadEngine } = fakeEngine();
    const p = new LocalProvider({ modelsDir: dir, loadEngine });
    expect(await p.ping()).toBe(true);
    expect(await p.listModels()).toEqual(['gemma-4-E2B-it-Q4_0.gguf']);
    expect(state.loads).toBe(0);
  });

  test('a model setting cannot reach outside the models folder', async () => {
    const { state, loadEngine } = fakeEngine();
    const p = new LocalProvider({ modelsDir: dir, loadEngine, localModel: '../../gemma-4-E2B-it-Q4_0.gguf' });
    await collect(p.generate('x'));
    expect(state.modelPath).toBe(join(dir, 'gemma-4-E2B-it-Q4_0.gguf'));
  });

  test('keep-alive reads Ollama’s duration format', () => {
    expect(keepAliveMs('30m')).toBe(1800000);
    expect(keepAliveMs('0')).toBe(0);
    expect(keepAliveMs('2h')).toBe(7200000);
    expect(keepAliveMs('n’importe quoi')).toBe(1800000);
  });
});

describe('the pinned node-llama-cpp', () => {
  // LocalProvider reaches the compact-grammar builder by file, because the
  // package does not export it. If an upgrade moves it, this says so — instead
  // of the analysis silently going back to the long, truncated replies.
  test('still has the compact JSON grammar where LocalProvider looks for it', async () => {
    const url = new URL('./utils/gbnfJson/getGbnfGrammarForGbnfJsonSchema.js', pathToFileURL(createRequire(import.meta.url).resolve('node-llama-cpp')));
    const { getGbnfGrammarForGbnfJsonSchema } = await import(url.href);
    const g = getGbnfGrammarForGbnfJsonSchema({ type: 'array', items: { type: 'string' } },
                                              { allowNewLines: false, scopePadSpaces: 0 });
    expect(typeof g).toBe('string');
    expect(g).toContain('root');
  });
});

describe('the engine in its own process', () => {
  const workerPath = fileURLToPath(new URL('./fixtures/fakeEngineWorker.mjs', import.meta.url));
  const processEngine = (modelPath, opts) => loadProcessEngine(modelPath, { ...opts, workerPath });

  test('answers over IPC, text chunks included', async () => {
    const p = new LocalProvider({ modelsDir: dir, loadEngine: processEngine });
    expect(await collect(p.generate('x'))).toBe('Bonjour');
  });

  test('a crash of the engine fails the request, not the backend — and the next request gets a new engine', async () => {
    let starts = 0;
    const counting = (m, o) => { starts++; return processEngine(m, o); };
    const p = new LocalProvider({ modelsDir: dir, loadEngine: counting });
    await expect(collect(p.generate('crash'))).rejects.toThrow(ENGINE_STOPPED);
    expect(await collect(p.generate('x'))).toBe('Bonjour');
    expect(starts).toBe(2);
  });

  test('a model that will not load is an error the person can read', async () => {
    writeFileSync(join(dir, 'cassé.gguf'), 'x');
    const p = new LocalProvider({ modelsDir: dir, localModel: 'cassé.gguf', loadEngine: processEngine });
    await expect(p.generateJSON('x')).rejects.toThrow('not a model');
  });

  test('an abort reaches the worker', async () => {
    const p = new LocalProvider({ modelsDir: dir, loadEngine: processEngine });
    await expect(p.generateJSON('slow', { timeout: 200 })).rejects.toThrow('aborted');
  });
});
