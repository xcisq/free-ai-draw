import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockSetNode = jest.fn();
const mockSetTextColor = jest.fn();
const mockSetFontSize = jest.fn();
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

jest.mock('@plait/text-plugins', () => ({
  DEFAULT_FONT_SIZE: 14,
  TextTransforms: {
    setTextColor: (...args: unknown[]) => mockSetTextColor(...args),
    setFontSize: (...args: unknown[]) => mockSetFontSize(...args),
  },
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

import {
  applyStyleToElements,
  createStyleSnapshot,
  restoreStyleSnapshot,
} from './board-style-application';

describe('board-style-application', () => {
  beforeEach(() => {
    mockSetNode.mockReset();
    mockSetTextColor.mockReset();
    mockSetFontSize.mockReset();
    mockFindPath.mockReset();
    mockGetElementById.mockReset();
    mockWithoutSaving.mockReset();
    mockWithoutSaving.mockImplementation((_: unknown, fn: () => void) => fn());
    mockFindPath.mockReturnValue([0]);
  });

  it('应该把基础样式应用到节点和连线', () => {
    const shape = { id: 'shape-1', type: 'geometry', shape: 'rectangle' } as any;
    const line = {
      id: 'line-1',
      type: 'arrow-line',
      shape: 'straight',
      source: { marker: 'arrow' },
      target: { marker: 'arrow' },
    } as any;

    applyStyleToElements({} as any, [shape, line], {
      shape: {
        nodeId: 'shape',
        fill: '#f5f8ff',
        stroke: '#2b5fb3',
        strokeWidth: 2,
        color: '#334155',
        fontSize: 16,
        shadow: false,
        shadowBlur: 0,
      },
      line: {
        nodeId: 'line',
        stroke: '#2b5fb3',
        strokeWidth: 2,
        color: '#334155',
        fontSize: 16,
        shadow: false,
        shadowBlur: 0,
        strokeStyle: 'dashed',
        lineShape: 'elbow',
        targetMarker: 'solid-triangle',
      },
      text: {
        nodeId: 'text',
        stroke: '#2b5fb3',
        fill: '#fff',
        strokeWidth: 1,
        color: '#334155',
        fontSize: 16,
        shadow: false,
        shadowBlur: 0,
      },
    });

    expect(mockSetTextColor).toHaveBeenCalledWith({}, '#334155');
    expect(mockSetFontSize).toHaveBeenCalledWith({}, '16', 14);
    expect(mockSetNode).toHaveBeenNthCalledWith(
      1,
      {},
      expect.objectContaining({
        fill: '#f5f8ff',
        strokeColor: '#2b5fb3',
        strokeWidth: 2,
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
      })
    );
    expect(mockSetNode).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        fill: '#fff',
        strokeColor: '#333',
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
});
