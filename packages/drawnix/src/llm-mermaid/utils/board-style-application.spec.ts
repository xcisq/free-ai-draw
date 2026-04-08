import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import {
  applyStyleToElements,
  createStyleSnapshot,
  restoreStyleSnapshot,
} from './board-style-application';

const mockSetNode = jest.fn();
const mockFindPath = jest.fn(() => [0]);
const mockGetElementById = jest.fn();
const mockWithoutSaving = jest.fn((_: unknown, fn: () => void) => fn());

jest.mock('@plait/core', () => ({
  PlaitBoard: {
    findPath: (...args: unknown[]) => mockFindPath(...args),
  },
  PlaitHistoryBoard: {
    withoutSaving: (board: unknown, fn: () => void) => mockWithoutSaving(board, fn),
  },
  Transforms: {
    setNode: (...args: unknown[]) => mockSetNode(...args),
  },
  getElementById: (...args: unknown[]) => mockGetElementById(...args),
}));

jest.mock('@plait/draw', () => ({
  ArrowLineMarkerType: {
    arrow: 'arrow',
    none: 'none',
    openTriangle: 'open-triangle',
    solidTriangle: 'solid-triangle',
    sharpArrow: 'sharp-arrow',
    hollowTriangle: 'hollow-triangle',
  },
  ArrowLineShape: {
    straight: 'straight',
    curve: 'curve',
    elbow: 'elbow',
  },
  PlaitDrawElement: {
    isArrowLine: (value: any) => value?.type === 'arrow-line',
    isVectorLine: (value: any) => value?.type === 'vector-line',
    isText: (value: any) => value?.shape === 'text',
    isImage: (value: any) => value?.type === 'image',
    isShapeElement: (value: any) => value?.type === 'geometry',
  },
}));

jest.mock('@plait/mind', () => ({
  MindElement: {
    isMindElement: () => false,
  },
}));

describe('board-style-application', () => {
  beforeEach(() => {
    mockSetNode.mockReset();
    mockFindPath.mockReset();
    mockGetElementById.mockReset();
    mockWithoutSaving.mockReset();
    mockWithoutSaving.mockImplementation((_: unknown, fn: () => void) => fn());
    mockFindPath.mockReturnValue([0]);
  });

  it('应该把基础样式应用到节点和连线', () => {
    const shape = { id: 'shape-1', type: 'geometry', shape: 'rectangle', text: '输入' } as any;
    const line = {
      id: 'line-1',
      type: 'arrow-line',
      shape: 'straight',
      source: { marker: 'arrow' },
      target: { marker: 'arrow' },
    } as any;

    applyStyleToElements({} as any, [shape, line], {
      'node.input': {
        nodeId: 'node.input',
        fill: '#f5f8ff',
        stroke: '#2b5fb3',
        strokeWidth: 2,
        color: '#334155',
        fontSize: 16,
      },
      line: {
        nodeId: 'line',
        stroke: '#2b5fb3',
        strokeWidth: 2,
        strokeStyle: 'dashed',
        lineShape: 'elbow',
        targetMarker: 'solid-triangle',
      },
      'text.body': {
        nodeId: 'text.body',
        color: '#334155',
        fontSize: 16,
      },
    });

    expect(mockSetNode).toHaveBeenNthCalledWith(
      1,
      {},
      expect.objectContaining({
        fill: '#f5f8ff',
        strokeColor: '#2b5fb3',
        strokeWidth: 2,
        textStyle: expect.objectContaining({
          color: '#334155',
          fontSize: 16,
        }),
      }),
      [0]
    );
    expect(mockSetNode).toHaveBeenNthCalledWith(
      2,
      {},
      expect.objectContaining({
        strokeColor: '#2b5fb3',
        strokeWidth: 2,
        strokeStyle: 'dashed',
        shape: 'elbow',
      }),
      [0]
    );
  });

  it('应该支持创建和恢复样式快照', () => {
    const element = {
      id: 'shape-1',
      fill: '#fff',
      strokeColor: '#333',
      strokeWidth: 1,
      opacity: 100,
      textStyle: {
        color: '#334155',
        fontSize: 14,
      },
      shadow: {
        color: '#333',
        blur: 8,
      },
    } as any;

    const snapshot = createStyleSnapshot([element]);
    mockGetElementById.mockReturnValue(element);

    restoreStyleSnapshot({} as any, snapshot);

    expect(snapshot['shape-1']).toEqual(
      expect.objectContaining({
        fill: '#fff',
        strokeColor: '#333',
        strokeWidth: 1,
        opacity: 100,
        textStyle: {
          color: '#334155',
          fontSize: 14,
        },
        shadow: {
          color: '#333',
          blur: 8,
        },
      })
    );
    expect(mockSetNode).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        fill: '#fff',
        strokeColor: '#333',
        textStyle: {
          color: '#334155',
          fontSize: 14,
        },
        shadow: {
          color: '#333',
          blur: 8,
        },
      }),
      [0]
    );
  });

  it('预览模式下应通过 withoutSaving 应用和恢复', () => {
    const shape = { id: 'shape-1', type: 'geometry', shape: 'rectangle' } as any;
    const snapshot = {
      'shape-1': {
        fill: '#fff',
      },
    };

    mockGetElementById.mockReturnValue(shape);

    applyStyleToElements(
      {} as any,
      [shape],
      {
        shape: {
          nodeId: 'shape',
          fill: '#f5f8ff',
          stroke: '#2b5fb3',
        },
      },
      { saveToHistory: false }
    );
    restoreStyleSnapshot({} as any, snapshot, { saveToHistory: false });

    expect(mockWithoutSaving).toHaveBeenCalledTimes(2);
  });

  it('收到危险的 curve 连线样式时不应把 shape 改成 curve', () => {
    const line = {
      id: 'line-1',
      type: 'arrow-line',
      shape: 'straight',
      source: { marker: 'arrow' },
      target: { marker: 'arrow' },
    } as any;

    applyStyleToElements({} as any, [line], {
      line: {
        nodeId: 'line',
        lineShape: 'curve' as any,
        stroke: '#2b5fb3',
      },
    });

    expect(mockSetNode).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        strokeColor: '#2b5fb3',
      }),
      [0]
    );
    expect(mockSetNode).not.toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        shape: 'curve',
      }),
      [0]
    );
  });

  it('应该优先应用更具体的语义选择器，并支持 glow 降级', () => {
    const shape = {
      id: 'shape-1',
      type: 'geometry',
      shape: 'rectangle',
      text: '输出结果',
      strokeWidth: 1,
    } as any;

    applyStyleToElements({} as any, [shape], {
      '*': {
        nodeId: '*',
        strokeWidth: 1,
        color: '#0f172a',
      },
      shape: {
        nodeId: 'shape',
        fill: '#e2e8f0',
      },
      'node.output': {
        nodeId: 'node.output',
        fill: '#fef3c7',
        stroke: '#d97706',
        glow: true,
        glowColor: '#f59e0b',
        glowBlur: 18,
      },
      'text.body': {
        nodeId: 'text.body',
        fontSize: 15,
      },
    });

    expect(mockSetNode).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        fill: '#fef3c7',
        strokeColor: '#d97706',
        shadow: {
          color: '#f59e0b',
          blur: 18,
        },
        glow: {
          color: '#f59e0b',
          blur: 18,
        },
        textStyle: expect.objectContaining({
          color: '#0f172a',
          fontSize: 15,
        }),
      }),
      [0]
    );
  });
});
