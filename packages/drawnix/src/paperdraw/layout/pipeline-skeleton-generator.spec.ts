import type {
  AnalysisResult,
  PipelineLocalTemplateId,
  PipelineTemplateId,
  TemplateFitFeatures,
} from '../types/analyzer';
import { basicLayout } from './basic-layout';
import { buildLayoutIntent } from './pipeline-layout-intent';
import { generatePipelineSkeletonLayout } from './pipeline-skeleton-generator';

const EMPTY_FEATURES: TemplateFitFeatures = {
  spineLength: 0,
  spineSegmentCount: 0,
  branchCount: 0,
  branchAttachmentCount: 0,
  mergeCount: 0,
  mergeClusterCount: 0,
  feedbackCount: 0,
  inputContainerCount: 0,
  inputModuleCount: 0,
  stateNodeCount: 0,
  statePairCount: 0,
  simulatorNodeCount: 0,
  topControlCount: 0,
  bottomAuxCount: 0,
  outputNodeCount: 0,
  inputZoneScore: 0,
  controlZoneScore: 0,
  auxZoneScore: 0,
  outputZoneScore: 0,
};

function createTemplateMatch(
  rootTemplateId: PipelineTemplateId,
  localTemplateIds: PipelineLocalTemplateId[] = []
) {
  return {
    rootTemplateId,
    localTemplateIds,
    features: EMPTY_FEATURES,
  };
}

