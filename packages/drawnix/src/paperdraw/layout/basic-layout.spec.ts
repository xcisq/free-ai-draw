import { basicLayout } from './basic-layout';
import { AnalysisResult } from '../types/analyzer';

const analysis: AnalysisResult = {
  entities: [
    { id: 'e1', label: '收集数据', confidence: 0.9 },
    { id: 'e2', label: '清洗数据', confidence: 0.8 },
    { id: 'e3', label: '训练模型', confidence: 0.7 },
  ],
  relations: [
    { id: 'r1', type: 'sequential', source: 'e1', target: 'e2' },
    { id: 'r2', type: 'sequential', source: 'e2', target: 'e3' },
    {
      id: 'm1',
      type: 'modular',
      moduleLabel: '数据准备',
      entityIds: ['e1', 'e2'],
    },
  ],
  weights: {
    e1: 0.6,
    e2: 0.7,
    e3: 0.9,
  },
  modules: [
    {
      id: 'm1',
      type: 'modular',
      moduleLabel: '数据准备',
      entityIds: ['e1', 'e2'],
    },
  ],
};

describe('basicLayout', () => {
  it('places sequential nodes from left to right', () => {
    const layout = basicLayout(analysis);

    expect(layout.nodes).toHaveLength(3);
    expect(layout.nodes[0].x).toBeLessThan(layout.nodes[1].x);
    expect(layout.nodes[1].x).toBeLessThan(layout.nodes[2].x);
  });

  it('creates layout groups from modules', () => {
    const layout = basicLayout(analysis);

    expect(layout.groups).toHaveLength(1);
    expect(layout.groups[0].moduleLabel).toBe('数据准备');
  });
});
