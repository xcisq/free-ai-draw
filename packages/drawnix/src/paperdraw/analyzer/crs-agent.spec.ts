import {
  generateDefaultAnalysis,
  generateQuestions,
  mergeLocalAnswers,
} from './crs-agent';
import { ExtractionResult } from '../types/analyzer';

const extraction: ExtractionResult = {
  entities: [
    { id: 'e1', label: '输入数据', confidence: 0.95 },
    { id: 'e2', label: '预处理数据', confidence: 0.72 },
    { id: 'e3', label: '提取特征', confidence: 0.7 },
    { id: 'e4', label: '融合特征', confidence: 0.4 },
    { id: 'e5', label: '输出结果', confidence: 0.88 },
  ],
  relations: [
    { id: 'r1', type: 'sequential', source: 'e1', target: 'e2' },
    { id: 'r2', type: 'sequential', source: 'e2', target: 'e3' },
    { id: 'r3', type: 'sequential', source: 'e3', target: 'e4' },
    { id: 'r4', type: 'sequential', source: 'e4', target: 'e5' },
  ],
  modules: [
    {
      id: 'm1',
      label: '数据准备',
      entityIds: ['e1', 'e2'],
      order: 1,
      confidence: 0.8,
    },
    {
      id: 'm2',
      label: '建模推理',
      entityIds: ['e3', 'e4', 'e5'],
      order: 2,
      confidence: 0.5,
    },
  ],
  spineCandidate: ['e1', 'e2', 'e3', 'e5'],
};

const structureExtraction: ExtractionResult = {
  entities: [
    { id: 's1', label: '输入图像', confidence: 0.95, roleCandidate: 'media' },
    { id: 's2', label: '编码特征', confidence: 0.9 },
    { id: 's3', label: '控制参数', confidence: 0.88, roleCandidate: 'parameter' },
    { id: 's4', label: '辅助解码', confidence: 0.76, roleCandidate: 'decoder' },
    { id: 's5', label: '汇聚输出', confidence: 0.92 },
  ],
  relations: [
    { id: 'sr1', type: 'sequential', source: 's1', target: 's2', roleCandidate: 'main' },
    { id: 'sr2', type: 'annotative', source: 's3', target: 's2', roleCandidate: 'control' },
    { id: 'sr3', type: 'sequential', source: 's2', target: 's5', roleCandidate: 'main' },
    { id: 'sr4', type: 'sequential', source: 's4', target: 's5', roleCandidate: 'auxiliary' },
  ],
  modules: [
    {
      id: 'sm1',
      label: '输入编码',
      entityIds: ['s1', 's2'],
      order: 1,
      confidence: 0.9,
    },
    {
      id: 'sm2',
      label: '控制条件',
      entityIds: ['s2', 's3'],
      order: 2,
      confidence: 0.85,
    },
    {
      id: 'sm3',
      label: '辅助分支',
      entityIds: ['s4', 's5'],
      order: 3,
      confidence: 0.78,
    },
  ],
  spineCandidate: ['s1', 's2', 's4', 's5'],
};

describe('PaperDraw local QA agent', () => {
  it('generates questions from modules, low confidence items and importance candidates', () => {
    const questions = generateQuestions(extraction);

    expect(questions.some((question) => question.type === 'module_grouping')).toBe(true);
    expect(questions.some((question) => question.type === 'low_confidence')).toBe(true);
    expect(questions.some((question) => question.type === 'importance_ranking')).toBe(true);
  });

  it('merges answers into a module-preserving local analysis result', () => {
    const questions = generateQuestions(extraction);
    const analysis = mergeLocalAnswers(
      extraction,
      [
        {
          questionId: 'q-low-confidence-1',
          selectedOptions: ['忽略'],
        },
        {
          questionId: 'q-importance-1',
          selectedOptions: ['输出结果'],
        },
      ],
      questions
    );

    expect(analysis.entities.find((entity) => entity.id === 'e4')).toBeUndefined();
    expect(analysis.relations.every((relation) => relation.type !== 'modular')).toBe(true);
    expect(analysis.weights['e5']).toBe(0.9);
    expect(analysis.modules).toHaveLength(2);
  });

  it('builds default analysis without falling back to modular relations', () => {
    const analysis = generateDefaultAnalysis(extraction);

    expect(analysis.entities).toHaveLength(5);
    expect(analysis.modules).toHaveLength(2);
    expect(analysis.relations.every((relation) => relation.type !== 'modular')).toBe(true);
    expect(analysis.spineCandidate).toEqual(['e1', 'e2', 'e3', 'e5']);
  });

  it('preserves spine candidates after filtering low-confidence entities', () => {
    const questions = generateQuestions(extraction);
    const analysis = mergeLocalAnswers(
      extraction,
      [
        {
          questionId: 'q-low-confidence-1',
          selectedOptions: ['忽略'],
        },
      ],
      questions
    );

    expect(analysis.spineCandidate).toEqual(['e1', 'e2', 'e3', 'e5']);
  });

  it('generates structure-level questions for spine, relation pruning and module roles', () => {
    const questions = generateQuestions(structureExtraction);

    expect(questions.some((question) => question.type === 'spine_selection')).toBe(true);
    expect(questions.some((question) => question.type === 'relation_pruning')).toBe(true);
    expect(
      questions.some(
        (question) =>
          question.type === 'module_role_assignment' &&
          question.targetRoleCandidate === 'control_stage'
      )
    ).toBe(true);
    expect(
      questions.some(
        (question) =>
          question.type === 'module_role_assignment' &&
          question.targetRoleCandidate === 'auxiliary_stage'
      )
    ).toBe(true);
  });

  it('merges structure answers into spine, relation pruning and module roles', () => {
    const questions = generateQuestions(structureExtraction);
    const relationQuestion = questions.find(
      (question) => question.type === 'relation_pruning'
    )!;
    const controlQuestion = questions.find(
      (question) =>
        question.type === 'module_role_assignment' &&
        question.targetRoleCandidate === 'control_stage'
    )!;
    const auxiliaryQuestion = questions.find(
      (question) =>
        question.type === 'module_role_assignment' &&
        question.targetRoleCandidate === 'auxiliary_stage'
    )!;

    const analysis = mergeLocalAnswers(
      structureExtraction,
      [
        {
          questionId: 'q-spine-1',
          selectedOptions: ['输入图像', '编码特征', '汇聚输出'],
        },
        {
          questionId: relationQuestion.id,
          selectedOptions: relationQuestion.options.filter((option) =>
            option.includes('控制参数 -> 编码特征')
          ),
        },
        {
          questionId: controlQuestion.id,
          selectedOptions: ['控制条件'],
        },
        {
          questionId: auxiliaryQuestion.id,
          selectedOptions: ['辅助分支'],
        },
      ],
      questions
    );

    expect(analysis.spineCandidate).toEqual(['s1', 's2', 's5']);
    expect(analysis.relations.map((relation) => relation.id)).toEqual([
      'sr1',
      'sr3',
      'sr4',
    ]);
    expect(
      analysis.modules.find((moduleItem) => moduleItem.label === '控制条件')?.roleCandidate
    ).toBe('control_stage');
    expect(
      analysis.modules.find((moduleItem) => moduleItem.label === '辅助分支')?.roleCandidate
    ).toBe('auxiliary_stage');
    expect(analysis.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('本地 QA 已移除 1 条说明性或辅助连线'),
        expect.stringContaining('本地 QA 已确认主干候选'),
        expect.stringContaining('本地 QA 已确认 2 个模块角色'),
      ])
    );
  });
});
