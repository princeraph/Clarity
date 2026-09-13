import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { createServer } from 'http';
import { OllamaProvider, contextFor, DEFAULT_KEEP_ALIVE } from '../src/llm/OllamaProvider.js';

// There is no Ollama here, and the interesting part is not what a model
// replies — it is what Clarity ASKS for. A stub records the request bodies, so
// the options that decide the speed are checked rather than assumed.
let server, endpoint;
const seen = [];

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      seen.push({ url: req.url, body: body ? JSON.parse(body) : null });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ response: '{"ok":true}', done: true }));
    });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  endpoint = `http://127.0.0.1:${server.address().port}`;
});
afterAll(() => new Promise(r => server.close(r)));

const provider = (cfg = {}) => new OllamaProvider({ llmEndpoint: endpoint, ollamaModel: 'test', ...cfg });
const last = () => seen[seen.length - 1].body;

describe('keep_alive — the reload that was being paid on every burst', () => {
  test('is sent on a JSON call', async () => {
    await provider().generateJSON('hi', { maxTokens: 100 });
    expect(last().keep_alive).toBe(DEFAULT_KEEP_ALIVE);
  });

  test('is sent on a streaming call', async () => {
    const it = provider().generate('hi');
    await it.next();
    expect(last().keep_alive).toBe(DEFAULT_KEEP_ALIVE);
  });

  test('is sent on the warm-up', async () => {
    await provider().warm();
    expect(last().keep_alive).toBe(DEFAULT_KEEP_ALIVE);
  });

  test('honours a setting of 0 for anyone who would rather keep the RAM', async () => {
    await provider({ keepAlive: '0' }).generateJSON('hi', { maxTokens: 100 });
    expect(last().keep_alive).toBe('0');
  });
});

describe('num_ctx — Ollama drops the start of an over-long prompt without saying so', () => {
  test('a small prompt stays at the floor rather than allocating a huge KV cache', () => {
    expect(contextFor(400, 200)).toBe(2048);
  });

  test('grows past the default before the prompt could be truncated', () => {
    // ~7700 chars is Clarity's analysis prompt at twenty tasks. Ollama's usual
    // default of 2048 would silently drop the earliest tasks.
    expect(contextFor(7698, 2000)).toBeGreaterThan(2048);
  });

  test('is capped, so a runaway prompt cannot demand unbounded memory', () => {
    expect(contextFor(10_000_000, 4000)).toBe(8192);
  });

  test('always leaves room for the reply as well as the prompt', () => {
    for (const [chars, out] of [[1000, 500], [5000, 1500], [20000, 800]]) {
      expect(contextFor(chars, out)).toBeGreaterThanOrEqual(Math.min(8192, chars / 3.5 + out));
    }
  });

  test('the real request carries it', async () => {
    await provider().generateJSON('x'.repeat(7698), { maxTokens: 2000 });
    expect(last().options.num_ctx).toBe(contextFor(7698, 2000));
  });
});

describe('num_predict — generation is where the time goes', () => {
  test('a caller sizes it to the reply it needs', async () => {
    await provider().generateJSON('hi', { maxTokens: 180 });
    expect(last().options.num_predict).toBe(180);
  });

  test('the JSON default is no longer a blanket 3072', async () => {
    await provider().generateJSON('hi');
    expect(last().options.num_predict).toBeLessThanOrEqual(1024);
  });
});

describe('warm — moving the load off the critical path', () => {
  test('asks for a load and nothing else', async () => {
    await provider().warm();
    expect(last().prompt).toBe('');
    expect(last().stream).toBe(false);
  });

  test('reports how long the load took', async () => {
    const r = await provider().warm();
    expect(r.ok).toBe(true);
    expect(typeof r.ms).toBe('number');
  });

  test('an unreachable Ollama is reported, never thrown — it must not stop the app starting', async () => {
    const r = await new OllamaProvider({ llmEndpoint: 'http://127.0.0.1:1', ollamaModel: 'x' }).warm({ timeout: 300 });
    expect(r.ok).toBe(false);
    expect(r.error).toBeTruthy();
  });
});
