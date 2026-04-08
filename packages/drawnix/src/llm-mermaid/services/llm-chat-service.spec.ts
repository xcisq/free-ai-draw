import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { TextDecoder, TextEncoder } from 'util';

import type { Message } from '../types';
import { LLMChatError, LLMChatService } from './llm-chat-service';

jest.mock('../utils/env-config', () => ({
  getLLMMermaidConfig: () => ({
    apiKey: 'test-key',
    baseUrl: 'https://example.com/v1',
    model: 'test-model',
    isConfigured: true,
  }),
}));

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

  it('chatStream 应该处理 CRLF、分块 data 事件和末尾无空行场景', async () => {
    const encoder = new TextEncoder();
    const chunks = [
      encoder.encode(
        'data: {"id":"chunk-1","choices":[{"delta":{"content":"flowchart LR\\n"},"finish_reason":null}]}\r\n\r\n'
      ),
      encoder.encode('data: {"id":"chunk-2",'),
      encoder.encode(
        '"choices":[{"delta":{"content":"A --> B"},"finish_reason":null}]}'
      ),
      encoder.encode('\r\n\r\n'),
      encoder.encode(
        'data: {"id":"chunk-3","choices":[{"delta":{"content":"\\nB --> C"},"finish_reason":null}]}'
      ),
      encoder.encode('\r\ndata: [DONE]'),
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

    expect(contents.join('')).toBe('flowchart LR\nA --> B\nB --> C');
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

  it('非 2xx 且返回 JSON 错误体时应该保留服务端 message', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => JSON.stringify({
        error: {
          message: 'upstream overloaded',
          code: 'server_error',
        },
      }),
    } as Response);

    const service = new LLMChatService();

    await expect(
      service.chat([
        {
          id: 'user-1',
          role: 'user',
          content: '生成样式',
          timestamp: Date.now(),
          type: 'text',
        },
      ])
    ).rejects.toEqual(expect.objectContaining<Partial<LLMChatError>>({
      message: 'upstream overloaded',
      code: 'server_error',
      statusCode: 500,
    }));
  });

  it('非 2xx 且返回 HTML 错误体时应该给出明确 500 错误', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => '<!doctype html><html><body>Internal Server Error</body></html>',
    } as Response);

    const service = new LLMChatService();

    await expect(
      service.chat([
        {
          id: 'user-1',
          role: 'user',
          content: '生成样式',
          timestamp: Date.now(),
          type: 'text',
        },
      ])
    ).rejects.toThrow('LLM 服务请求失败（500）：服务端返回了非 JSON 错误页');
  });
});
