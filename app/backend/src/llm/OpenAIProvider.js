import { LLMProvider } from './LLMProvider.js';

export class OpenAIProvider extends LLMProvider {
  constructor(config = {}) {
    super();
    this.endpoint = (config.llmEndpoint || 'https://api.openai.com/v1').replace(/\/$/, '');
    this.model    = config.ollamaModel || 'gpt-4o-mini';
    this.apiKey   = config.apiKey || '';
  }

  _headers() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    };
  }

  async *generate(prompt, options = {}) {
    yield* this.generateChat('', [{ role: 'user', content: prompt }], options);
  }

  async *generateChat(systemPrompt, messages, options = {}) {
    const body = {
      model: this.model,
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        ...messages,
      ],
      stream: true,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 1024,
    };

    const resp = await fetch(`${this.endpoint}/chat/completions`, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(options.timeout ?? 300000),
    });

    if (!resp.ok) {
      throw new Error(`OpenAI ${resp.status}: ${await resp.text().catch(() => '')}`);
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
        const data = line.slice(6).trim();
        if (data === '[DONE]') return;
        try {
          const json = JSON.parse(data);
          const token = json.choices?.[0]?.delta?.content;
          if (token) yield token;
        } catch {}
      }
    }
  }

  async generateJSON(prompt, options = {}) {
    const resp = await fetch(`${this.endpoint}/chat/completions`, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens ?? 3072,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(options.timeout ?? 300000),
    });

    if (!resp.ok) {
      throw new Error(`OpenAI ${resp.status}: ${await resp.text().catch(() => '')}`);
    }

    const result = await resp.json();
    const content = result.choices?.[0]?.message?.content;
    if (!content) throw new Error('OpenAI returned no content in choices');
    try {
      return JSON.parse(content);
    } catch {
      throw new Error(`OpenAI returned non-JSON: ${String(content).slice(0, 120)}`);
    }
  }

  async ping() {
    try {
      if (!this.apiKey) return false;
      const resp = await fetch(`${this.endpoint}/models`, {
        headers: this._headers(),
        signal: AbortSignal.timeout(5000),
      });
      return resp.ok;
    } catch {
      return false;
    }
  }

  async listModels() {
    return ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'o4-mini'];
  }
}
