import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../services/board-style-service', () => ({
  boardStyleService: {
    generateMultipleSchemes: jest.fn(),
  },
}));

jest.mock('../utils/board-style-application', () => ({
  applyStyleToElements: jest.fn(),
  createStyleSnapshot: jest.fn(),
  restoreStyleSnapshot: jest.fn(),
}));

import { boardStyleService } from '../services/board-style-service';
import {
  applyStyleToElements,
  createStyleSnapshot,
  restoreStyleSnapshot,
} from '../utils/board-style-application';
import { useBoardStyleOptimization } from './use-board-style-optimization';

const selectionSummary = {
  total: 1,
  originalTotal: 1,
  shapeCount: 1,
  lineCount: 0,
  textCount: 0,
  relatedLineCount: 0,
  includeConnectedLines: true,
  fills: ['#fff'],
  strokes: ['#333'],
};
const mockBoard = {} as any;

describe('useBoardStyleOptimization', () => {
  beforeEach(() => {
    (boardStyleService.generateMultipleSchemes as jest.MockedFunction<
      typeof boardStyleService.generateMultipleSchemes
    >).mockReset();
    (applyStyleToElements as jest.MockedFunction<typeof applyStyleToElements>).mockReset();
    (createStyleSnapshot as jest.MockedFunction<typeof createStyleSnapshot>).mockReset();
    (restoreStyleSnapshot as jest.MockedFunction<typeof restoreStyleSnapshot>).mockReset();
    (createStyleSnapshot as jest.MockedFunction<typeof createStyleSnapshot>).mockReturnValue({
      'shape-1': {
        fill: '#fff',
      },
    });
  });

  it('默认不应在挂载后自动生成方案', async () => {
    const { result } = renderHook(() =>
      useBoardStyleOptimization({
        board: mockBoard,
        targetElements: [{ id: 'shape-1' } as any],
        selectionSummary,
      })
    );

    await waitFor(() => {
      expect(result.current.schemes).toHaveLength(0);
    });
    expect(boardStyleService.generateMultipleSchemes).not.toHaveBeenCalled();
  });

  it('开启 autoGenerate 时挂载后应自动生成默认方案', async () => {
    (boardStyleService.generateMultipleSchemes as jest.MockedFunction<
      typeof boardStyleService.generateMultipleSchemes
    >).mockResolvedValue([
      {
        id: 'scheme-1',
        name: '专业蓝',
        description: '适合技术流程图',
        styles: {
          shape: {
            nodeId: 'shape',
            fill: '#fff',
            stroke: '#333',
            strokeWidth: 2,
            color: '#333',
            fontSize: 14,
            shadow: false,
            shadowBlur: 0,
          },
        },
      },
    ]);

    const { result } = renderHook(() =>
      useBoardStyleOptimization({
        board: mockBoard,
        targetElements: [{ id: 'shape-1' } as any],
        selectionSummary,
        autoGenerate: true,
      })
    );

    await waitFor(() => {
      expect(boardStyleService.generateMultipleSchemes).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(result.current.schemes).toHaveLength(1);
    });
    expect(boardStyleService.generateMultipleSchemes).toHaveBeenCalledWith(
      mockBoard,
      [{ id: 'shape-1' }],
      '',
      3,
      selectionSummary
    );
  });

  it('hover 预览时应该创建快照并以非历史方式应用', () => {
    const scheme = {
      id: 'scheme-1',
      name: '专业蓝',
      description: '适合技术流程图',
      styles: {
        shape: {
          nodeId: 'shape',
          fill: '#fff',
          stroke: '#333',
          strokeWidth: 2,
          color: '#333',
          fontSize: 14,
          shadow: false,
          shadowBlur: 0,
        },
      },
    };

    const { result } = renderHook(() =>
      useBoardStyleOptimization({
        board: mockBoard,
        targetElements: [{ id: 'shape-1' } as any],
        selectionSummary,
        autoGenerate: false,
      })
    );

    act(() => {
      result.current.previewScheme(scheme);
    });

    expect(createStyleSnapshot).toHaveBeenCalledWith([{ id: 'shape-1' }]);
    expect(applyStyleToElements).toHaveBeenCalledWith(
      mockBoard,
      [{ id: 'shape-1' }],
      scheme.styles,
      { saveToHistory: false }
    );

    act(() => {
      result.current.clearPreview();
    });

    expect(restoreStyleSnapshot).toHaveBeenCalledWith(
      mockBoard,
      { 'shape-1': { fill: '#fff' } },
      { saveToHistory: false }
    );
  });

  it('应用方案时应该先清理预览，再正式写入历史', () => {
    const scheme = {
      id: 'scheme-1',
      name: '专业蓝',
      description: '适合技术流程图',
      styles: {
        shape: {
          nodeId: 'shape',
          fill: '#fff',
          stroke: '#333',
          strokeWidth: 2,
          color: '#333',
          fontSize: 14,
          shadow: false,
          shadowBlur: 0,
        },
      },
    };

    const { result } = renderHook(() =>
      useBoardStyleOptimization({
        board: mockBoard,
        targetElements: [{ id: 'shape-1' } as any],
        selectionSummary,
        autoGenerate: false,
      })
    );

    act(() => {
      result.current.previewScheme(scheme);
      result.current.applyScheme(scheme);
    });

    expect(restoreStyleSnapshot).toHaveBeenCalledWith(
      mockBoard,
      { 'shape-1': { fill: '#fff' } },
      { saveToHistory: false }
    );
    expect(applyStyleToElements).toHaveBeenLastCalledWith(
      mockBoard,
      [{ id: 'shape-1' }],
      scheme.styles
    );
  });

  it('预览应用失败时应该恢复快照并记录错误', () => {
    const scheme = {
      id: 'scheme-1',
      name: '危险方案',
      description: '会触发异常',
      styles: {
        line: {
          nodeId: 'line',
          stroke: '#333',
        },
      },
    };

    (applyStyleToElements as jest.MockedFunction<typeof applyStyleToElements>)
      .mockImplementationOnce(() => {
        throw new RangeError('Maximum call stack size exceeded');
      });

    const { result } = renderHook(() =>
      useBoardStyleOptimization({
        board: mockBoard,
        targetElements: [{ id: 'shape-1' } as any],
        selectionSummary,
        autoGenerate: false,
      })
    );

    act(() => {
      result.current.previewScheme(scheme);
    });

    expect(restoreStyleSnapshot).toHaveBeenCalledWith(
      mockBoard,
      { 'shape-1': { fill: '#fff' } },
      { saveToHistory: false }
    );
    expect(result.current.error).toContain('应用样式失败');
  });

  it('正式应用失败时应该回滚并保留界面可用', () => {
    const scheme = {
      id: 'scheme-1',
      name: '危险方案',
      description: '会触发异常',
      styles: {
        line: {
          nodeId: 'line',
          stroke: '#333',
        },
      },
    };

    (applyStyleToElements as jest.MockedFunction<typeof applyStyleToElements>)
      .mockImplementationOnce(() => {
        throw new RangeError('Maximum call stack size exceeded');
      });

    const { result } = renderHook(() =>
      useBoardStyleOptimization({
        board: mockBoard,
        targetElements: [{ id: 'shape-1' } as any],
        selectionSummary,
        autoGenerate: false,
      })
    );

    act(() => {
      result.current.applyScheme(scheme);
    });

    expect(restoreStyleSnapshot).toHaveBeenCalledWith(
      mockBoard,
      { 'shape-1': { fill: '#fff' } },
      { saveToHistory: false }
    );
    expect(result.current.error).toContain('应用样式失败');
  });
});
