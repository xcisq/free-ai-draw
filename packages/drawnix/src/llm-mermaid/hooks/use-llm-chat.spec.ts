import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, jest } from '@jest/globals';

jest.mock('../services/llm-chat-service', () => ({
  llmChatService: {
    chatStream: jest.fn(),
  },
}));

import { llmChatService } from '../services/llm-chat-service';
import { useLLMChat } from './use-llm-chat';

function createStream(chunks: string[]) {
  return async function* () {
    for (const content of chunks) {
      yield {
        id: 'chunk',
        choices: [
          {
            delta: {
              content,
            },
            finish_reason: null,
          },
        ],
      };
    }
  };
}

describe('useLLMChat', () => {
  it('应该把结构化上下文拼进请求，并回填 Mermaid 代码', async () => {
    const chatStreamMock = llmChatService.chatStream as jest.MockedFunction<
      typeof llmChatService.chatStream
    >;
    chatStreamMock.mockImplementation(
      createStream(['flowchart LR\n', 'A[开始] --> B[结束]'])
    );

    const { result } = renderHook(() => useLLMChat());

    await act(async () => {
      await result.current.sendMessage('生成一个评估流程图', {
        generationContext: {
          layoutDirection: 'TB',
          usageScenario: 'presentation',
          theme: 'professional',
        },
      });
    });

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
    });

    const requestMessages = chatStreamMock.mock.calls[0]?.[0] || [];
    const llmUserMessage = requestMessages[1];
    const assistantMessage = result.current.messages.find(
      (message) => message.role === 'assistant'
    );

    expect(llmUserMessage.content).toContain('从上到下');
    expect(llmUserMessage.content).toContain('演示文稿');
    expect(llmUserMessage.content).toContain('生成一个评估流程图');
    expect(assistantMessage?.metadata?.mermaidCode).toBe(
      'flowchart LR\nA[开始] --> B[结束]'
    );
  });

  it('重新生成时不应该重复追加最后一条用户消息', async () => {
    const chatStreamMock = llmChatService.chatStream as jest.MockedFunction<
      typeof llmChatService.chatStream
    >;
    chatStreamMock
      .mockImplementationOnce(createStream(['flowchart LR\n', 'A --> B']))
      .mockImplementationOnce(createStream(['flowchart LR\n', 'A --> C']));

    const { result } = renderHook(() => useLLMChat());

    await act(async () => {
      await result.current.sendMessage('生成一个训练流程图', {
        generationContext: {
          layoutDirection: 'LR',
        },
      });
    });

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
    });

    await act(async () => {
      await result.current.regenerate();
    });

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
    });

    const userMessages = result.current.messages.filter(
      (message) => message.role === 'user'
    );
    const assistantMessages = result.current.messages.filter(
      (message) => message.role === 'assistant'
    );

    expect(userMessages).toHaveLength(1);
    expect(assistantMessages).toHaveLength(1);
    expect(assistantMessages[0]?.metadata?.mermaidCode).toBe(
      'flowchart LR\nA --> C'
    );
  });
});
