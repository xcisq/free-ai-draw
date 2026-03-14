import type {
  AnalysisResult,
  PipelineLocalTemplateId,
  PipelineTemplateId,
  TemplateFitFeatures,
} from '../types/analyzer';
import { basicLayout } from './basic-layout';
import { buildLayoutIntent } from './pipeline-layout-intent';
import { buildPipelineBlueprint } from './pipeline-blueprint';
import { generatePipelineSkeletonLayout } from './pipeline-skeleton-generator';

const EMPTY_FEATURES: TemplateFitFeatures = {
  spineLength: 0,
  spineSegmentCount: 0,
  branchCount: 0,
  branchAttachmentCount: 0,
  branchGroupCount: 0,
  branchLaneCount: 0,
  mergeCount: 0,
  mergeClusterCount: 0,
  mergeGroupCount: 0,
  mergeBundleCount: 0,
  feedbackCount: 0,
  feedbackLoopCount: 0,
  inputContainerCount: 0,
  inputModuleCount: 0,
  inputLaneCount: 0,
  stateNodeCount: 0,
  statePairCount: 0,
  simulatorNodeCount: 0,
  topControlCount: 0,
  controlLaneCount: 0,
  bottomAuxCount: 0,
  auxiliaryLaneCount: 0,
  outputNodeCount: 0,
  outputLaneCount: 0,
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

function buildSkeletonLayout(
  analysis: AnalysisResult,
  rootTemplateId: PipelineTemplateId,
  localTemplateIds: PipelineLocalTemplateId[] = []
) {
  const baseLayout = basicLayout(analysis);
  const intent = buildLayoutIntent(analysis, baseLayout);
  const blueprint = buildPipelineBlueprint(analysis, intent);
  return generatePipelineSkeletonLayout(
    baseLayout,
    intent,
    blueprint,
    createTemplateMatch(rootTemplateId, localTemplateIds)
  );
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

    const layout = buildSkeletonLayout(analysis, 'input-core-output');
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

    const layout = buildSkeletonLayout(analysis, 'spine-lower-branch');
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

    const layout = buildSkeletonLayout(analysis, 'split-merge');
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

    const layout = buildSkeletonLayout(analysis, 'top-control-main-bottom-aux');
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

    const layout = buildSkeletonLayout(analysis, 'top-control-main-bottom-aux', [
      'control-over-main',
      'aux-under-main',
    ]);
    const nodeMap = new Map(layout.nodes.map((node) => [node.id, node]));

    expect(nodeMap.get('n3')!.y).toBeLessThan(nodeMap.get('n2')!.y);
    expect(nodeMap.get('n3')!.x).toBe(nodeMap.get('n2')!.x);
    expect(nodeMap.get('n5')!.y).toBeLessThan(nodeMap.get('n4')!.y);
    expect(nodeMap.get('n5')!.x).toBe(nodeMap.get('n4')!.x);
  });

  it('moves off-spine generic branch blocks away from the main rail', () => {
    const analysis: AnalysisResult = {
      entities: [
        { id: 'n1', label: 'Input' },
        { id: 'n2', label: 'Parser' },
        { id: 'n3', label: 'Layout Draft' },
        { id: 'n4', label: 'Route Cleanup' },
        { id: 'n5', label: 'Output' },
      ],
      relations: [
        { id: 'r1', type: 'sequential', source: 'n1', target: 'n2', roleCandidate: 'main' },
        { id: 'r2', type: 'sequential', source: 'n2', target: 'n5', roleCandidate: 'main' },
        { id: 'r3', type: 'sequential', source: 'n2', target: 'n3', roleCandidate: 'auxiliary' },
        { id: 'r4', type: 'sequential', source: 'n3', target: 'n4', roleCandidate: 'auxiliary' },
      ],
      weights: { n1: 0.9, n2: 0.88, n3: 0.75, n4: 0.7, n5: 0.91 },
      modules: [
        { id: 'm1', label: 'Input', entityIds: ['n1'], order: 1 },
        { id: 'm2', label: 'Core', entityIds: ['n2'], order: 2 },
        { id: 'm3', label: 'Draft Branch', entityIds: ['n3', 'n4'], order: 3 },
        { id: 'm4', label: 'Output', entityIds: ['n5'], order: 4 },
      ],
      spineCandidate: ['n1', 'n2', 'n5'],
    };

    const layout = buildSkeletonLayout(analysis, 'spine-lower-branch');
    const nodeMap = new Map(layout.nodes.map((node) => [node.id, node]));

    expect(nodeMap.get('n3')!.y).toBeGreaterThan(nodeMap.get('n2')!.y);
    expect(nodeMap.get('n4')!.y).toBeGreaterThan(nodeMap.get('n2')!.y);
    expect(Math.abs(nodeMap.get('n3')!.x - nodeMap.get('n2')!.x)).toBeLessThanOrEqual(40);
  });

  it('fans out multiple generic branch blocks attached to the same spine node', () => {
    const analysis: AnalysisResult = {
      entities: [
        { id: 'b1', label: 'Input' },
        { id: 'b2', label: 'Core Parser' },
        { id: 'b3', label: 'Branch Draft A' },
        { id: 'b4', label: 'Branch Detail A' },
        { id: 'b5', label: 'Branch Draft B' },
        { id: 'b6', label: 'Branch Detail B' },
        { id: 'b7', label: 'Output' },
      ],
      relations: [
        { id: 'br1', type: 'sequential', source: 'b1', target: 'b2', roleCandidate: 'main' },
        { id: 'br2', type: 'sequential', source: 'b2', target: 'b7', roleCandidate: 'main' },
        { id: 'br3', type: 'sequential', source: 'b2', target: 'b3', roleCandidate: 'auxiliary' },
        { id: 'br4', type: 'sequential', source: 'b3', target: 'b4', roleCandidate: 'auxiliary' },
        { id: 'br5', type: 'sequential', source: 'b2', target: 'b5', roleCandidate: 'auxiliary' },
        { id: 'br6', type: 'sequential', source: 'b5', target: 'b6', roleCandidate: 'auxiliary' },
      ],
      weights: { b1: 0.9, b2: 0.88, b3: 0.71, b4: 0.68, b5: 0.7, b6: 0.67, b7: 0.91 },
      modules: [
        { id: 'bm1', label: 'Input', entityIds: ['b1'], order: 1 },
        { id: 'bm2', label: 'Core', entityIds: ['b2'], order: 2 },
        { id: 'bm3', label: 'Branch A', entityIds: ['b3', 'b4'], order: 3 },
        { id: 'bm4', label: 'Branch B', entityIds: ['b5', 'b6'], order: 4 },
        { id: 'bm5', label: 'Output', entityIds: ['b7'], order: 5 },
      ],
      spineCandidate: ['b1', 'b2', 'b7'],
    };

    const layout = buildSkeletonLayout(analysis, 'spine-lower-branch');
    const nodeMap = new Map(layout.nodes.map((node) => [node.id, node]));

    expect(nodeMap.get('b3')!.y).toBeGreaterThan(nodeMap.get('b2')!.y);
    expect(nodeMap.get('b5')!.y).toBeGreaterThan(nodeMap.get('b2')!.y);
    expect(nodeMap.get('b3')!.x).not.toBe(nodeMap.get('b5')!.x);
  });
});
