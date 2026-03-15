import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, jest, beforeEach } from '@jest/globals';

jest.mock('../services/llm-chat-service', () => ({
  llmChatService: {
    generateMermaid: jest.fn(),
  },
}));

jest.mock('../services/mermaid-stabilizer', () => ({
  mermaidStabilizerService: {
    stabilizeCode: jest.fn(),
    stabilizeResponse: jest.fn(),
  },
  MermaidStabilizationError: class MermaidStabilizationError extends Error {
    stage = 'repair';
    details = ['error'];
  },
}));

import { mermaidStabilizerService } from '../services/mermaid-stabilizer';
import { useMermaidPreview } from './use-mermaid-preview';

describe('useMermaidPreview', () => {
  beforeEach(() => {
    (mermaidStabilizerService.stabilizeCode as jest.MockedFunction<
      typeof mermaidStabilizerService.stabilizeCode
    >).mockReset();
    (mermaidStabilizerService.stabilizeResponse as jest.MockedFunction<
      typeof mermaidStabilizerService.stabilizeResponse
    >).mockReset();
  });

  it('手动更新代码时默认不触发 LLM 修复', async () => {
    (mermaidStabilizerService.stabilizeCode as jest.MockedFunction<
      typeof mermaidStabilizerService.stabilizeCode
    >).mockResolvedValue({
      mermaidCode: 'flowchart LR\nA --> B',
      elements: [{ id: '1' }] as unknown as any[],
      validation: {
        isValid: true,
        errors: [],
        warnings: [],
      },
      source: 'local-fix',
      appliedFixes: ['补全图类型声明'],
    });

    const { result } = renderHook(() => useMermaidPreview());

    await act(async () => {
      await result.current.updateCode('A --> B');
    });

    expect(mermaidStabilizerService.stabilizeCode).toHaveBeenCalledWith('A --> B', {
      allowLLMRepair: undefined,
      signal: undefined,
    });
    expect(result.current.elements).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it('允许修复时会返回稳定后的 Mermaid 代码', async () => {
    (mermaidStabilizerService.stabilizeCode as jest.MockedFunction<
      typeof mermaidStabilizerService.stabilizeCode
    >).mockResolvedValue({
      mermaidCode: 'flowchart LR\nA[开始] --> B[结束]',
      elements: [{ id: '2' }] as unknown as any[],
      validation: {
        isValid: true,
        errors: [],
        warnings: [],
      },
      source: 'llm-repair',
      appliedFixes: ['LLM 定向修复'],
    });

    const { result } = renderHook(() => useMermaidPreview());
    let nextCode = '';

    await act(async () => {
      nextCode = await result.current.updateCode('A[开始] --> B[结束', {
        allowLLMRepair: true,
      });
    });

    expect(nextCode).toBe('flowchart LR\nA[开始] --> B[结束]');
    expect(result.current.mermaidCode).toBe('flowchart LR\nA[开始] --> B[结束]');
  });

  it('修复失败时应该保留错误信息并清空元素', async () => {
    (mermaidStabilizerService.stabilizeCode as jest.MockedFunction<
      typeof mermaidStabilizerService.stabilizeCode
    >).mockRejectedValue(new Error('Mermaid 代码已尝试自动修复，但仍无法稳定预览：存在未完整的连接语句'));

    const { result } = renderHook(() => useMermaidPreview());

    await act(async () => {
      await result.current.updateCode('flowchart LR\nA -->');
    });

    await waitFor(() => {
      expect(result.current.error).toContain('已尝试自动修复');
    });
    expect(result.current.elements).toHaveLength(0);
    expect(result.current.isValid).toBe(false);
  });
});