describe('pipeline-skeleton-generator', () => {
  it('builds an input-core-output skeleton with left, center, and right regions', () => {
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

    const baseLayout = basicLayout(analysis);
    const intent = buildLayoutIntent(analysis, baseLayout);
    const layout = generatePipelineSkeletonLayout(
      baseLayout,
      intent,
      createTemplateMatch('input-core-output')
    );
    const nodeMap = new Map(layout.nodes.map((node) => [node.id, node]));

    expect(nodeMap.get('n1')!.x).toBeLessThan(nodeMap.get('n2')!.x);
    expect(nodeMap.get('n4')!.x).toBeGreaterThan(nodeMap.get('n3')!.x);
    expect(nodeMap.get('n1')!.y).not.toBe(nodeMap.get('n2')!.y);
  });

  it('builds a spine-lower-branch skeleton with auxiliary nodes below the main spine', () => {
    const analysis: AnalysisResult = {
      entities: [
        { id: 'n1', label: 'Input' },
        { id: 'n2', label: 'Encoder' },
        { id: 'n3', label: 'Decoder Branch' },
        { id: 'n4', label: 'Fusion' },
        { id: 'n5', label: 'Output' },
      ],
      relations: [
        { id: 'r1', type: 'sequential', source: 'n1', target: 'n2' },
        { id: 'r2', type: 'sequential', source: 'n2', target: 'n4' },
        { id: 'r3', type: 'sequential', source: 'n3', target: 'n4' },
        { id: 'r4', type: 'sequential', source: 'n4', target: 'n5' },
      ],
      weights: { n1: 0.9, n2: 0.88, n3: 0.6, n4: 0.93, n5: 0.89 },
      modules: [
        { id: 'm1', label: 'Input', entityIds: ['n1', 'n2'], order: 1 },
        { id: 'm2', label: 'Aux Decoder', entityIds: ['n3'], order: 2 },
        { id: 'm3', label: 'Core', entityIds: ['n4', 'n5'], order: 3 },
      ],
    };

    const baseLayout = basicLayout(analysis);
    const intent = buildLayoutIntent(analysis, baseLayout);
    const layout = generatePipelineSkeletonLayout(
      baseLayout,
      intent,
      createTemplateMatch('spine-lower-branch')
    );
    const nodeMap = new Map(layout.nodes.map((node) => [node.id, node]));

    expect(nodeMap.get('n3')!.y).toBeGreaterThan(nodeMap.get('n2')!.y);
    expect(nodeMap.get('n3')!.y).toBeGreaterThan(nodeMap.get('n4')!.y);
    expect(nodeMap.get('n1')!.x).toBeLessThan(nodeMap.get('n4')!.x);
  });

  it('builds a split-merge skeleton with branch nodes separated from the merge target', () => {
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
      weights: { n1: 0.9, n2: 0.72, n3: 0.71, n4: 0.94, n5: 0.89 },
      modules: [
        { id: 'm1', label: 'Input', entityIds: ['n1'], order: 1 },
        { id: 'm2', label: 'Aux Branch A', entityIds: ['n2'], order: 2 },
        { id: 'm3', label: 'Aux Branch B', entityIds: ['n3'], order: 3 },
        { id: 'm4', label: 'Merge', entityIds: ['n4', 'n5'], order: 4 },
      ],
    };

    const baseLayout = basicLayout(analysis);
    const intent = buildLayoutIntent(analysis, baseLayout);
    const layout = generatePipelineSkeletonLayout(
      baseLayout,
      intent,
      createTemplateMatch('split-merge')
    );
    const nodeMap = new Map(layout.nodes.map((node) => [node.id, node]));

    expect(nodeMap.get('n2')!.y).not.toBe(nodeMap.get('n3')!.y);
    expect(nodeMap.get('n2')!.x).toBeGreaterThan(nodeMap.get('n1')!.x);
    expect(nodeMap.get('n3')!.x).toBeGreaterThan(nodeMap.get('n1')!.x);
    expect(nodeMap.get('n4')!.x).toBeGreaterThanOrEqual(nodeMap.get('n2')!.x);
    expect(nodeMap.get('n4')!.x).toBeGreaterThan(nodeMap.get('n3')!.x);
  });

  it('builds a top-control-main-bottom-aux skeleton with clear vertical rail separation', () => {
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

    const baseLayout = basicLayout(analysis);
    const intent = buildLayoutIntent(analysis, baseLayout);
    const layout = generatePipelineSkeletonLayout(
      baseLayout,
      intent,
      createTemplateMatch('top-control-main-bottom-aux')
    );
    const nodeMap = new Map(layout.nodes.map((node) => [node.id, node]));

    expect(nodeMap.get('n3')!.y).toBeLessThan(nodeMap.get('n2')!.y);
    expect(nodeMap.get('n4')!.y).toBeGreaterThan(nodeMap.get('n2')!.y);
    expect(Math.abs(nodeMap.get('n3')!.x - nodeMap.get('n2')!.x)).toBeLessThanOrEqual(40);
    expect(Math.abs(nodeMap.get('n4')!.x - nodeMap.get('n2')!.x)).toBeLessThanOrEqual(40);
  });

  it('stacks control over main and auxiliary under main inside mixed-role modules', () => {
    const analysis: AnalysisResult = {
      entities: [
        { id: 'n1', label: 'Input', roleCandidate: 'media' },
        { id: 'n2', label: 'Main Processor' },
        { id: 'n3', label: 'Control Token', roleCandidate: 'parameter' },
        { id: 'n4', label: 'Aux Decoder', roleCandidate: 'decoder' },
        { id: 'n5', label: 'Output', roleCandidate: 'output' },
      ],
      relations: [
        { id: 'r1', type: 'sequential', source: 'n1', target: 'n2', roleCandidate: 'main' },
        { id: 'r2', type: 'annotative', source: 'n3', target: 'n2', roleCandidate: 'control' },
        { id: 'r3', type: 'sequential', source: 'n2', target: 'n4', roleCandidate: 'auxiliary' },
        { id: 'r4', type: 'sequential', source: 'n2', target: 'n5', roleCandidate: 'main' },
      ],
      weights: { n1: 0.9, n2: 0.88, n3: 0.72, n4: 0.66, n5: 0.9 },
      modules: [
        { id: 'm1', label: 'Input', entityIds: ['n1'], order: 1, roleCandidate: 'input_stage' },
        { id: 'm2', label: 'Control Main', entityIds: ['n2', 'n3'], order: 2, roleCandidate: 'core_stage' },
        { id: 'm3', label: 'Main Aux', entityIds: ['n4', 'n5'], order: 3, roleCandidate: 'core_stage' },
      ],
      spineCandidate: ['n1', 'n2', 'n5'],
    };

    const baseLayout = basicLayout(analysis);
    const intent = buildLayoutIntent(analysis, baseLayout);
    const layout = generatePipelineSkeletonLayout(
      baseLayout,
      intent,
      createTemplateMatch('top-control-main-bottom-aux', [
        'control-over-main',
        'aux-under-main',
      ])
    );
    const nodeMap = new Map(layout.nodes.map((node) => [node.id, node]));

    expect(nodeMap.get('n3')!.y).toBeLessThan(nodeMap.get('n2')!.y);
    expect(nodeMap.get('n3')!.x).toBe(nodeMap.get('n2')!.x);
    expect(nodeMap.get('n5')!.y).toBeLessThan(nodeMap.get('n4')!.y);
    expect(nodeMap.get('n5')!.x).toBe(nodeMap.get('n4')!.x);
  });
});
