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
    { id: 'sr5', type: 'sequential', source: 's5', target: 's2' },
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

const ambiguousModuleRoleExtraction: ExtractionResult = {
  entities: [
    { id: 'a1', label: '输入图像', confidence: 0.95, roleCandidate: 'media' },
    { id: 'a2', label: '主干特征', confidence: 0.91 },
    { id: 'a3', label: '控制参数', confidence: 0.84, roleCandidate: 'parameter' },
    { id: 'a4', label: '控制提示', confidence: 0.8, roleCandidate: 'parameter' },
    { id: 'a5', label: '辅助解码', confidence: 0.78, roleCandidate: 'decoder' },
    { id: 'a6', label: '辅助预测', confidence: 0.74, roleCandidate: 'decoder' },
    { id: 'a7', label: '输出结果', confidence: 0.92, roleCandidate: 'output' },
  ],
  relations: [
    { id: 'ar1', type: 'sequential', source: 'a1', target: 'a2', roleCandidate: 'main' },
    { id: 'ar2', type: 'annotative', source: 'a3', target: 'a2', roleCandidate: 'control' },
    { id: 'ar3', type: 'annotative', source: 'a4', target: 'a2', roleCandidate: 'control' },
    { id: 'ar4', type: 'sequential', source: 'a2', target: 'a5', roleCandidate: 'auxiliary' },
    { id: 'ar5', type: 'sequential', source: 'a2', target: 'a7', roleCandidate: 'main' },
    { id: 'ar6', type: 'sequential', source: 'a2', target: 'a6', roleCandidate: 'auxiliary' },
  ],
  modules: [
    { id: 'am1', label: '输入编码', entityIds: ['a1', 'a2'], order: 1, confidence: 0.9 },
    {
      id: 'am2',
      label: '控制条件',
      entityIds: ['a2', 'a3'],
      order: 2,
      confidence: 0.83,
      roleCandidate: 'control_stage',
    },
    { id: 'am3', label: '控制提示', entityIds: ['a3', 'a4'], order: 3, confidence: 0.82 },
    {
      id: 'am4',
      label: '辅助分支',
      entityIds: ['a2', 'a5'],
      order: 4,
      confidence: 0.8,
      roleCandidate: 'auxiliary_stage',
    },
    { id: 'am5', label: '辅助解码', entityIds: ['a5', 'a6'], order: 5, confidence: 0.79 },
  ],
  spineCandidate: ['a1', 'a2', 'a7'],
};

