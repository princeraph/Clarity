/**
 * Abstract LLM provider interface.
 * All providers must implement generate() and generateJSON().
 */
export class LLMProvider {
  /**
   * Stream tokens from the model.
   * @param {string} prompt
   * @param {object} options - { temperature, maxTokens, timeout }
   * @yields {string} token
   */
  async *generate(prompt, options = {}) {
    throw new Error(`${this.constructor.name} must implement generate()`);
  }

  /**
   * Generate and parse a JSON response (non-streaming).
   * @param {string} prompt
   * @param {object} options - { temperature, maxTokens, timeout }
   * @returns {Promise<object>}
   */
  async generateJSON(prompt, options = {}) {
    throw new Error(`${this.constructor.name} must implement generateJSON()`);
  }

  /**
   * Check if the provider is reachable.
   * @returns {Promise<boolean>}
   */
  async ping() {
    return false;
  }

  /**
   * List available models. Override in providers that support it.
   * @returns {Promise<string[]>}
   */
  async listModels() {
    return [];
  }
}
