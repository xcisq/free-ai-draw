import type { AnalysisResult } from '../types/analyzer';
import { basicLayout } from './basic-layout';
import { buildLayoutIntent } from './pipeline-layout-intent';
import { matchPipelineTemplates } from './pipeline-template-matcher';

function matchTemplate(analysis: AnalysisResult) {
  const layout = basicLayout(analysis);
  const intent = buildLayoutIntent(analysis, layout);
  return matchPipelineTemplates(intent);
}

describe('pipeline-template-matcher', () => {
  it('matches paired-state-simulator for simulator-centered state updates', () => {
    const analysis: AnalysisResult = {
      entities: [
        { id: 'n1', label: 'Image Input' },
        { id: 'n2', label: 'Encoder' },
        { id: 'n3', label: 'Physics Simulation' },
        { id: 'n4', label: 'Current State' },
        { id: 'n5', label: 'Updated State' },
      ],
      relations: [
        { id: 'r1', type: 'sequential', source: 'n1', target: 'n2' },
        { id: 'r2', type: 'sequential', source: 'n2', target: 'n3' },
        { id: 'r3', type: 'sequential', source: 'n4', target: 'n3' },
        { id: 'r4', type: 'sequential', source: 'n3', target: 'n5' },
      ],
      weights: { n1: 0.9, n2: 0.85, n3: 0.95, n4: 0.6, n5: 0.9 },
      modules: [
        { id: 'm1', label: 'Input', entityIds: ['n1', 'n2'], order: 1 },
        { id: 'm2', label: 'Simulation', entityIds: ['n3'], order: 2 },
        { id: 'm3', label: 'State', entityIds: ['n4', 'n5'], order: 3 },
      ],
    };

    expect(matchTemplate(analysis).rootTemplateId).toBe('paired-state-simulator');
  });

  it('matches split-merge for fan-out and merge structures', () => {
    const analysis: AnalysisResult = {
      entities: [
        { id: 'n1', label: 'Input' },
        { id: 'n2', label: 'Branch A' },
        { id: 'n3', label: 'Branch B' },
        { id: 'n4', label: 'Fusion' },
        { id: 'n5', label: 'Output' },
      ],
      relations: [
        { id: 'r1', type: 'sequential', source: 'n1', target: 'n2' },
        { id: 'r2', type: 'sequential', source: 'n1', target: 'n3' },
        { id: 'r3', type: 'sequential', source: 'n2', target: 'n4' },
        { id: 'r4', type: 'sequential', source: 'n3', target: 'n4' },
        { id: 'r5', type: 'sequential', source: 'n4', target: 'n5' },
      ],
      weights: { n1: 0.9, n2: 0.7, n3: 0.7, n4: 0.95, n5: 0.9 },
      modules: [
        { id: 'm1', label: 'Input', entityIds: ['n1'], order: 1 },
        { id: 'm2', label: 'Branch', entityIds: ['n2', 'n3'], order: 2 },
        { id: 'm3', label: 'Merge', entityIds: ['n4', 'n5'], order: 3 },
      ],
    };

    expect(matchTemplate(analysis).rootTemplateId).toBe('split-merge');
  });

  it('falls back to input-core-output when the graph is mostly a left-to-right pipeline', () => {
    const analysis: AnalysisResult = {
      entities: [
        { id: 'n1', label: 'Raw Input' },
        { id: 'n2', label: 'Feature Extractor' },
        { id: 'n3', label: 'Predictor' },
        { id: 'n4', label: 'Output Result' },
      ],
      relations: [
        { id: 'r1', type: 'sequential', source: 'n1', target: 'n2' },
        { id: 'r2', type: 'sequential', source: 'n2', target: 'n3' },
        { id: 'r3', type: 'sequential', source: 'n3', target: 'n4' },
      ],
      weights: { n1: 0.9, n2: 0.85, n3: 0.82, n4: 0.9 },
      modules: [
        { id: 'm1', label: 'Input', entityIds: ['n1'], order: 1 },
        { id: 'm2', label: 'Core', entityIds: ['n2', 'n3'], order: 2 },
        { id: 'm3', label: 'Output', entityIds: ['n4'], order: 3 },
      ],
    };

    expect(matchTemplate(analysis).rootTemplateId).toBe('input-core-output');
  });
});
