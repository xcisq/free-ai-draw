import type { AnalysisResult, PaperDrawSelectionState } from '../types/analyzer';
import { basicLayout } from './basic-layout';
import { computeOptimizedLayoutV2 } from './layout-optimizer-v2';

const analysis: AnalysisResult = {
  entities: [
    { id: 'e1', label: '输入', confidence: 0.92 },
    { id: 'e2', label: '编码', confidence: 0.9 },
    { id: 'e3', label: '聚合', confidence: 0.88 },
    { id: 'e4', label: '融合', confidence: 0.9 },
    { id: 'e5', label: '预测', confidence: 0.89 },
    { id: 'e6', label: '输出', confidence: 0.91 },
  ],
  relations: [
    { id: 'r1', type: 'sequential', source: 'e1', target: 'e2' },
    { id: 'r2', type: 'sequential', source: 'e2', target: 'e3' },
    { id: 'r3', type: 'sequential', source: 'e3', target: 'e4' },
    { id: 'r4', type: 'sequential', source: 'e4', target: 'e5' },
    { id: 'r5', type: 'sequential', source: 'e5', target: 'e6' },
    { id: 'r6', type: 'annotative', source: 'e2', target: 'e5' },
  ],
  weights: {
    e1: 0.7,
    e2: 0.75,
    e3: 0.8,
    e4: 0.82,
    e5: 0.88,
    e6: 0.9,
  },
  modules: [
    {
      id: 'm1',
      label: '阶段一',
      entityIds: ['e1', 'e2'],
      order: 1,
    },
    {
      id: 'm2',
      label: '阶段二',
      entityIds: ['e3', 'e4'],
      order: 2,
    },
    {
      id: 'm3',
      label: '阶段三',
      entityIds: ['e5', 'e6'],
      order: 3,
    },
  ],
};

const simpleAnalysis: AnalysisResult = {
  entities: [
    { id: 's1', label: '输入', confidence: 0.92 },
    { id: 's2', label: '处理', confidence: 0.9 },
    { id: 's3', label: '融合', confidence: 0.88 },
    { id: 's4', label: '输出', confidence: 0.91 },
  ],
  relations: [
    { id: 'sr1', type: 'sequential', source: 's1', target: 's2' },
    { id: 'sr2', type: 'sequential', source: 's2', target: 's3' },
    { id: 'sr3', type: 'sequential', source: 's3', target: 's4' },
  ],
  weights: {
    s1: 0.7,
    s2: 0.78,
    s3: 0.84,
    s4: 0.9,
  },
  modules: [
    {
      id: 'sm1',
      label: '阶段一',
      entityIds: ['s1', 's2'],
      order: 1,
    },
    {
      id: 'sm2',
      label: '阶段二',
      entityIds: ['s3', 's4'],
      order: 2,
    },
  ],
};

function createDraftElementsFromLayout(layout: ReturnType<typeof basicLayout>) {
  const nodeElements = layout.nodes.map((node) => ({
    id: node.id,
    points: [
      [node.x, node.y],
      [node.x + node.width, node.y + node.height],
    ],
  }));
  const edgeElements = layout.edges.map((edge) => ({
    id: edge.id,
    shape: edge.shape,
    source: {
      connection: edge.sourceConnection,
    },
    target: {
      connection: edge.targetConnection,
    },
    points: edge.routing ?? edge.points,
  }));

  return [...nodeElements, ...edgeElements];
}

describe('layout-optimizer-v2', () => {
  it('returns a globally optimized layout with metrics and routed edges', async () => {
    const layout = basicLayout(simpleAnalysis);
    const draftElements = createDraftElementsFromLayout(layout);

    const optimized = await computeOptimizedLayoutV2(simpleAnalysis, draftElements, {
      mode: 'global',
      profile: 'auto',
      quality: 'quality',
      timeoutMs: 3000,
    });

    expect(optimized.metrics).toBeDefined();
    expect(optimized.metrics!.totalScore).toBeGreaterThanOrEqual(0);
    expect(optimized.edges.some((edge) => (edge.routing?.length ?? 0) > 2)).toBe(true);
  });

  it('keeps unselected nodes fixed during selection-only optimization', async () => {
    const layout = basicLayout(analysis);
    const draftElements = createDraftElementsFromLayout(layout);
    const anchorNode = layout.nodes.find((node) => node.id === 'e5')!;
    const selection: PaperDrawSelectionState = {
      elementIds: ['m1'],
      geometryIds: ['m1'],
      edgeIds: [],
    };

    const optimized = await computeOptimizedLayoutV2(analysis, draftElements, {
      mode: 'selection',
      selection,
      profile: 'auto',
      quality: 'quality',
      timeoutMs: 2500,
    });
    const nextAnchorNode = optimized.nodes.find((node) => node.id === 'e5')!;

    expect([nextAnchorNode.x, nextAnchorNode.y]).toEqual([anchorNode.x, anchorNode.y]);
    expect(optimized.metrics).toBeDefined();
  });

  it('rejects invalid selection requests that do not include enough nodes', async () => {
    const layout = basicLayout(analysis);
    const draftElements = createDraftElementsFromLayout(layout);

    await expect(
      computeOptimizedLayoutV2(analysis, draftElements, {
        mode: 'selection',
        selection: {
          elementIds: ['e1'],
          geometryIds: ['e1'],
          edgeIds: [],
        },
        profile: 'auto',
        quality: 'quality',
        timeoutMs: 2500,
      })
    ).rejects.toThrow('INVALID_SELECTION');
  });
});
