import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, jest, beforeEach } from '@jest/globals';

import { llmChatService } from '../services/llm-chat-service';
import {
  mermaidStabilizerService,
  MermaidStabilizationError,
} from '../services/mermaid-stabilizer';
import { useLLMChat } from './use-llm-chat';

jest.mock('../services/llm-chat-service', () => ({
  llmChatService: {
    chatStream: jest.fn(),
  },
}));

jest.mock('../services/mermaid-stabilizer', () => ({
  mermaidStabilizerService: {
    stabilizeResponse: jest.fn(async (content: string) => ({
      mermaidCode: content,
      elements: [],
      validation: {
        isValid: true,
        errors: [],
        warnings: [],
      },
      source: 'original',
      appliedFixes: [],
    })),
  },
  MermaidStabilizationError: class MermaidStabilizationError extends Error {
    stage: 'extract' | 'validate' | 'convert' | 'repair';
    details: string[];
    bestEffortCode?: string;

    constructor(
      message: string,
      stage: 'extract' | 'validate' | 'convert' | 'repair',
      details: string[] = [],
      bestEffortCode?: string
    ) {
      super(message);
      this.name = 'MermaidStabilizationError';
      this.stage = stage;
      this.details = details;
      this.bestEffortCode = bestEffortCode;
    }
  },
}));

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
  const chatStreamMock = llmChatService.chatStream as jest.MockedFunction<
    typeof llmChatService.chatStream
  >;
  const stabilizeResponseMock = mermaidStabilizerService.stabilizeResponse as jest.MockedFunction<
    typeof mermaidStabilizerService.stabilizeResponse
  >;

  beforeEach(() => {
    chatStreamMock.mockReset();
    stabilizeResponseMock.mockReset();
    stabilizeResponseMock.mockImplementation(async (content: string) => ({
      mermaidCode: content,
      elements: [],
      validation: {
        isValid: true,
        errors: [],
        warnings: [],
      },
      source: 'original',
      appliedFixes: [],
    }));
  });

  it('正常输入时应该直接生成，不先阻塞在意图规划阶段', async () => {
    chatStreamMock.mockImplementation(
      createStream(['flowchart TB\n', 'A[开始] --> B[结束]'])
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

    expect(llmUserMessage.content).toContain('整体从上到下');
    expect(llmUserMessage.content).toContain('演示文稿');
    expect(llmUserMessage.content).toContain('输出前请自行检查这份 Mermaid 是否能直接成功预览');
    expect(stabilizeResponseMock).toHaveBeenCalledWith(
      'flowchart TB\nA[开始] --> B[结束]',
      expect.objectContaining({
        allowLLMRepair: false,
      })
    );
    expect(assistantMessage?.metadata?.mermaidCode).toBe(
      'flowchart TB\nA[开始] --> B[结束]'
    );
  });

  it('短输入也应该直接生成，不再追加前置规划请求', async () => {
    chatStreamMock.mockImplementation(createStream(['flowchart LR\n', 'A --> B']));

    const { result } = renderHook(() => useLLMChat());

    await act(async () => {
      await result.current.sendMessage('帮我画图');
    });

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
    });

    expect(chatStreamMock).toHaveBeenCalledTimes(1);
    const requestMessages = chatStreamMock.mock.calls[0]?.[0] || [];
    const llmUserMessage = requestMessages[1];
    expect(llmUserMessage.content).toContain('用户原始文本');
    expect(llmUserMessage.content).toContain('帮我画图');
  });

  it('重新生成时不应该重复追加最后一条用户消息', async () => {
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

  it('稳定化失败时应该回退到最佳 Mermaid 候选，而不是丢失结果', async () => {
    chatStreamMock.mockImplementation(
      createStream(['说明文字\n', 'flowchart LR\n', 'A --> B'])
    );
    stabilizeResponseMock.mockRejectedValue(
      new MermaidStabilizationError(
        'Mermaid 代码已尝试自动修复，但仍无法稳定预览',
        'repair',
        ['parse error'],
        'flowchart LR\nA --> B'
      )
    );

    const { result } = renderHook(() => useLLMChat());

    await act(async () => {
      await result.current.sendMessage('生成一个训练流程图');
    });

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
    });

    const assistantMessage = result.current.messages.find(
      (message) => message.role === 'assistant'
    );

    expect(assistantMessage?.type).toBe('mermaid');
    expect(assistantMessage?.metadata?.mermaidCode).toBe('flowchart LR\nA --> B');
    expect(assistantMessage?.metadata?.renderState).toBe('fallback');
    expect(assistantMessage?.metadata?.failureStage).toBe('repair');
    expect(result.current.error?.message).toContain('自动修复');
  });
});
