import { LLMProvider } from './LLMProvider.js';

export class OllamaProvider extends LLMProvider {
  constructor(config = {}) {
    super();
    this.endpoint = config.llmEndpoint || 'http://localhost:11434';
    this.model    = config.ollamaModel  || 'gemma4:latest';
    this.secret   = config.tunnelSecret || '';
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
      body: JSON.stringify({
        model: this.model,
        prompt,
        stream: true,
        options: {
          temperature: options.temperature ?? 0.7,
          num_predict: options.maxTokens   ?? 1024,
        },
      }),
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
      body: JSON.stringify({
        model: this.model,
        prompt,
        stream: false,
        format: 'json',
        options: {
          temperature: options.temperature ?? 0.2,
          num_predict: options.maxTokens   ?? 3072,
        },
      }),
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
