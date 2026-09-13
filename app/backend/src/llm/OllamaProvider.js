import { LLMProvider } from './LLMProvider.js';

// Ollama unloads a model from memory after 5 minutes idle by default. Clarity
// is used in bursts — a question now, another in twenty minutes — so almost
// every request was paying a full model reload before its first token. On an
// 8B model that is tens of seconds of nothing, every time.
//
// The cost of keeping it resident is RAM held for longer, which is a real
// trade on a laptop. So it is a setting, not a constant, and '0' hands the
// memory back immediately for anyone who would rather wait than give up the RAM.
export const DEFAULT_KEEP_ALIVE = '30m';

// Ollama's default context is small (2048 for many models) and it does not
// error when a prompt exceeds it — it silently drops the beginning. Clarity's
// analysis prompt passes 2048 tokens at about fifteen tasks, so the model was
// quietly not seeing the oldest ones while also being slow. num_ctx is
// therefore computed per call rather than left to chance.
const CTX_FLOOR = 2048;
const CTX_CEILING = 8192;      // beyond this the KV cache costs more than the truncation did
const CHARS_PER_TOKEN = 3.5;   // deliberately pessimistic; under-estimating truncates

export function contextFor(promptChars, maxTokens) {
  const needed = Math.ceil(promptChars / CHARS_PER_TOKEN) + maxTokens;
  const withHeadroom = Math.ceil(needed * 1.15);
  return Math.min(CTX_CEILING, Math.max(CTX_FLOOR, 1 << Math.ceil(Math.log2(withHeadroom))));
}

export class OllamaProvider extends LLMProvider {
  constructor(config = {}) {
    super();
    this.endpoint = config.llmEndpoint || 'http://localhost:11434';
    this.model    = config.ollamaModel  || 'gemma4:latest';
    this.secret   = config.tunnelSecret || '';
    this.keepAlive = config.keepAlive ?? DEFAULT_KEEP_ALIVE;
  }

  _body(prompt, { stream, format = null, temperature, maxTokens }) {
    return {
      model: this.model,
      prompt,
      stream,
      ...(format ? { format } : {}),
      // Keeps the model resident between bursts — the single biggest win.
      keep_alive: this.keepAlive,
      options: {
        temperature,
        num_predict: maxTokens,
        num_ctx: contextFor(prompt.length, maxTokens),
      },
    };
  }

  /**
   * Load the model without asking it for anything.
   *
   * Ollama loads on first use, so the first real request of a session paid for
   * it while the person waited on an answer. This moves that cost to startup,
   * where nobody is watching. An empty prompt is the documented way to ask for
   * a load and nothing else.
   */
  async warm({ timeout = 120000 } = {}) {
    const started = Date.now();
    try {
      const resp = await fetch(`${this.endpoint}/api/generate`, {
        method: 'POST',
        headers: this._headers(),
        body: JSON.stringify({ model: this.model, prompt: '', stream: false, keep_alive: this.keepAlive }),
        signal: AbortSignal.timeout(timeout),
      });
      return { ok: resp.ok, ms: Date.now() - started };
    } catch (err) {
      return { ok: false, ms: Date.now() - started, error: err.message };
    }
  }

  _headers() {
    const h = { 'Content-Type': 'application/json' };
    if (this.secret) h['Authorization'] = `Bearer ${this.secret}`;
    return h;
  }

  async *generate(prompt, options = {}) {
    const resp = await fetch(`${this.endpoint}/api/generate`, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify(this._body(prompt, {
        stream: true,
        temperature: options.temperature ?? 0.7,
        maxTokens: options.maxTokens ?? 1024,
      })),
      signal: AbortSignal.timeout(options.timeout ?? 300000),
    });

    if (!resp.ok) {
      throw new Error(`Ollama ${resp.status}: ${await resp.text().catch(() => '')}`);
    }

    const decoder = new TextDecoder();
    for await (const chunk of resp.body) {
      for (const line of decoder.decode(chunk, { stream: true }).split('\n').filter(Boolean)) {
        try {
          const json = JSON.parse(line);
          if (json.response) yield json.response;
          if (json.done) return;
        } catch {}
      }
    }
  }

  async *generateChat(systemPrompt, messages, options = {}) {
    const parts = [];
    if (systemPrompt) parts.push(systemPrompt + '\n');
    for (const msg of messages) {
      if (msg.role === 'user')      parts.push(`User: ${msg.content}`);
      else if (msg.role === 'assistant') parts.push(`Assistant: ${msg.content}`);
    }
    parts.push('Assistant:');
    yield* this.generate(parts.join('\n'), options);
  }

  async generateJSON(prompt, options = {}) {
    const resp = await fetch(`${this.endpoint}/api/generate`, {
      method: 'POST',
      headers: this._headers(),
      // maxTokens is deliberately required-ish here: a blanket 3072 let the
      // model keep writing long after the JSON was complete, and generation is
      // where the time goes. Callers size it to the reply they actually need.
      body: JSON.stringify(this._body(prompt, {
        stream: false,
        format: 'json',
        temperature: options.temperature ?? 0.2,
        maxTokens: options.maxTokens ?? 1024,
      })),
      signal: AbortSignal.timeout(options.timeout ?? 300000),
    });

    if (!resp.ok) {
      throw new Error(`Ollama ${resp.status}: ${await resp.text().catch(() => '')}`);
    }

    const result = await resp.json();
    try {
      return JSON.parse(result.response);
    } catch {
      throw new Error(`Ollama returned non-JSON: ${String(result.response).slice(0, 120)}`);
    }
  }

  async ping() {
    try {
      const resp = await fetch(`${this.endpoint}/api/tags`, {
        headers: this._headers(),
        signal: AbortSignal.timeout(3000),
      });
      return resp.ok;
    } catch {
      return false;
    }
  }

  async listModels() {
    try {
      const resp = await fetch(`${this.endpoint}/api/tags`, {
        headers: this._headers(),
        signal: AbortSignal.timeout(3000),
      });
      if (!resp.ok) return [];
      const data = await resp.json();
      return data.models?.map(m => m.name) || [];
    } catch {
      return [];
    }
  }
}
