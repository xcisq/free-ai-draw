import type { LayoutResult } from '../types/analyzer';
import { buildLayoutConstraintModel } from './constraint-model';
import { refineLayoutWithElk } from './elk-layout';

const layout: LayoutResult = {
  direction: 'LR',
  nodes: [
    {
      id: 'e1',
      label: '原始数据',
      x: 0,
      y: 0,
      width: 220,
      height: 72,
      weight: 0.7,
      confidence: 0.92,
      row: 0,
      column: 0,
      moduleId: 'm1',
    },
    {
      id: 'e2',
      label: '数据聚类',
      x: 0,
      y: 160,
      width: 220,
      height: 72,
      weight: 0.8,
      confidence: 0.9,
      row: 1,
      column: 0,
      moduleId: 'm1',
    },
    {
      id: 'e3',
      label: '阶段2参数',
      x: 440,
      y: 0,
      width: 220,
      height: 72,
      weight: 0.72,
      confidence: 0.88,
      row: 0,
      column: 0,
      moduleId: 'm2',
    },
    {
      id: 'e4',
      label: '方法选择',
      x: 440,
      y: 160,
      width: 220,
      height: 72,
      weight: 0.81,
      confidence: 0.87,
      row: 1,
      column: 0,
      moduleId: 'm2',
    },
  ],
  groups: [
    {
      id: 'm1',
      moduleLabel: '数据聚类阶段',
      entityIds: ['e1', 'e2'],
      x: -24,
      y: -52,
      width: 268,
      height: 308,
      order: 1,
    },
    {
      id: 'm2',
      moduleLabel: 'rubric阶段',
      entityIds: ['e3', 'e4'],
      x: 416,
      y: -52,
      width: 268,
      height: 308,
      order: 2,
    },
  ],
  edges: [
    {
      id: 'r1',
      type: 'sequential',
      sourceId: 'e1',
      targetId: 'e2',
      shape: 'elbow',
      sourceConnection: [0.5, 1],
      targetConnection: [0.5, 0],
      points: [
        [110, 72],
        [110, 160],
      ],
    },
    {
      id: 'r2',
      type: 'sequential',
      sourceId: 'e2',
      targetId: 'e3',
      shape: 'elbow',
      sourceConnection: [1, 0.5],
      targetConnection: [0, 0.5],
      points: [
        [220, 196],
        [440, 36],
      ],
    },
  ],
};

describe('refineLayoutWithElk', () => {
  it('keeps module structure and returns positioned nodes', async () => {
    const model = buildLayoutConstraintModel(layout, {
      mode: 'global',
      profile: 'auto',
      quality: 'quality',
    });
    const refined = await refineLayoutWithElk(layout, model);

    expect(refined.groups).toHaveLength(2);
    expect(refined.groups[0].entityIds).toEqual(['e1', 'e2']);
    expect(refined.groups[1].entityIds).toEqual(['e3', 'e4']);
    expect(refined.nodes.every((node) => Number.isFinite(node.x))).toBe(true);
    expect(refined.nodes.every((node) => Number.isFinite(node.y))).toBe(true);
  });
});
