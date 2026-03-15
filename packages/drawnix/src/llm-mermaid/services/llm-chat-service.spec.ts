import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { TextDecoder, TextEncoder } from 'util';

jest.mock('../utils/env-config', () => ({
  getLLMMermaidConfig: () => ({
    apiKey: 'test-key',
    baseUrl: 'https://example.com/v1',
    model: 'test-model',
    isConfigured: true,
  }),
}));

import type { Message } from '../types';
import { LLMChatService } from './llm-chat-service';

const fetchMock = jest.fn<typeof fetch>();

describe('LLMChatService', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    global.TextDecoder = TextDecoder as unknown as typeof global.TextDecoder;
  });

  it('chat 应该携带 model 和 signal', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'chat-1',
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'flowchart LR\nA --> B',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 10,
          total_tokens: 20,
        },
      }),
    } as Response);

    const service = new LLMChatService();
    const controller = new AbortController();
    const messages: Message[] = [
      {
        id: 'user-1',
        role: 'user',
        content: '生成一个流程图',
        timestamp: Date.now(),
        type: 'text',
      },
    ];

    await service.chat(messages, {
      signal: controller.signal,
    });

    const [, requestInit] = fetchMock.mock.calls[0]!;
    const requestBody = JSON.parse((requestInit as RequestInit).body as string);

    expect(requestBody.model).toBe('test-model');
    expect((requestInit as RequestInit).signal).toBe(controller.signal);
  });

  it('chatStream 应该解析流式返回内容', async () => {
    const encoder = new TextEncoder();
    const chunks = [
      encoder.encode(
        'data: {"id":"chunk-1","choices":[{"delta":{"content":"flowchart LR\\n"},"finish_reason":null}]}\n'
      ),
      encoder.encode(
        'data: {"id":"chunk-2","choices":[{"delta":{"content":"A --> B"},"finish_reason":null}]}\n'
      ),
      encoder.encode('data: [DONE]\n'),
    ];

    let index = 0;

    fetchMock.mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: async () => {
            if (index >= chunks.length) {
              return {
                done: true,
                value: undefined,
              };
            }

            return {
              done: false,
              value: chunks[index++],
            };
          },
        }),
      },
    } as Response);

    const service = new LLMChatService();
    const messages: Message[] = [
      {
        id: 'user-1',
        role: 'user',
        content: '生成一个流程图',
        timestamp: Date.now(),
        type: 'text',
      },
    ];

    const contents: string[] = [];
    for await (const chunk of service.chatStream(messages)) {
      contents.push(chunk.choices[0]?.delta?.content || '');
    }

    expect(contents.join('')).toBe('flowchart LR\nA --> B');
  });

  it('repairMermaid 应该使用 Mermaid 修复系统提示词', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'chat-2',
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'flowchart LR\nA --> B',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 8,
          completion_tokens: 8,
          total_tokens: 16,
        },
      }),
    } as Response);

    const service = new LLMChatService();
    await service.repairMermaid('修复这段 Mermaid');

    const [requestUrl, requestInit] = fetchMock.mock.calls[0]!;
    const requestBody = JSON.parse((requestInit as RequestInit).body as string);

    expect(requestUrl).toBe('https://example.com/v1/chat/completions');
    expect(requestBody.messages[0].content).toContain('Mermaid 语法修复助手');
    expect(requestBody.messages[1].content).toBe('修复这段 Mermaid');
  });
});
