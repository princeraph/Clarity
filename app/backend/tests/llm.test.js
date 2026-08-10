import { jest, describe, test, expect, afterEach } from '@jest/globals';
import { OllamaProvider } from '../src/llm/OllamaProvider.js';
import { createProvider } from '../src/llm/index.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockFetch(status, body, isStream = false) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
    json: async () => body,
    body: isStream ? body : undefined,
  });
}

function makeFetchError(message) {
  global.fetch = jest.fn().mockRejectedValue(new Error(message));
}

afterEach(() => {
  jest.restoreAllMocks();
  delete global.fetch;
});

// ── createProvider factory ────────────────────────────────────────────────────

describe('createProvider()', () => {
  test('returns OllamaProvider for type "ollama"', () => {
    const p = createProvider({ providerType: 'ollama' });
    expect(p).toBeInstanceOf(OllamaProvider);
  });

  test('defaults to OllamaProvider when providerType is omitted', () => {
    const p = createProvider({});
    expect(p).toBeInstanceOf(OllamaProvider);
  });

  test('reads endpoint from config, not hardcoded', () => {
    const p = createProvider({ llmEndpoint: 'http://remote:11434', ollamaModel: 'llama3' });
    expect(p.endpoint).toBe('http://remote:11434');
    expect(p.model).toBe('llama3');
  });
});

// ── OllamaProvider constructor ────────────────────────────────────────────────

describe('OllamaProvider — config', () => {
  test('uses provided endpoint and model', () => {
    const p = new OllamaProvider({ llmEndpoint: 'http://myserver:11434', ollamaModel: 'gemma3' });
    expect(p.endpoint).toBe('http://myserver:11434');
    expect(p.model).toBe('gemma3');
  });

  test('attaches Authorization header when tunnelSecret is set', () => {
    const p = new OllamaProvider({ tunnelSecret: 'mysecret' });
    expect(p._headers()['Authorization']).toBe('Bearer mysecret');
  });

  test('omits Authorization header when tunnelSecret is empty', () => {
    const p = new OllamaProvider({ tunnelSecret: '' });
    expect(p._headers()['Authorization']).toBeUndefined();
  });
});

// ── ping ──────────────────────────────────────────────────────────────────────

describe('OllamaProvider.ping()', () => {
  test('returns true when /api/tags responds 200', async () => {
    mockFetch(200, { models: [] });
    const p = new OllamaProvider({ llmEndpoint: 'http://localhost:11434' });
    expect(await p.ping()).toBe(true);
  });

  test('returns false when server is unreachable', async () => {
    makeFetchError('connection refused');
    const p = new OllamaProvider({ llmEndpoint: 'http://localhost:11434' });
    expect(await p.ping()).toBe(false);
  });

  test('returns false on non-200 status', async () => {
    mockFetch(503, 'Service Unavailable');
    const p = new OllamaProvider({ llmEndpoint: 'http://localhost:11434' });
    expect(await p.ping()).toBe(false);
  });
});

// ── listModels ────────────────────────────────────────────────────────────────

describe('OllamaProvider.listModels()', () => {
  test('returns model name array from /api/tags', async () => {
    mockFetch(200, { models: [{ name: 'gemma4:latest' }, { name: 'llama3:8b' }] });
    const p = new OllamaProvider({});
    expect(await p.listModels()).toEqual(['gemma4:latest', 'llama3:8b']);
  });

  test('returns empty array on fetch error', async () => {
    makeFetchError('network error');
    const p = new OllamaProvider({});
    expect(await p.listModels()).toEqual([]);
  });
});

// ── generateJSON ──────────────────────────────────────────────────────────────

describe('OllamaProvider.generateJSON()', () => {
  test('parses and returns JSON from Ollama response', async () => {
    const payload = { taskAnalysis: [{ id: '1', priority: 1 }] };
    mockFetch(200, { response: JSON.stringify(payload) });
    const p = new OllamaProvider({});
    const result = await p.generateJSON('analyze this');
    expect(result).toEqual(payload);
  });

  test('throws on non-200 response', async () => {
    mockFetch(500, 'Internal Server Error');
    const p = new OllamaProvider({});
    await expect(p.generateJSON('prompt')).rejects.toThrow('Ollama 500');
  });
});

// ── generate (streaming) ──────────────────────────────────────────────────────

describe('OllamaProvider.generate()', () => {
  function makeStreamBody(lines) {
    const chunks = lines.map(l => Buffer.from(l + '\n'));
    let i = 0;
    return {
      [Symbol.asyncIterator]() {
        return {
          async next() {
            if (i < chunks.length) return { value: chunks[i++], done: false };
            return { value: undefined, done: true };
          },
        };
      },
    };
  }

  test('yields tokens from streamed response', async () => {
    const lines = [
      JSON.stringify({ response: 'Hello' }),
      JSON.stringify({ response: ' world' }),
      JSON.stringify({ done: true }),
    ];
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: makeStreamBody(lines),
    });

    const p = new OllamaProvider({});
    const tokens = [];
    for await (const t of p.generate('hi')) tokens.push(t);
    expect(tokens).toEqual(['Hello', ' world']);
  });

  test('throws on non-200 response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    });
    const p = new OllamaProvider({});
    await expect(async () => {
      for await (const _ of p.generate('hi')) {}
    }).rejects.toThrow('Ollama 401');
  });
});
