import { basicLayout } from './basic-layout';
import { optimizeLayout } from './optimize-layout';
import { AnalysisResult } from '../types/analyzer';

const analysis: AnalysisResult = {
  entities: [
    { id: 'e1', label: '原始数据', confidence: 0.9 },
    { id: 'e2', label: '数据聚类', confidence: 0.85 },
    { id: 'e3', label: '阶段2配置参数', confidence: 0.88 },
    { id: 'e4', label: 'rubric聚类方法选择', confidence: 0.84 },
  ],
  relations: [
    { id: 'r1', type: 'sequential', source: 'e1', target: 'e2' },
    { id: 'r2', type: 'sequential', source: 'e2', target: 'e3' },
    { id: 'r3', type: 'sequential', source: 'e3', target: 'e4' },
    { id: 'r4', type: 'annotative', source: 'e1', target: 'e4' },
  ],
  weights: {
    e1: 0.7,
    e2: 0.8,
    e3: 0.75,
    e4: 0.82,
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

describe('optimizeLayout', () => {
  it('expands module gaps when boundaries are crossed by external edges', () => {
    const baseLayout = basicLayout(analysis);
    const optimizedLayout = optimizeLayout(analysis);

    expect(optimizedLayout.groups[1].x).toBeGreaterThan(baseLayout.groups[1].x);
  });

  it('adds explicit top-lane routing for cross-module sequential edges', () => {
    const optimizedLayout = optimizeLayout(analysis);
    const edge = optimizedLayout.edges.find((item) => item.id === 'r2')!;
    const topY = Math.min(...optimizedLayout.groups.map((group) => group.y));

    expect(edge.shape).toBe('elbow');
    expect(edge.routing).toBeDefined();
    expect(edge.routing!.length).toBeGreaterThan(2);
    expect(Math.min(...edge.routing!.map((point) => point[1]))).toBeLessThan(topY);
  });

  it('routes annotative edges through the lower corridor instead of the middle of modules', () => {
    const optimizedLayout = optimizeLayout(analysis);
    const edge = optimizedLayout.edges.find((item) => item.id === 'r4')!;
    const bottomY = Math.max(
      ...optimizedLayout.groups.map((group) => group.y + group.height)
    );

    expect(edge.shape).toBe('elbow');
    expect(edge.routing).toBeDefined();
    expect(Math.max(...edge.routing!.map((point) => point[1]))).toBeGreaterThan(
      bottomY
    );
  });
});
