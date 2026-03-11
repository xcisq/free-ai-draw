import {
  validateAnalysisResult,
  validateExtractionResult,
} from './validator';

describe('PaperDraw validator', () => {
  it('normalizes duplicate entities and fills sequential fallback', () => {
    const result = validateExtractionResult({
      entities: [
        { id: 'e1', label: '收集数据', confidence: 0.9 },
        { id: 'e2', label: ' 收集数据 ', confidence: 0.7 },
        { id: 'e3', label: '训练模型', confidence: 0.8 },
      ],
      relations: [],
    });

    expect(result.entities).toHaveLength(2);
    expect(result.relations.some((relation) => relation.type === 'sequential')).toBe(true);
    expect(result.warnings?.length).toBeGreaterThan(0);
  });

  it('fills missing weights and removes invalid modules', () => {
    const analysis = validateAnalysisResult({
      entities: [
        { id: 'e1', label: '收集数据' },
        { id: 'e2', label: '训练模型' },
      ],
      relations: [
        { id: 'r1', type: 'sequential', source: 'e1', target: 'e2' },
      ],
      weights: {},
      modules: [
        {
          id: 'm1',
          type: 'modular',
          moduleLabel: '无效模块',
          entityIds: ['e1'],
        },
      ],
    });

    expect(analysis.weights['e1']).toBe(0.5);
    expect(analysis.modules).toHaveLength(0);
  });
});
