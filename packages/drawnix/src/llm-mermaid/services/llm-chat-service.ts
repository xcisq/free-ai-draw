/**
 * LLM 聊天服务
 * 封装 OpenAI 兼容 API 调用，支持流式响应和错误处理
 */

import type { Message, ChatOptions, ChatChunk } from '../types';
import { getLLMMermaidConfig } from '../utils/env-config';

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
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const normalizedLine = line.trim();
          if (normalizedLine.startsWith('data: ')) {
            const data = normalizedLine.slice(6).trim();
            if (data === '[DONE]') continue;

            try {
              const parsed: ChatStreamChunk = JSON.parse(data);
              yield parsed;
            } catch {
              // 忽略无效的 JSON
            }
          }
        }
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
    const messages: Message[] = [
      {
        id: 'system',
        role: 'system',
        content: this.getSystemPrompt(),
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

    const response = await this.chat(messages);
    return response;
  }

  /**
   * 生成样式方案
   */
  async generateStyle(
    graphInfo: string,
    styleRequest: string
  ): Promise<string> {
    const messages: Message[] = [
      {
        id: 'system',
        role: 'system',
        content: '你是一个专业的图表样式设计师，擅长为 Mermaid 流程图设计美观的配色方案。',
        timestamp: Date.now(),
        type: 'text',
      },
      {
        id: 'user',
        role: 'user',
        content: `请为以下图表生成样式方案：\n\n图表信息：${graphInfo}\n\n用户需求：${styleRequest}\n\n请只输出 classDef 样式定义代码，不要包含其他解释。`,
        timestamp: Date.now(),
        type: 'text',
      },
    ];

    const response = await this.chat(messages);
    return response;
  }

  /**
   * 获取系统提示词
   */
  private getSystemPrompt(): string {
    return `你是一个专业的论文框架图生成助手。你的任务是根据用户的描述生成 Mermaid 代码，用于创建论文 Pipeline 框架图。

遵循以下原则：
1. 使用矩形节点（stadium 或 rounded）表示处理步骤
2. 使用 subgraph 进行模块分组
3. 不使用复杂箭头标签
4. 使用 classDef 定义样式类
5. 支持的节点类型：矩形 ([...]) 和 圆角矩形 ([(...)])
6. 布局方向根据用户要求选择 LR（从左到右）或 TB（从上到下）

输出格式：仅输出 Mermaid 代码，不要包含任何解释文字。`;
  }

  /**
   * 处理 API 错误
   */
  private async handleError(response: Response): Promise<never> {
    let errorMessage = 'LLM API 请求失败';
    let errorCode: string | undefined;
    let statusCode = response.status;

    try {
      const errorData = await response.json().catch(() => null);
      if (errorData?.error?.message) {
        errorMessage = errorData.error.message;
        errorCode = errorData.error.code;
      }
    } catch {
      // 忽略 JSON 解析错误
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

/**
 * 默认 LLM 聊天服务实例
 */
export const llmChatService = new LLMChatService();
