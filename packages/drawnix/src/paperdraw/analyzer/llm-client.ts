/**
 * OpenAI 兼容 LLM 客户端
 * 使用原生 fetch 调用，不依赖 openai npm 包
 */

import { LLMConfig, ExtractionResult } from '../types/analyzer';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionResponse {
  id: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string | null;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * 调用 OpenAI 兼容 Chat Completions API
 */
export async function callLLM(
  config: LLMConfig,
  messages: ChatMessage[],
  jsonMode: boolean = true
): Promise<string> {
  const url = `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`;

  const body: Record<string, unknown> = {
    model: config.model,
    messages,
    temperature: 0.2,
  };

  if (jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `LLM API error (${response.status}): ${errorText}`
    );
  }

  const data: ChatCompletionResponse = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('LLM returned empty response');
  }

  return content;
}

// ========== System Prompts ==========

const EXTRACTION_SYSTEM_PROMPT = `你是一个学术论文流程图生成助手。给定一段描述研究方法、系统架构或工作流程的文本，你需要：

1. 提取所有关键实体（步骤、模块、数据、方法名等）
2. 识别实体间的关系，分为三类：
   - sequential: 顺序/依赖关系（A 之后是 B，A 的输出是 B 的输入）
   - modular: 模块包含关系（A 和 B 属于同一个阶段/模块/子系统）
   - annotative: 注释/补充说明关系（A 是 B 的注释或补充说明）
3. 严格以 JSON 格式输出，格式如下：

{
  "entities": [
    {"id": "e1", "label": "实体名称", "evidence": "原文中的相关片段"}
  ],
  "relations": [
    {"id": "r1", "type": "sequential", "source": "e1", "target": "e2", "label": "可选的连接描述"},
    {"id": "r2", "type": "modular", "moduleLabel": "模块名称", "entityIds": ["e1", "e2"]},
    {"id": "r3", "type": "annotative", "source": "e3", "target": "e4", "label": "注释内容"}
  ]
}

注意事项：
- 实体 id 使用 e1, e2, e3... 格式
- 关系 id 使用 r1, r2, r3... 格式
- 确保所有 source/target 引用的实体 id 在 entities 列表中存在
- 确保 modular 关系的 entityIds 中的 id 在 entities 列表中存在
- 一个实体可以属于多个模块
- 如果文本中没有明确的模块结构，可以不生成 modular 关系
- label 字段简洁明了，使用与输入文本相同的语言`;

/**
 * 从文本中提取实体和关系
 */
export async function extractFromText(
  text: string,
  config: LLMConfig
): Promise<ExtractionResult> {
  const content = await callLLM(config, [
    { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
    { role: 'user', content: text },
  ]);

  const parsed = JSON.parse(content);
  return parsed as ExtractionResult;
}
