/**
 * 环境变量配置工具
 * 读取 VITE_LLM_MERMAID_* 环境变量
 */

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'gpt-4o-mini';

/**
 * 获取 LLM Mermaid 环境变量配置
 */
export function getLLMMermaidEnvConfig(
  env: Record<string, string | undefined> = {}
): {
  apiKey: string;
  baseUrl: string;
  model: string;
  isConfigured: boolean;
} {
  const apiKey = env['VITE_LLM_MERMAID_API_KEY']?.trim() ?? '';
  const baseUrl = env['VITE_LLM_MERMAID_API_BASE_URL']?.trim() || DEFAULT_BASE_URL;
  const model = env['VITE_LLM_MERMAID_MODEL']?.trim() || DEFAULT_MODEL;

  return {
    apiKey,
    baseUrl,
    model,
    isConfigured: Boolean(apiKey && baseUrl && model),
  };
}

/**
 * 从 import.meta.env 获取配置（Vite 开发环境）
 */
export function getLLMMermaidConfig() {
  const metaEnv = (import.meta as unknown as {
    env?: Record<string, string | undefined>;
  }).env;

  return getLLMMermaidEnvConfig(metaEnv || {});
}
