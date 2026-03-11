import { PaperDrawEnvConfig } from '../types/analyzer';

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'gpt-4o-mini';

export function getPaperDrawEnvConfig(
  env: Record<string, string | undefined> = {}
): PaperDrawEnvConfig {
  const apiKey = env['VITE_PAPERDRAW_API_KEY']?.trim() ?? '';
  const baseUrl = env['VITE_PAPERDRAW_BASE_URL']?.trim() || DEFAULT_BASE_URL;
  const model = env['VITE_PAPERDRAW_MODEL']?.trim() || DEFAULT_MODEL;

  return {
    apiKey,
    baseUrl,
    model,
    isConfigured: Boolean(apiKey && baseUrl && model),
  };
}
