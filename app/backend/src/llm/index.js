import { OllamaProvider }    from './OllamaProvider.js';
import { OpenAIProvider }    from './OpenAIProvider.js';
import { AnthropicProvider } from './AnthropicProvider.js';
import { LocalProvider }     from './LocalProvider.js';

export function createProvider(config = {}) {
  switch (config.providerType) {
    case 'openai':
      return new OpenAIProvider(config);
    case 'anthropic':
      return new AnthropicProvider(config);
    case 'openrouter':
      // OpenRouter is OpenAI-compatible — swap the endpoint
      return new OpenAIProvider({
        ...config,
        llmEndpoint: 'https://openrouter.ai/api/v1',
      });
    case 'local':
      // The assistant built into Clarity — no Ollama, no account, nothing sent out.
      return new LocalProvider(config);
    case 'ollama':
    default:
      return new OllamaProvider(config);
  }
}

export { LLMProvider }    from './LLMProvider.js';
export { OllamaProvider } from './OllamaProvider.js';
export { OpenAIProvider } from './OpenAIProvider.js';
export { AnthropicProvider } from './AnthropicProvider.js';
export { LocalProvider }  from './LocalProvider.js';
