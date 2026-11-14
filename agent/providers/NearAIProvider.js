// NearAIProvider — NEAR AI Cloud (private inference), OpenAI-compatible.
// Docs: https://docs.near.ai/cloud/quickstart — base URL https://cloud-api.near.ai/v1,
// auth `Authorization: Bearer <NEAR_AI_API_KEY>`. Model ids (and which support tool
// calling — look for "tools" in supported_features) come from GET /v1/models.
import { OpenAICompatProvider } from './OpenAICompatProvider.js';

export const NEAR_AI_BASE_URL      = process.env.NEAR_AI_BASE_URL || 'https://cloud-api.near.ai/v1';
export const NEAR_AI_DEFAULT_MODEL = process.env.NEAR_AI_MODEL    || 'Qwen/Qwen3.6-35B-A3B-FP8';

export class NearAIProvider extends OpenAICompatProvider {
  constructor({ apiKey = process.env.NEAR_AI_API_KEY, model = NEAR_AI_DEFAULT_MODEL, baseUrl = NEAR_AI_BASE_URL } = {}) {
    if (!apiKey) throw new Error('NEAR AI Cloud API key required (set NEAR_AI_API_KEY)');
    super({ apiKey, model, baseUrl, label: 'NEAR AI', idPrefix: 'nai' });
  }
}
