import {
  generateDefaultAnalysis,
  generateQuestions,
  mergeLocalAnswers,
} from './crs-agent';
import { ExtractionResult } from '../types/analyzer';

const extraction: ExtractionResult = {
  entities: [
    { id: 'e1', label: '收集数据', confidence: 0.95 },
    { id: 'e2', label: '清洗数据', confidence: 0.7 },
    { id: 'e3', label: '训练模型', confidence: 0.4 },
  ],
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
};

describe('PaperDraw local QA agent', () => {
  it('generates local questions from modular relations and low confidence entities', () => {
    const questions = generateQuestions(extraction);

    expect(questions).toHaveLength(2);
    expect(questions[0].type).toBe('module_grouping');
    expect(questions[1].type).toBe('importance_ranking');
  });

  it('merges answers into local analysis result', () => {
    const questions = generateQuestions(extraction);
    const analysis = mergeLocalAnswers(
      extraction,
      [
        {
          questionId: 'q-importance-1',
          selectedOptions: ['训练模型'],
        },
      ],
      questions
    );

    expect(analysis.weights['e3']).toBe(0.9);
    expect(analysis.modules).toHaveLength(1);
  });

  it('builds default analysis without extra model calls', () => {
    const analysis = generateDefaultAnalysis(extraction);
    expect(analysis.entities).toHaveLength(3);
    expect(analysis.relations.length).toBeGreaterThanOrEqual(2);
  });
});
