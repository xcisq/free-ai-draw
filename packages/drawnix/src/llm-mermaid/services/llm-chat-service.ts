/**
 * LLM 聊天服务
 * 封装 OpenAI 兼容 API 调用，支持流式响应和错误处理
 */

import type { Message, ChatOptions, ChatChunk } from '../types';
import { getLLMMermaidConfig } from '../utils/env-config';
import { getInitialPrompt } from './prompt-templates';

/**
 * LLM API 请求格式
 */
interface ChatRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}

/**
 * LLM API 响应格式（非流式）
 */
interface ChatResponse {
  id: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * LLM API 流式响应格式
 */
interface ChatStreamChunk {
  id: string;
  choices: Array<{
    delta: {
      content?: string;
    };
    finish_reason: string | null;
  }>;
}

/**
 * LLM 聊天服务错误
 */
export class LLMChatError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'LLMChatError';
  }
}

/**
 * LLM 聊天服务类
 */
export class LLMChatService {
  private config: ReturnType<typeof getLLMMermaidConfig>;

  constructor() {
    this.config = getLLMMermaidConfig();
  }

  /**
   * 发送聊天请求（非流式）
   */
  async chat(messages: Message[], options?: ChatOptions): Promise<string> {
    if (!this.config.isConfigured) {
      throw new LLMChatError('LLM API 未配置，请设置环境变量 VITE_LLM_MERMAID_API_KEY');
    }

    const requestBody: ChatRequest = {
      model: this.config.model,
      messages: messages.map(m => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      })),
      stream: false,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 4000,
    };

    try {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: options?.signal,
      });

      if (!response.ok) {
        await this.handleError(response);
      }

      const data: ChatResponse = await response.json();
      return data.choices[0]?.message?.content || '';
    } catch (error) {
      if (error instanceof LLMChatError) {
        throw error;
      }
      throw new LLMChatError(
        `LLM API 调用失败: ${error instanceof Error ? error.message : '未知错误'}`
      );
    }
  }

  /**
   * 发送流式聊天请求
   */
  async *chatStream(messages: Message[], options?: ChatOptions): AsyncGenerator<ChatChunk> {
    if (!this.config.isConfigured) {
      throw new LLMChatError('LLM API 未配置，请设置环境变量 VITE_LLM_MERMAID_API_KEY');
    }

    const requestBody: ChatRequest = {
      model: this.config.model,
      messages: messages.map(m => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      })),
      stream: true,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 4000,
    };

    try {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: options?.signal,
      });

      if (!response.ok) {
        await this.handleError(response);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new LLMChatError('无法读取响应流');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          buffer += decoder.decode();
          const { payloads } = consumeSSEPayloads(buffer, true);
          yield* this.parseStreamPayloads(payloads);
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const { payloads, rest } = consumeSSEPayloads(buffer);
        buffer = rest;
        yield* this.parseStreamPayloads(payloads);
      }
    } catch (error) {
      if (error instanceof LLMChatError) {
        throw error;
      }
      throw new LLMChatError(
        `LLM API 流式调用失败: ${error instanceof Error ? error.message : '未知错误'}`
      );
    }
  }

  /**
   * 生成 Mermaid 代码
   */
  async generateMermaid(prompt: string): Promise<string> {
    return this.sendPrompt(prompt, this.getSystemPrompt());
  }

  /**
   * 生成样式方案
   */
  async generateStyle(prompt: string): Promise<string> {
    return this.sendPrompt(prompt, this.getStyleSystemPrompt());
  }

  /**
   * 定向修复 Mermaid 代码
   */
  async repairMermaid(prompt: string, options?: ChatOptions): Promise<string> {
    return this.sendPrompt(prompt, this.getRepairSystemPrompt(), options);
  }

  /**
   * 获取系统提示词
   */
  private getSystemPrompt(): string {
    return getInitialPrompt();
  }

  /**
   * 获取样式优化系统提示词
   */
  private getStyleSystemPrompt(): string {
    return `你是一个专业的 Mermaid 图表样式设计助手。

你的任务是根据当前 Mermaid 代码和用户的样式需求，返回修改后的完整 Mermaid 代码。

请遵循以下规则：
1. 不改变节点结构、节点 ID、连接关系和 subgraph 层级
2. 优先通过 classDef、class、::: 来实现样式调整
3. 如需虚线边框，请使用 stroke-dasharray
4. 仅输出完整 Mermaid 代码，不要添加解释`;
  }

  /**
   * 获取 Mermaid 修复系统提示词
   */
  private getRepairSystemPrompt(): string {
    return `你是一个 Mermaid 语法修复助手。

你的任务是修复已有 Mermaid 代码中的语法、括号、引号、classDef/class 绑定和截断问题。

请严格遵循以下规则：
1. 优先保留原有语义、节点 ID、连接关系和 subgraph 结构
2. 仅修复会导致 Mermaid 解析失败的问题，不要重写整张图
3. 如果缺少图类型声明，默认补成 flowchart LR
4. 仅输出修复后的完整 Mermaid 代码
5. 不要输出 markdown 代码块，不要解释`;
  }

  private async sendPrompt(
    prompt: string,
    systemPrompt: string,
    options?: ChatOptions
  ): Promise<string> {
    const messages: Message[] = [
      {
        id: 'system',
        role: 'system',
        content: systemPrompt,
        timestamp: Date.now(),
        type: 'text',
      },
      {
        id: 'user',
        role: 'user',
        content: prompt,
        timestamp: Date.now(),
        type: 'text',
      },
    ];

    return this.chat(messages, options);
  }

  private *parseStreamPayloads(payloads: string[]): Generator<ChatChunk> {
    for (const payload of payloads) {
      if (payload === '[DONE]') {
        continue;
      }

      try {
        const parsed: ChatStreamChunk = JSON.parse(payload);
        yield parsed;
      } catch {
        // 忽略无效的 JSON
      }
    }
  }

  /**
   * 处理 API 错误
   */
  private async handleError(response: Response): Promise<never> {
    let errorMessage = `LLM 服务请求失败（${response.status}）`;
    let errorCode: string | undefined;
    const statusCode = response.status;
    let rawBody = '';

    try {
      rawBody = await response.text();
      const errorData = parseJsonSafely(rawBody);
      if (errorData?.error?.message) {
        errorMessage = errorData.error.message;
        errorCode = errorData.error.code;
      } else {
        const fallbackMessage = summarizeErrorBody(rawBody);
        if (fallbackMessage) {
          errorMessage = `${errorMessage}：${fallbackMessage}`;
        }
      }
    } catch {
      const fallbackMessage = summarizeErrorBody(rawBody);
      if (fallbackMessage) {
        errorMessage = `${errorMessage}：${fallbackMessage}`;
      }
    }

    throw new LLMChatError(errorMessage, errorCode, statusCode);
  }

  /**
   * 检查是否已配置
   */
  isConfigured(): boolean {
    return this.config.isConfigured;
  }

  /**
   * 获取配置信息（用于调试）
   */
  getConfigInfo() {
    return {
      baseUrl: this.config.baseUrl,
      model: this.config.model,
      isConfigured: this.config.isConfigured,
    };
  }
}

function consumeSSEPayloads(buffer: string, flushFinal = false) {
  const normalizedBuffer = buffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalizedBuffer.split('\n');
  const rest = flushFinal ? '' : lines.pop() || '';
  const payloads = lines
    .map((line) => line.trim())
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .filter(Boolean);

  return {
    payloads,
    rest,
  };
}

/**
 * 默认 LLM 聊天服务实例
 */
export const llmChatService = new LLMChatService();

function parseJsonSafely(text: string): {
  error?: {
    message?: string;
    code?: string;
  };
} | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed) as {
      error?: {
        message?: string;
        code?: string;
      };
    };
  } catch {
    return null;
  }
}

function summarizeErrorBody(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return '';
  }

  if (/^<!doctype html|^<html/i.test(trimmed)) {
    return '服务端返回了非 JSON 错误页';
  }

  const singleLine = trimmed.replace(/\s+/g, ' ');
  return singleLine.length > 120 ? `${singleLine.slice(0, 117)}...` : singleLine;
}
