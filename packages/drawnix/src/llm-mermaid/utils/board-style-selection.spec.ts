import { describe, expect, it, jest } from '@jest/globals';

jest.mock('@plait/draw', () => ({
  PlaitDrawElement: {
    isArrowLine: (value: any) => value?.type === 'arrow-line',
    isVectorLine: (value: any) => value?.type === 'vector-line',
    isText: (value: any) => value?.shape === 'text',
    isShapeElement: (value: any) => value?.type === 'geometry',
  },
}));

jest.mock('@plait/mind', () => ({
  MindElement: {
    isMindElement: () => false,
  },
}));

import {
  resolveBoardStyleSelection,
  summarizeBoardStyleSelection,
} from './board-style-selection';

describe('board-style-selection', () => {
  it('默认应补入选中节点之间的关联连线', () => {
    const shapeA = { id: 'shape-a', type: 'geometry', shape: 'rectangle' } as any;
    const shapeB = { id: 'shape-b', type: 'geometry', shape: 'rectangle' } as any;
    const internalLine = {
      id: 'line-internal',
      type: 'arrow-line',
      source: { boundId: 'shape-a' },
      target: { boundId: 'shape-b' },
    } as any;
    const externalLine = {
      id: 'line-external',
      type: 'arrow-line',
      source: { boundId: 'shape-a' },
      target: { boundId: 'shape-c' },
    } as any;

    const result = resolveBoardStyleSelection(
      {
        children: [shapeA, shapeB, internalLine, externalLine],
      } as any,
      [shapeA, shapeB]
    );

    expect(result.relatedLines).toEqual([internalLine]);
    expect(result.targetElements).toEqual([shapeA, shapeB, internalLine]);
    expect(result.summary.relatedLineCount).toBe(1);
    expect(result.summary.includeConnectedLines).toBe(true);
  });

  it('关闭包含关联连线后应只保留原始选区', () => {
    const shapeA = { id: 'shape-a', type: 'geometry', shape: 'rectangle' } as any;
    const shapeB = { id: 'shape-b', type: 'geometry', shape: 'rectangle' } as any;
    const internalLine = {
      id: 'line-internal',
      type: 'arrow-line',
      source: { boundId: 'shape-a' },
      target: { boundId: 'shape-b' },
    } as any;

    const result = resolveBoardStyleSelection(
      {
        children: [shapeA, shapeB, internalLine],
      } as any,
      [shapeA, shapeB],
      { includeConnectedLines: false }
    );

    expect(result.relatedLines).toEqual([]);
    expect(result.targetElements).toEqual([shapeA, shapeB]);
    expect(result.summary.relatedLineCount).toBe(0);
    expect(result.summary.includeConnectedLines).toBe(false);
  });

  it('摘要应统计原始数量和类型数量', () => {
    const summary = summarizeBoardStyleSelection(
      null,
      [
        { id: 'shape-1', type: 'geometry', shape: 'rectangle', text: '输入', fill: '#fff' } as any,
        { id: 'shape-2', type: 'geometry', shape: 'rectangle', text: '输出', textStyle: { fontSize: 16 } } as any,
        {
          id: 'line-1',
          type: 'arrow-line',
          strokeColor: '#333',
          source: { boundId: 'shape-1' },
          target: { boundId: 'shape-2' },
        } as any,
        { id: 'text-1', type: 'geometry', shape: 'text' } as any,
      ],
      3,
      1,
      true
    );

    expect(summary.originalTotal).toBe(3);
    expect(summary.total).toBe(4);
    expect(summary.shapeCount).toBe(2);
    expect(summary.lineCount).toBe(1);
    expect(summary.textCount).toBe(1);
    expect(summary.fills).toContain('#fff');
    expect(summary.strokes).toContain('#333');
    expect(summary.fontSizes).toContain(16);
    expect(summary.semanticNodeCounts?.input).toBe(1);
    expect(summary.semanticNodeCounts?.output).toBe(1);
    expect(summary.lineRoleCounts?.main).toBe(1);
  });
});
