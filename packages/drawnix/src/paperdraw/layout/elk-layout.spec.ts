import { AnalysisResult, PaperDrawSelectionState } from '../types/analyzer';
import { basicLayout } from './basic-layout';
import { computeElkOptimizedLayout } from './elk-layout';
import { isValidSelectionForOptimize } from './layout-snapshot';

const analysis: AnalysisResult = {
  entities: [
    { id: 'e1', label: '原始数据', confidence: 0.92 },
    { id: 'e2', label: '数据聚类', confidence: 0.9 },
    { id: 'e3', label: '阶段2配置参数', confidence: 0.88 },
    { id: 'e4', label: 'rubric聚类方法选择', confidence: 0.86 },
  ],
  relations: [
    { id: 'r1', type: 'sequential', source: 'e1', target: 'e2' },
    { id: 'r2', type: 'sequential', source: 'e2', target: 'e3' },
    { id: 'r3', type: 'sequential', source: 'e3', target: 'e4' },
    { id: 'r4', type: 'annotative', source: 'e1', target: 'e4' },
  ],
  weights: {
    e1: 0.7,
    e2: 0.85,
    e3: 0.72,
    e4: 0.8,
  },
  modules: [
    {
      id: 'm1',
      label: '数据聚类阶段',
      entityIds: ['e1', 'e2'],
      order: 1,
    },
    {
      id: 'm2',
      label: 'rubric聚类阶段',
      entityIds: ['e3', 'e4'],
      order: 2,
    },
  ],
};

describe('elk-layout', () => {
  const currentElements = (() => {
    const layout = basicLayout(analysis);
    return [
      ...layout.groups.map((group) => ({
        id: group.id,
        type: 'geometry',
        points: [
          [group.x, group.y],
          [group.x + group.width, group.y + group.height],
        ],
      })),
      ...layout.nodes.map((node) => ({
        id: node.id,
        type: 'geometry',
        points: [
          [node.x, node.y],
          [node.x + node.width, node.y + node.height],
        ],
      })),
      ...layout.edges.map((edge) => ({
        id: edge.id,
        type: 'arrow-line',
        shape: edge.shape,
        source: {
          connection: edge.sourceConnection,
        },
        target: {
          connection: edge.targetConnection,
        },
        points: edge.routing ?? edge.points,
      })),
    ];
  })();

  it('produces orthogonal routing for cross-module edges in global mode', async () => {
    const layout = await computeElkOptimizedLayout(analysis, currentElements as any, {
      mode: 'global',
    });
    const edge = layout.edges.find((item) => item.id === 'r2')!;

    expect(edge.shape).toBe('elbow');
    expect(edge.routing).toBeDefined();
    expect(edge.routing!.length).toBeGreaterThan(2);
  });

  it('keeps unselected nodes in place during selection optimization', async () => {
    const beforeNode = basicLayout(analysis).nodes.find((node) => node.id === 'e4')!;
    const selection: PaperDrawSelectionState = {
      elementIds: ['e1', 'e2'],
      geometryIds: ['e1', 'e2'],
      edgeIds: [],
    };

    const layout = await computeElkOptimizedLayout(analysis, currentElements as any, {
      mode: 'selection',
      selection,
    });
    const afterNode = layout.nodes.find((node) => node.id === 'e4')!;

    expect(afterNode.x).toBe(beforeNode.x);
    expect(afterNode.y).toBe(beforeNode.y);
  });

  it('rejects selection optimization when fewer than 2 rectangle nodes are selected', () => {
    const selection: PaperDrawSelectionState = {
      elementIds: ['e1'],
      geometryIds: ['e1'],
      edgeIds: [],
    };

    expect(isValidSelectionForOptimize(selection, analysis, currentElements as any)).toBe(
      false
    );
  });
});
