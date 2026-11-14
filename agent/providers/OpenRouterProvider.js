// OpenRouterProvider — OpenAI-compatible API, supports any OR model with tool calling
import { OpenAICompatProvider } from './OpenAICompatProvider.js';

export class OpenRouterProvider extends OpenAICompatProvider {
  constructor({ apiKey, model = 'google/gemini-2.5-flash:google' } = {}) {
    super({
      apiKey,
      model,
      baseUrl:      'https://openrouter.ai/api/v1',
      label:        'OpenRouter',
      idPrefix:     'or',
      extraHeaders: { 'HTTP-Referer': 'https://github.com/Eshan276/agentx-near' },
    });
  }
}
