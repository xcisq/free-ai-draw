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
  });
});
