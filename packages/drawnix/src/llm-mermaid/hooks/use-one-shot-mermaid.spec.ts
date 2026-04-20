import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { llmChatService } from '../services/llm-chat-service';
import {
  mermaidStabilizerService,
  MermaidStabilizationError,
} from '../services/mermaid-stabilizer';
import { useOneShotMermaidComposer } from './use-one-shot-mermaid';

const mockUpdateCode = jest.fn();
const mockClear = jest.fn();
const mockClearError = jest.fn();
const mockPreviewState = {
  elements: [] as unknown[],
  isConverting: false,
  validation: {
    isValid: true,
    errors: [],
    warnings: [],
  },
  isValid: true,
  error: null as string | null,
};

jest.mock('./use-mermaid-preview', () => ({
  useMermaidPreview: () => ({
    ...mockPreviewState,
    updateCode: mockUpdateCode,
    clear: mockClear,
    clearError: mockClearError,
  }),
}));

jest.mock('../services/llm-chat-service', () => ({
  llmChatService: {
    chatStream: jest.fn(),
  },
}));

jest.mock('../services/mermaid-stabilizer', () => ({
  mermaidStabilizerService: {
    stabilizeResponse: jest.fn(),
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

describe('useOneShotMermaidComposer', () => {
  const chatStreamMock = llmChatService.chatStream as jest.MockedFunction<
    typeof llmChatService.chatStream
  >;
  const stabilizeResponseMock = mermaidStabilizerService.stabilizeResponse as jest.MockedFunction<
    typeof mermaidStabilizerService.stabilizeResponse
  >;

  beforeEach(() => {
    chatStreamMock.mockReset();
    stabilizeResponseMock.mockReset();
    mockUpdateCode.mockReset();
    mockUpdateCode.mockImplementation(async (code: string) => code);
    mockClear.mockReset();
    mockClearError.mockReset();
    mockPreviewState.elements = [{ id: 'node-1' }] as unknown as any[];
    mockPreviewState.isConverting = false;
    mockPreviewState.validation = {
      isValid: true,
      errors: [],
      warnings: [],
    };
    mockPreviewState.isValid = true;
    mockPreviewState.error = null;
  });

  it('每次生成只发起一次模型请求，并禁用 LLM 二次修复', async () => {
    chatStreamMock.mockImplementation(createStream(['flowchart LR\n', 'A --> B']));
    stabilizeResponseMock.mockResolvedValue({
      mermaidCode: 'flowchart LR\nA --> B',
      elements: [{ id: 'node-1' }] as unknown as any[],
      validation: {
        isValid: true,
        errors: [],
        warnings: [],
      },
      source: 'original',
      appliedFixes: [],
    });

    const { result } = renderHook(() => useOneShotMermaidComposer());

    act(() => {
      result.current.setSourceText('输入图像后进行编码，然后做分类预测。');
      result.current.updateContext({
        structurePattern: 'branched',
        density: 'balanced',
      });
    });

    await act(async () => {
      await result.current.generate();
    });

    await waitFor(() => {
      expect(result.current.state.phase).toBe('ready');
    });

    expect(chatStreamMock).toHaveBeenCalledTimes(1);
    expect(stabilizeResponseMock).toHaveBeenCalledWith(
      'flowchart LR\nA --> B',
      expect.objectContaining({
        allowLLMRepair: false,
      })
    );
    expect(mockUpdateCode).toHaveBeenCalledWith(
      'flowchart LR\nA --> B',
      expect.objectContaining({
        allowLLMRepair: false,
        mermaidConfig: expect.objectContaining({
          flowchart: expect.any(Object),
          themeVariables: expect.any(Object),
        }),
      })
    );
  });

  it('本地稳定化失败时保留最佳努力 Mermaid 草稿', async () => {
    chatStreamMock.mockImplementation(
      createStream(['说明文字\n', 'flowchart LR\n', 'A --> B'])
    );
    stabilizeResponseMock.mockRejectedValue(
      new MermaidStabilizationError(
        'Mermaid 代码暂时无法预览：存在未完整的连接语句',
        'validate',
        ['存在未完整的连接语句'],
        'flowchart LR\nA --> B'
      )
    );

    const { result } = renderHook(() => useOneShotMermaidComposer());

    act(() => {
      result.current.setSourceText('编码后得到结果。');
    });

    await act(async () => {
      await result.current.generate();
    });

    await waitFor(() => {
      expect(result.current.state.phase).toBe('error');
    });

    expect(result.current.state.mermaidCode).toBe('flowchart LR\nA --> B');
    expect(result.current.error?.message).toContain('暂时无法预览');
    expect(chatStreamMock).toHaveBeenCalledTimes(1);
  });

  it('手动修改 Mermaid 代码时只走本地预览链路', async () => {
    const { result } = renderHook(() => useOneShotMermaidComposer());

    await act(async () => {
      await result.current.updateMermaidCode('flowchart LR\nA --> B');
    });

    expect(chatStreamMock).not.toHaveBeenCalled();
    expect(mockUpdateCode).toHaveBeenCalledWith(
      'flowchart LR\nA --> B',
      expect.objectContaining({
        allowLLMRepair: false,
      })
    );
  });
});
