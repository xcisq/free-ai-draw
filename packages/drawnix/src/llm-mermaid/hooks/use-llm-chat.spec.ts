import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, jest, beforeEach } from '@jest/globals';

jest.mock('../services/llm-chat-service', () => ({
  llmChatService: {
    chatStream: jest.fn(),
  },
}));

jest.mock('../services/intent-planner', () => ({
  planMermaidIntent: jest.fn(),
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
  MermaidStabilizationError: class MermaidStabilizationError extends Error {},
}));

import { llmChatService } from '../services/llm-chat-service';
import { planMermaidIntent } from '../services/intent-planner';
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
  const chatStreamMock = llmChatService.chatStream as jest.MockedFunction<
    typeof llmChatService.chatStream
  >;
  const intentPlannerMock = planMermaidIntent as jest.MockedFunction<
    typeof planMermaidIntent
  >;

  beforeEach(() => {
    chatStreamMock.mockReset();
    intentPlannerMock.mockReset();
  });

  it('应该先规划意图，再把结构化上下文拼进生成请求，并回填 Mermaid 代码', async () => {
    intentPlannerMock.mockResolvedValue({
      mode: 'generate',
      normalizedContext: {
        layoutDirection: 'TB',
        usageScenario: 'presentation',
        theme: 'professional',
        structurePattern: 'convergent',
        layoutIntentText: '整体从上到下，中间两路并行，最后汇聚',
      },
    });
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

    expect(intentPlannerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userInput: '生成一个评估流程图',
      })
    );
    expect(llmUserMessage.content).toContain('整体从上到下');
    expect(llmUserMessage.content).toContain('演示文稿');
    expect(llmUserMessage.content).toContain('最后汇聚');
    expect(assistantMessage?.metadata?.mermaidCode).toBe(
      'flowchart LR\nA[开始] --> B[结束]'
    );
  });

  it('信息不足时应该先进入澄清，而不是直接生成 Mermaid', async () => {
    intentPlannerMock.mockResolvedValue({
      mode: 'clarify',
      clarificationQuestion: '这张图更偏向并行后汇聚，还是主干居中带上下辅轨？',
      quickReplies: ['并行后汇聚', '主干居中，上下辅轨'],
      normalizedContext: {
        layoutDirection: 'LR',
        clarificationStatus: 'pending',
      },
    });

    const { result } = renderHook(() => useLLMChat());

    await act(async () => {
      await result.current.sendMessage('整体从左到右，帮我画一个论文图');
    });

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
    });

    expect(chatStreamMock).not.toHaveBeenCalled();

    const assistantMessage = result.current.messages.find(
      (message) => message.role === 'assistant'
    );
    expect(assistantMessage?.content).toContain('并行后汇聚');
    expect(assistantMessage?.metadata?.quickReplies).toEqual([
      '并行后汇聚',
      '主干居中，上下辅轨',
    ]);
    expect(assistantMessage?.metadata?.interactionPhase).toBe('clarifying');
  });

  it('重新生成时不应该重复追加最后一条用户消息', async () => {
    intentPlannerMock.mockResolvedValue({
      mode: 'generate',
      normalizedContext: {
        layoutDirection: 'LR',
        structurePattern: 'branched',
      },
    });
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
