import { basicLayout } from './basic-layout';
import { AnalysisResult } from '../types/analyzer';

const analysis: AnalysisResult = {
  entities: [
    { id: 'e1', label: '输入数据', confidence: 0.9 },
    { id: 'e2', label: '预处理数据', confidence: 0.8 },
    { id: 'e3', label: '提取特征', confidence: 0.7 },
    { id: 'e4', label: '融合特征', confidence: 0.7 },
    { id: 'e5', label: '训练模型', confidence: 0.7 },
    { id: 'e6', label: '生成输出', confidence: 0.7 },
    { id: 'e7', label: '结果校验', confidence: 0.7 },
  ],
  relations: [
    { id: 'r1', type: 'sequential', source: 'e1', target: 'e2' },
    { id: 'r2', type: 'sequential', source: 'e2', target: 'e3' },
    { id: 'r3', type: 'sequential', source: 'e3', target: 'e4' },
    { id: 'r4', type: 'sequential', source: 'e4', target: 'e5' },
    { id: 'r5', type: 'sequential', source: 'e5', target: 'e6' },
    { id: 'r6', type: 'sequential', source: 'e6', target: 'e7' },
  ],
  weights: {
    e1: 0.6,
    e2: 0.7,
    e3: 0.7,
    e4: 0.7,
    e5: 0.8,
    e6: 0.9,
    e7: 0.6,
  },
  modules: [
    {
      id: 'm1',
      label: '数据准备',
      entityIds: ['e1', 'e2'],
      order: 1,
    },
    {
      id: 'm2',
      label: '建模推理',
      entityIds: ['e3', 'e4', 'e5', 'e6', 'e7'],
      order: 2,
    },
  ],
};

describe('basicLayout', () => {
  it('places modules from left to right', () => {
    const layout = basicLayout(analysis);

    expect(layout.groups).toHaveLength(2);
    expect(layout.groups[0].x).toBeLessThan(layout.groups[1].x);
  });

  it('stacks small modules vertically by default', () => {
    const layout = basicLayout(analysis);
    const node1 = layout.nodes.find((node) => node.id === 'e1')!;
    const node2 = layout.nodes.find((node) => node.id === 'e2')!;

    expect(node1.x).toBe(node2.x);
    expect(node1.y).toBeLessThan(node2.y);
  });

  it('uses a compact 2-column grid for modules larger than the threshold', () => {
    const layout = basicLayout(analysis);
    const largeModuleNodes = layout.nodes.filter((node) =>
      ['e3', 'e4', 'e5', 'e6', 'e7'].includes(node.id)
    );
    const uniqueColumns = new Set(largeModuleNodes.map((node) => node.x));

    expect(uniqueColumns.size).toBeGreaterThan(1);
  });

  it('uses straight edges for adjacent inner-module steps and elbow edges for cross-module steps', () => {
    const layout = basicLayout(analysis);
    const innerEdge = layout.edges.find((edge) => edge.id === 'r1')!;
    const crossModuleEdge = layout.edges.find((edge) => edge.id === 'r2')!;

    expect(innerEdge.shape).toBe('straight');
    expect(innerEdge.sourceConnection[1]).toBe(1);
    expect(innerEdge.targetConnection[1]).toBe(0);

    expect(crossModuleEdge.shape).toBe('elbow');
    expect(crossModuleEdge.sourceConnection[0]).toBe(1);
    expect(crossModuleEdge.targetConnection[0]).toBe(0);
  });

  it('uses elbow routing for non-adjacent module edges to avoid crossing middle nodes', () => {
    const nonAdjacentAnalysis: AnalysisResult = {
      entities: [
        { id: 'e1', label: '开始', confidence: 0.9 },
        { id: 'e2', label: '中间处理', confidence: 0.9 },
        { id: 'e3', label: '结束', confidence: 0.9 },
      ],
      relations: [
        { id: 'r1', type: 'sequential', source: 'e1', target: 'e3' },
      ],
      weights: {
        e1: 0.8,
        e2: 0.7,
        e3: 0.8,
      },
      modules: [
        {
          id: 'm1',
          label: '主流程',
          entityIds: ['e1', 'e2', 'e3'],
          order: 1,
        },
      ],
    };

    const layout = basicLayout(nonAdjacentAnalysis);
    const skippedEdge = layout.edges.find((edge) => edge.id === 'r1')!;

    expect(skippedEdge.shape).toBe('elbow');
    expect(skippedEdge.sourceConnection[0]).toBe(1);
    expect(skippedEdge.targetConnection[0]).toBe(0);
  });
});
