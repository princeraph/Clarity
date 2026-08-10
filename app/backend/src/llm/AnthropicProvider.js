import { LLMProvider } from './LLMProvider.js';

export class AnthropicProvider extends LLMProvider {
  constructor(config = {}) {
    super();
    this.model  = config.ollamaModel || 'claude-haiku-4-5-20251001';
    this.apiKey = config.apiKey || '';
  }

  _headers() {
    return {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
      'anthropic-version': '2023-06-01',
    };
  }

  async *generate(prompt, options = {}) {
    yield* this.generateChat('', [{ role: 'user', content: prompt }], options);
  }

  async *generateChat(systemPrompt, messages, options = {}) {
    const body = {
      model: this.model,
      messages,
      max_tokens: options.maxTokens ?? 1024,
      temperature: options.temperature ?? 0.7,
      stream: true,
      ...(systemPrompt ? { system: systemPrompt } : {}),
    };

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(options.timeout ?? 300000),
    });

    if (!resp.ok) {
      throw new Error(`Anthropic ${resp.status}: ${await resp.text().catch(() => '')}`);
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const json = JSON.parse(line.slice(6));
          if (json.type === 'content_block_delta' && json.delta?.text) {
            yield json.delta.text;
          }
        } catch {}
      }
    }
  }

  async generateJSON(prompt, options = {}) {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: options.maxTokens ?? 4096,
        temperature: options.temperature ?? 0.2,
        stream: false,
      }),
      signal: AbortSignal.timeout(options.timeout ?? 300000),
    });

    if (!resp.ok) {
      throw new Error(`Anthropic ${resp.status}: ${await resp.text().catch(() => '')}`);
    }

    const result = await resp.json();
    const text = result.content?.[0]?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON in Anthropic response');
    return JSON.parse(match[0]);
  }

  async ping() {
    try {
      if (!this.apiKey) return false;
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: this._headers(),
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 1,
        }),
        signal: AbortSignal.timeout(6000),
      });
      return resp.ok;
    } catch {
      return false;
    }
  }

  async listModels() {
    return ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'];
  }
}