const flattenedLinearExtraction: ExtractionResult = {
  entities: [
    { id: 'f1', label: '原始文本', confidence: 0.95 },
    { id: 'f2', label: '文本解析', confidence: 0.92 },
    { id: 'f3', label: '关系抽取', confidence: 0.9 },
    { id: 'f4', label: '结构校验', confidence: 0.88 },
    { id: 'f5', label: '布局生成', confidence: 0.91 },
    { id: 'f6', label: '路由优化', confidence: 0.89 },
    { id: 'f7', label: '图形输出', confidence: 0.94 },
    { id: 'f8', label: '结果展示', confidence: 0.93 },
  ],
  relations: [
    { id: 'fr1', type: 'sequential', source: 'f1', target: 'f2' },
    { id: 'fr2', type: 'sequential', source: 'f2', target: 'f3' },
    { id: 'fr3', type: 'sequential', source: 'f3', target: 'f4' },
    { id: 'fr4', type: 'sequential', source: 'f4', target: 'f5' },
    { id: 'fr5', type: 'sequential', source: 'f5', target: 'f6' },
    { id: 'fr6', type: 'sequential', source: 'f6', target: 'f7' },
    { id: 'fr7', type: 'sequential', source: 'f7', target: 'f8' },
  ],
  modules: [
    { id: 'fm1', label: '输入准备', entityIds: ['f1', 'f2'], order: 1, confidence: 0.9 },
    { id: 'fm2', label: '语义分析', entityIds: ['f3', 'f4'], order: 2, confidence: 0.88 },
    { id: 'fm3', label: '布局推理', entityIds: ['f5', 'f6'], order: 3, confidence: 0.87 },
    { id: 'fm4', label: '输出生成', entityIds: ['f7', 'f8'], order: 4, confidence: 0.91 },
  ],
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
    expect(questions.some((question) => question.type === 'merge_node_selection')).toBe(true);
    expect(questions.some((question) => question.type === 'feedback_edge_selection')).toBe(true);
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
    const mergeQuestion = questions.find(
      (question) => question.type === 'merge_node_selection'
    )!;
    const feedbackQuestion = questions.find(
      (question) => question.type === 'feedback_edge_selection'
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
          questionId: mergeQuestion.id,
          selectedOptions: ['汇聚输出'],
        },
        {
          questionId: feedbackQuestion.id,
          selectedOptions: feedbackQuestion.options,
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
      'sr5',
    ]);
    expect(
      analysis.entities.find((entity) => entity.id === 's5')?.roleCandidate
    ).toBe('aggregator');
    expect(
      analysis.relations.find((relation) => relation.id === 'sr5')?.roleCandidate
    ).toBe('feedback');
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
        expect.stringContaining('本地 QA 已确认 1 个汇聚节点'),
        expect.stringContaining('本地 QA 已确认 1 条反馈边'),
        expect.stringContaining('本地 QA 已确认 2 个模块角色'),
      ])
    );
  });

  it('keeps asking module role questions when existing control or auxiliary roles are structurally ambiguous', () => {
    const questions = generateQuestions(ambiguousModuleRoleExtraction);

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

  it('reassigns module roles from mixed modules to QA-confirmed pure modules', () => {
    const questions = generateQuestions(ambiguousModuleRoleExtraction);
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
      ambiguousModuleRoleExtraction,
      [
        {
          questionId: controlQuestion.id,
          selectedOptions: ['控制提示'],
        },
        {
          questionId: auxiliaryQuestion.id,
          selectedOptions: ['辅助解码'],
        },
      ],
      questions
    );

    expect(
      analysis.modules.find((moduleItem) => moduleItem.label === '控制条件')?.roleCandidate
    ).toBeUndefined();
    expect(
      analysis.modules.find((moduleItem) => moduleItem.label === '辅助分支')?.roleCandidate
    ).toBeUndefined();
    expect(
      analysis.modules.find((moduleItem) => moduleItem.label === '控制提示')?.roleCandidate
    ).toBe('control_stage');
    expect(
      analysis.modules.find((moduleItem) => moduleItem.label === '辅助解码')?.roleCandidate
    ).toBe('auxiliary_stage');
    expect(analysis.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('本地 QA 已确认 2 个模块角色')])
    );
  });

  it('adds a main-module confirmation question for flattened linear flows', () => {
    const questions = generateQuestions(flattenedLinearExtraction);

    expect(
      questions.some((question) => question.type === 'main_module_selection')
    ).toBe(true);
    expect(
      questions.some((question) => question.type === 'spine_selection')
    ).toBe(false);
  });

  it('moves unselected middle modules off the main spine after linear-flow confirmation', () => {
    const questions = generateQuestions(flattenedLinearExtraction);
    const mainModuleQuestion = questions.find(
      (question) => question.type === 'main_module_selection'
    )!;

    const analysis = mergeLocalAnswers(
      flattenedLinearExtraction,
      [
        {
          questionId: mainModuleQuestion.id,
          selectedOptions: ['语义分析'],
        },
      ],
      questions
    );

    expect(analysis.spineCandidate).toEqual(['f1', 'f2', 'f3', 'f4', 'f7', 'f8']);
    expect(
      analysis.modules.find((moduleItem) => moduleItem.label === '布局推理')?.roleCandidate
    ).toBe('auxiliary_stage');
    expect(
      analysis.relations.find((relation) => relation.id === 'fr4')?.roleCandidate
    ).toBe('auxiliary');
    expect(
      analysis.relations.find((relation) => relation.id === 'fr1')?.roleCandidate
    ).toBe('main');
    expect(analysis.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('本地 QA 已确认主干模块'),
      ])
    );
  });

  it('warns before generating a draft when the extraction still looks like a single path', () => {
    const analysis = generateDefaultAnalysis(flattenedLinearExtraction);

    expect(analysis.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('当前文本更像单一路径流程'),
      ])
    );
  });
});
