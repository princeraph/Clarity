import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { createServer } from 'http';
import { OllamaProvider, NUM_CTX, wouldTruncate, DEFAULT_KEEP_ALIVE } from '../src/llm/OllamaProvider.js';

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

describe('num_ctx — constant, because changing it reloads the model', () => {
  test('every kind of call sends the same value', async () => {
    const p = provider();
    await p.generateJSON('short', { maxTokens: 100 });
    const a = last().options.num_ctx;
    await p.generateJSON('x'.repeat(9000), { maxTokens: 2000 });
    const b = last().options.num_ctx;
    const it = p.generate('another');
    await it.next();
    const c = last().options.num_ctx;
    // Measured on a real machine: a different num_ctx costs an 8-9 second
    // reload, because it is part of how Ollama loads the model rather than a
    // per-request option. Varying it defeated keep_alive on every call.
    expect(a).toBe(NUM_CTX);
    expect(b).toBe(NUM_CTX);
    expect(c).toBe(NUM_CTX);
  });

  test('the warm-up loads at the same size the real calls will use', async () => {
    await provider().warm();
    expect(last().options.num_ctx).toBe(NUM_CTX);
  });

  test('it is big enough for the largest prompt Clarity composes', () => {
    // The analysis at its cap of 12 tasks, plus the reply it asks for.
    expect(wouldTruncate(7700, 840)).toBe(false);
  });

  test('and truncation is still detectable rather than silent', () => {
    expect(wouldTruncate(200000, 1000)).toBe(true);
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
