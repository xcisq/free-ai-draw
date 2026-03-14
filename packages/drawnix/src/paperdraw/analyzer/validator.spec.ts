import {
  validateAnalysisResult,
  validateExtractionResult,
} from './validator';

describe('PaperDraw validator', () => {
  it('normalizes legacy modular relations into explicit modules', () => {
    const result = validateExtractionResult({
      entities: [
        { id: 'e1', label: '收集数据', confidence: 0.9 },
        { id: 'e2', label: '清洗数据', confidence: 0.7 },
        { id: 'e3', label: '训练模型', confidence: 0.8 },
      ],
      modules: [],
      relations: [
        { id: 'r1', type: 'sequential', source: 'e1', target: 'e2' },
        { id: 'r2', type: 'sequential', source: 'e2', target: 'e3' },
        {
          id: 'r3',
          type: 'modular',
          moduleLabel: '数据准备',
          entityIds: ['e1', 'e2'],
        },
      ],
    });

    expect(result.modules).toHaveLength(1);
    expect(result.modules[0].label).toBe('数据准备');
    expect(result.relations.every((relation) => relation.type !== 'modular')).toBe(true);
  });

  it('rebuilds modules when a complex flow has no module candidates', () => {
    const result = validateExtractionResult({
      entities: [
        { id: 'e1', label: '输入数据' },
        { id: 'e2', label: '预处理数据' },
        { id: 'e3', label: '提取特征' },
        { id: 'e4', label: '融合特征' },
        { id: 'e5', label: '输出结果' },
      ],
      modules: [],
      relations: [
        { id: 'r1', type: 'sequential', source: 'e1', target: 'e2' },
        { id: 'r2', type: 'sequential', source: 'e2', target: 'e3' },
        { id: 'r3', type: 'sequential', source: 'e3', target: 'e4' },
        { id: 'r4', type: 'sequential', source: 'e4', target: 'e5' },
      ],
    });

    expect(result.modules.length).toBeGreaterThanOrEqual(2);
    expect(result.modules.every((moduleItem) => moduleItem.entityIds.length >= 2)).toBe(true);
  });

  it('fills missing weights and filters singleton modules', () => {
    const analysis = validateAnalysisResult({
      entities: [
        { id: 'e1', label: '收集数据' },
        { id: 'e2', label: '清洗数据' },
        { id: 'e3', label: '训练模型' },
      ],
      relations: [
        { id: 'r1', type: 'sequential', source: 'e1', target: 'e2' },
        { id: 'r2', type: 'sequential', source: 'e2', target: 'e3' },
      ],
      weights: {},
      modules: [
        {
          id: 'm1',
          label: '无效模块',
          entityIds: ['e1'],
        },
        {
          id: 'm2',
          label: '数据准备',
          entityIds: ['e1', 'e2'],
        },
      ],
    });

    expect(analysis.weights['e1']).toBe(0.5);
    expect(analysis.modules).toHaveLength(1);
    expect(analysis.modules[0].label).toBe('数据准备');
  });

  it('preserves explicit semantic candidates when they are valid', () => {
    const analysis = validateAnalysisResult({
      entities: [
        { id: 'e1', label: '输入图像', roleCandidate: 'media' },
        { id: 'e2', label: '控制参数', roleCandidate: 'parameter' },
        { id: 'e3', label: '输出结果', roleCandidate: 'output' },
      ],
      relations: [
        {
          id: 'r1',
          type: 'sequential',
          source: 'e1',
          target: 'e3',
          roleCandidate: 'main',
        },
        {
          id: 'r2',
          type: 'annotative',
          source: 'e2',
          target: 'e3',
          roleCandidate: 'control',
        },
      ],
      weights: {},
      modules: [
        {
          id: 'm1',
          label: '输入区',
          entityIds: ['e1', 'e2'],
          roleCandidate: 'input_stage',
        },
        {
          id: 'm2',
          label: '输出区',
          entityIds: ['e3', 'e2'],
          roleCandidate: 'output_stage',
        },
      ],
      spineCandidate: ['e1', 'e3'],
    });

    expect(analysis.entities[0].roleCandidate).toBe('media');
    expect(analysis.relations[0].roleCandidate).toBe('main');
    expect(analysis.modules[0].roleCandidate).toBe('input_stage');
    expect(analysis.spineCandidate).toEqual(['e1', 'e3']);
  });
});
