import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../services/style-recommendation', () => ({
  styleRecommendationService: {
    recommendDefault: jest.fn(),
    adjustStyle: jest.fn(),
  },
}));

jest.mock('../services/mermaid-converter', () => ({
  mermaidConverter: {
    extractGraphInfoFromCode: jest.fn(),
  },
}));

import { mermaidConverter } from '../services/mermaid-converter';
import { styleRecommendationService } from '../services/style-recommendation';
import { useStyleOptimization } from './use-style-optimization';

const mockGraphInfo = {
  nodes: [{ id: 'A', label: '输入', inDegree: 0, outDegree: 1, type: 'input' as const }],
  edges: [],
  groups: [],
  depth: 1,
  avgDegree: 0,
  nodeCount: 1,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
}

describe('useStyleOptimization', () => {
  beforeEach(() => {
    (mermaidConverter.extractGraphInfoFromCode as jest.MockedFunction<
      typeof mermaidConverter.extractGraphInfoFromCode
    >).mockReset();
    (styleRecommendationService.recommendDefault as jest.MockedFunction<
      typeof styleRecommendationService.recommendDefault
    >).mockReset();
    (styleRecommendationService.adjustStyle as jest.MockedFunction<
      typeof styleRecommendationService.adjustStyle
    >).mockReset();

    (mermaidConverter.extractGraphInfoFromCode as jest.MockedFunction<
      typeof mermaidConverter.extractGraphInfoFromCode
    >).mockReturnValue(mockGraphInfo);
  });

  it('首次拿到无样式 Mermaid 时应自动应用默认样式', async () => {
    const onMermaidCodeChange = jest.fn();
    (styleRecommendationService.recommendDefault as jest.MockedFunction<
      typeof styleRecommendationService.recommendDefault
    >).mockResolvedValue({
      mermaidCode:
        'flowchart LR\nA[输入]:::input\nclassDef input fill:#4A90E2,stroke:#2E5C8A,stroke-width:2px,color:#fff',
      styleSchemes: [
        {
          nodeId: 'input',
          fill: '#4A90E2',
          stroke: '#2E5C8A',
          strokeWidth: 2,
          color: '#fff',
          fontSize: 14,
          shadow: false,
          shadowBlur: 0,
        },
      ],
    });

    renderHook(() =>
      useStyleOptimization({
        mermaidCode: 'flowchart LR\nA[输入]',
        generationContext: { usageScenario: 'paper', theme: 'academic' },
        onMermaidCodeChange,
      })
    );

    await waitFor(() => {
      expect(styleRecommendationService.recommendDefault).toHaveBeenCalledTimes(1);
    });
    expect(onMermaidCodeChange).toHaveBeenCalledWith(expect.stringContaining('classDef input'));
  });

  it('手动样式请求应该调用 adjustStyle 并记录最后一次请求', async () => {
    const onMermaidCodeChange = jest.fn();
    (styleRecommendationService.adjustStyle as jest.MockedFunction<
      typeof styleRecommendationService.adjustStyle
    >).mockResolvedValue({
      mermaidCode:
        'flowchart LR\nA[输入]:::input\nclassDef input fill:#4A90E2,stroke:#2E5C8A,stroke-width:2px,color:#fff',
      styleSchemes: [
        {
          nodeId: 'input',
          fill: '#4A90E2',
          stroke: '#2E5C8A',
          strokeWidth: 2,
          color: '#fff',
          fontSize: 14,
          shadow: false,
          shadowBlur: 0,
        },
      ],
    });

    const { result } = renderHook(() =>
      useStyleOptimization({
        mermaidCode:
          'flowchart LR\nA[输入]:::input\nclassDef input fill:#ddd,stroke:#333,stroke-width:1px,color:#333',
        generationContext: { usageScenario: 'paper', theme: 'academic' },
        onMermaidCodeChange,
      })
    );

    await act(async () => {
      await result.current.optimizeByPrompt('把输入节点改成蓝色');
    });

    expect(styleRecommendationService.adjustStyle).toHaveBeenCalledWith(
      mockGraphInfo,
      expect.stringContaining('flowchart LR'),
      '把输入节点改成蓝色'
    );
    expect(result.current.lastStyleRequest).toBe('把输入节点改成蓝色');
    expect(onMermaidCodeChange).toHaveBeenCalledWith(expect.stringContaining('classDef input'));
  });

  it('并发样式请求时只采用最后一次结果', async () => {
    const onMermaidCodeChange = jest.fn();
    const first = deferred<{
      mermaidCode: string;
      styleSchemes: Array<{
        nodeId: string;
        fill: string;
        stroke: string;
        strokeWidth: number;
        color: string;
        fontSize: number;
        shadow: boolean;
        shadowBlur: number;
      }>;
    }>();
    const second = deferred<{
      mermaidCode: string;
      styleSchemes: Array<{
        nodeId: string;
        fill: string;
        stroke: string;
        strokeWidth: number;
        color: string;
        fontSize: number;
        shadow: boolean;
        shadowBlur: number;
      }>;
    }>();

    (styleRecommendationService.adjustStyle as jest.MockedFunction<
      typeof styleRecommendationService.adjustStyle
    >)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const { result } = renderHook(() =>
      useStyleOptimization({
        mermaidCode:
          'flowchart LR\nA[输入]:::input\nclassDef input fill:#ddd,stroke:#333,stroke-width:1px,color:#333',
        onMermaidCodeChange,
      })
    );

    let firstCall!: Promise<void>;
    let secondCall!: Promise<void>;

    act(() => {
      firstCall = result.current.optimizeByPrompt('第一次请求');
      secondCall = result.current.optimizeByPrompt('第二次请求');
    });

    second.resolve({
      mermaidCode:
        'flowchart LR\nA[输入]:::input\nclassDef input fill:#2222ff,stroke:#333,stroke-width:1px,color:#fff',
      styleSchemes: [
        {
          nodeId: 'input',
          fill: '#2222ff',
          stroke: '#333333',
          strokeWidth: 1,
          color: '#ffffff',
          fontSize: 14,
          shadow: false,
          shadowBlur: 0,
        },
      ],
    });
    first.resolve({
      mermaidCode:
        'flowchart LR\nA[输入]:::input\nclassDef input fill:#cccccc,stroke:#333,stroke-width:1px,color:#333',
      styleSchemes: [
        {
          nodeId: 'input',
          fill: '#cccccc',
          stroke: '#333333',
          strokeWidth: 1,
          color: '#333333',
          fontSize: 14,
          shadow: false,
          shadowBlur: 0,
        },
      ],
    });

    await act(async () => {
      await Promise.all([firstCall, secondCall]);
    });

    await waitFor(() => {
      expect(onMermaidCodeChange).toHaveBeenCalledTimes(1);
    });
    expect(onMermaidCodeChange).toHaveBeenCalledWith(expect.stringContaining('#2222ff'));
  });
});
