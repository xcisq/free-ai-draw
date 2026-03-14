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

  it('matches spine-lower-branch from topology even when labels are generic', () => {
    const analysis: AnalysisResult = {
      entities: [
        { id: 'n1', label: 'Input' },
        { id: 'n2', label: 'Stage 1' },
        { id: 'n3', label: 'Stage 2' },
        { id: 'n4', label: 'Stage 3' },
        { id: 'n5', label: 'Branch Node' },
        { id: 'n6', label: 'Branch Output' },
      ],
      relations: [
        { id: 'r1', type: 'sequential', source: 'n1', target: 'n2' },
        { id: 'r2', type: 'sequential', source: 'n2', target: 'n3' },
        { id: 'r3', type: 'sequential', source: 'n3', target: 'n4' },
        { id: 'r4', type: 'sequential', source: 'n2', target: 'n5' },
        { id: 'r5', type: 'sequential', source: 'n5', target: 'n6' },
      ],
      weights: { n1: 0.9, n2: 0.88, n3: 0.86, n4: 0.91, n5: 0.55, n6: 0.58 },
      modules: [
        { id: 'm1', label: 'Input', entityIds: ['n1'], order: 1 },
        { id: 'm2', label: 'Core A', entityIds: ['n2', 'n3'], order: 2 },
        { id: 'm3', label: 'Branch', entityIds: ['n5', 'n6'], order: 3 },
        { id: 'm4', label: 'Core B', entityIds: ['n4'], order: 4 },
      ],
    };

    expect(matchTemplate(analysis).rootTemplateId).toBe('spine-lower-branch');
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

    const match = matchTemplate(analysis);

    expect(match.rootTemplateId).toBe('split-merge');
    expect(match.localTemplateIds).toEqual(
      expect.arrayContaining(['small-fan-out', 'small-fan-in'])
    );
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

  it('matches split-merge when an explicit aggregator augments a branch merge cluster', () => {
    const analysis: AnalysisResult = {
      entities: [
        { id: 'n1', label: 'Input' },
        { id: 'n2', label: 'Main Stage' },
        { id: 'n3', label: 'Aux Branch' },
        { id: 'n4', label: 'Fusion Node', roleCandidate: 'aggregator' },
        { id: 'n5', label: 'Output' },
      ],
      relations: [
        { id: 'r1', type: 'sequential', source: 'n1', target: 'n2' },
        { id: 'r2', type: 'sequential', source: 'n2', target: 'n3' },
        { id: 'r3', type: 'sequential', source: 'n2', target: 'n4' },
        { id: 'r4', type: 'sequential', source: 'n4', target: 'n5' },
      ],
      weights: { n1: 0.9, n2: 0.86, n3: 0.62, n4: 0.94, n5: 0.88 },
      modules: [
        { id: 'm1', label: 'Input', entityIds: ['n1'], order: 1 },
        { id: 'm2', label: 'Core', entityIds: ['n2', 'n4'], order: 2 },
        { id: 'm3', label: 'Aux Branch', entityIds: ['n3'], order: 3 },
        { id: 'm4', label: 'Output', entityIds: ['n5'], order: 4 },
      ],
      spineCandidate: ['n1', 'n2', 'n4', 'n5'],
    };

    const match = matchTemplate(analysis);

    expect(match.rootTemplateId).toBe('split-merge');
    expect(match.features.mergeClusterCount).toBeGreaterThan(0);
  });

  it('matches top-control-main-bottom-aux when control and auxiliary rails are both explicit', () => {
    const analysis: AnalysisResult = {
      entities: [
        { id: 'n1', label: 'Input Image', roleCandidate: 'media' },
        { id: 'n2', label: 'Main Encoder' },
        { id: 'n3', label: 'Control Prompt', roleCandidate: 'parameter' },
        { id: 'n4', label: 'Aux Decoder', roleCandidate: 'decoder' },
        { id: 'n5', label: 'Output State', roleCandidate: 'output' },
      ],
      relations: [
        { id: 'r1', type: 'sequential', source: 'n1', target: 'n2', roleCandidate: 'main' },
        { id: 'r2', type: 'annotative', source: 'n3', target: 'n2', roleCandidate: 'control' },
        { id: 'r3', type: 'sequential', source: 'n2', target: 'n4', roleCandidate: 'auxiliary' },
        { id: 'r4', type: 'sequential', source: 'n2', target: 'n5', roleCandidate: 'main' },
      ],
      weights: { n1: 0.9, n2: 0.88, n3: 0.74, n4: 0.66, n5: 0.9 },
      modules: [
        { id: 'm1', label: 'Input', entityIds: ['n1'], order: 1, roleCandidate: 'input_stage' },
        { id: 'm2', label: 'Core', entityIds: ['n2', 'n5'], order: 2, roleCandidate: 'core_stage' },
        { id: 'm3', label: 'Control', entityIds: ['n3'], order: 3, roleCandidate: 'control_stage' },
        { id: 'm4', label: 'Auxiliary', entityIds: ['n4'], order: 4, roleCandidate: 'auxiliary_stage' },
      ],
      spineCandidate: ['n1', 'n2', 'n5'],
    };

    const match = matchTemplate(analysis);

    expect(match.rootTemplateId).toBe('top-control-main-bottom-aux');
    expect(match.features.topControlCount).toBeGreaterThan(0);
    expect(match.features.bottomAuxCount).toBeGreaterThan(0);
  });
});
